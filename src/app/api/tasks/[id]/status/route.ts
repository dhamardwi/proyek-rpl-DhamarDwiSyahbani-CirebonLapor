import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { notifyTaskStatusChanged } from "@/lib/report-notification-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Hanya PETUGAS dan ADMIN yang bisa mengakses endpoint ini
    if (session.user.role !== "PETUGAS" && session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const report = await db.report.findUnique({
      where: { id },
    });

    if (!report) {
      return NextResponse.json({ success: false, message: "Laporan tidak ditemukan" }, { status: 404 });
    }

    // Otorisasi: petugas hanya bisa mengubah tugas miliknya
    if (session.user.role === "PETUGAS" && report.assignedTo !== session.user.id) {
      return NextResponse.json({ success: false, message: "Anda tidak memiliki akses ke tugas ini" }, { status: 403 });
    }

    const formData = await req.formData();
    const newStatus = formData.get("status") as string;
    const note = formData.get("note") as string | null;
    const image = formData.get("image") as File | null;

    // Validasi transisi status yang diizinkan untuk petugas
    const allowedTransitions: Record<string, string[]> = {
      DITUGASKAN: ["SEDANG_DIPERBAIKI"],
      SEDANG_DIPERBAIKI: ["SELESAI"],
    };

    const allowed = allowedTransitions[report.status];
    if (!allowed || !allowed.includes(newStatus)) {
      return NextResponse.json(
        { success: false, message: `Tidak dapat mengubah status dari ${report.status} ke ${newStatus}` },
        { status: 422 }
      );
    }

    // Jika status SELESAI, wajib ada foto bukti perbaikan
    if (newStatus === "SELESAI" && !image) {
      return NextResponse.json(
        { success: false, message: "Foto bukti perbaikan wajib diunggah untuk menyelesaikan tugas" },
        { status: 422 }
      );
    }

    // Simpan foto bukti perbaikan jika ada
    let relativeImageUrl: string | null = null;
    if (image) {
      const validTypes = ["image/jpeg", "image/png", "image/jpg"];
      if (!validTypes.includes(image.type)) {
        return NextResponse.json({ success: false, message: "Format foto harus JPG atau PNG" }, { status: 422 });
      }
      if (image.size > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, message: "Ukuran foto maksimal 5MB" }, { status: 422 });
      }

      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = image.name.split(".").pop();
      const fileName = `bukti-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
      const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");

      try {
        await mkdir(uploadDir, { recursive: true });
      } catch {
        // Directory already exists
      }

      await writeFile(path.join(uploadDir, fileName), buffer);
      relativeImageUrl = `/uploads/reports/${fileName}`;
    }

    // Database Transaction
    const updated = await db.$transaction(async (tx) => {
      // 1. Update status laporan
      const updatedReport = await tx.report.update({
        where: { id },
        data: { status: newStatus },
      });

      // 2. Simpan foto bukti jika ada
      if (relativeImageUrl) {
        await tx.reportImage.create({
          data: {
            reportId: id,
            imagePath: relativeImageUrl,
            imageType: "BUKTI_PERBAIKAN",
          },
        });
      }

      // 3. Catat di status history
      await tx.reportStatusHistory.create({
        data: {
          reportId: id,
          status: newStatus,
          note: note || (newStatus === "SEDANG_DIPERBAIKI"
            ? "Petugas mulai mengerjakan perbaikan"
            : "Perbaikan telah selesai dilakukan"),
          updatedById: session.user.id,
        },
      });

      return updatedReport;
    });

    // Notifikasi (di luar transaksi agar kegagalan notif tidak rollback status)
    // Gunakan data laporan yang sudah diupdate agar status baru sudah tercermin.
    await notifyTaskStatusChanged({
      report: {
        id: updated.id,
        userId: updated.userId,
        title: updated.title,
        address: updated.address,
      },
      newStatus,
      note,
      actorId: session.user.id,
      actorName: session.user.name ?? "Petugas",
      occurredAt: updated.updatedAt,
    });

    return NextResponse.json({
      success: true,
      message: newStatus === "SELESAI"
        ? "Tugas berhasil diselesaikan!"
        : "Status berhasil diperbarui",
      data: updated,
    });

  } catch (error) {
    console.error("[UPDATE_TASK_STATUS_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
