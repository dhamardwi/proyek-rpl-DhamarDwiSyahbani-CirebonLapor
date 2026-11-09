import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { notifyAdminReportAction } from "@/lib/report-notification-service";

type AdminAction = "VERIFY" | "REJECT" | "ASSIGN" | "PRIORITY";

const ALLOWED_PRIORITIES = ["RENDAH", "SEDANG", "TINGGI", "KRITIS"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const report = await db.report.findUnique({ where: { id } });
    if (!report) {
      return NextResponse.json({ success: false, message: "Laporan tidak ditemukan" }, { status: 404 });
    }

    const body = await req.json();
    const { action, note, assigneeId, priority } = body as {
      action: AdminAction;
      note?: string;
      assigneeId?: string;
      priority?: string;
    };

    // Transaksi hanya untuk perubahan data laporan — notifikasi dikirim setelahnya
    // agar kegagalan notifikasi tidak me-rollback verifikasi/penugasan.
    //
    // Admin memegang kendali penuh manual, termasuk override keputusan AI:
    // - VERIFY dari MENUNGGU_VERIFIKASI / DIPROSES_AI / DITOLAK (koreksi penolakan AI)
    // - REJECT dari MENUNGGU_VERIFIKASI / DIPROSES_AI / DITERIMA (koreksi penerimaan AI)
    const VERIFY_FROM = ["MENUNGGU_VERIFIKASI", "DIPROSES_AI", "DITOLAK"];
    const REJECT_FROM = ["MENUNGGU_VERIFIKASI", "DIPROSES_AI", "DITERIMA"];

    const updated = await db.$transaction(async (tx) => {
      if (action === "VERIFY") {
        if (!VERIFY_FROM.includes(report.status)) throw new Error("Status laporan ini tidak bisa diverifikasi");
        await tx.report.update({ where: { id }, data: { status: "DITERIMA" } });
        await tx.reportStatusHistory.create({
          data: {
            reportId: id,
            status: "DITERIMA",
            note: note || "Laporan telah diverifikasi dan diterima oleh Admin.",
            updatedById: session.user.id,
          },
        });
        return tx.report.findUnique({ where: { id } });
      }

      if (action === "REJECT") {
        if (!REJECT_FROM.includes(report.status)) throw new Error("Status laporan ini tidak bisa ditolak");
        await tx.report.update({ where: { id }, data: { status: "DITOLAK", assignedTo: null } });
        await tx.reportStatusHistory.create({
          data: {
            reportId: id,
            status: "DITOLAK",
            note: note || "Laporan ditolak.",
            updatedById: session.user.id,
          },
        });
        return tx.report.findUnique({ where: { id } });
      }

      if (action === "ASSIGN") {
        if (report.status !== "DITERIMA") throw new Error("Laporan harus diverifikasi sebelum ditugaskan");
        if (!assigneeId) throw new Error("Petugas yang dipilih tidak valid");

        const assignee = await tx.user.findUnique({ where: { id: assigneeId } });
        if (!assignee || assignee.role !== "PETUGAS") {
          throw new Error("Petugas yang dipilih tidak valid");
        }
        if (!assignee.isActive) {
          throw new Error("Petugas yang dipilih sedang nonaktif");
        }

        await tx.report.update({
          where: { id },
          data: { status: "DITUGASKAN", assignedTo: assigneeId },
        });
        await tx.reportStatusHistory.create({
          data: {
            reportId: id,
            status: "DITUGASKAN",
            note: `Admin menugaskan perbaikan kepada petugas: ${assignee.name}`,
            updatedById: session.user.id,
          },
        });
        return tx.report.findUnique({ where: { id } });
      }

      if (action === "PRIORITY") {
        if (!ALLOWED_PRIORITIES.includes(priority as (typeof ALLOWED_PRIORITIES)[number])) {
          throw new Error("Prioritas tidak valid");
        }
        await tx.report.update({ where: { id }, data: { priority } });
        await tx.reportStatusHistory.create({
          data: {
            reportId: id,
            status: report.status,
            note: `Admin mengubah prioritas laporan menjadi ${priority}`,
            updatedById: session.user.id,
          },
        });
        return tx.report.findUnique({ where: { id } });
      }

      throw new Error("Aksi tidak valid");
    });

    // Kirim notifikasi setelah transaksi sukses (fail-open).
    // Gunakan data laporan yang sudah diupdate (bukan data sebelum transaksi)
    // agar status dan petugas yang tercantum dalam notifikasi akurat.
    if (updated) {
      await notifyAdminReportAction({
        action,
        report: {
          id: updated.id,
          userId: updated.userId,
          title: updated.title,
          address: updated.address,
          status: updated.status,
          assignedTo: updated.assignedTo,
        },
        note,
        assigneeId,
        priority,
        actorId: session.user.id,
        actorName: session.user.name ?? "Admin",
        occurredAt: updated.updatedAt,
      });
    }

    const messages: Record<AdminAction, string> = {
      VERIFY: "Laporan berhasil diverifikasi",
      REJECT: "Laporan berhasil ditolak",
      ASSIGN: "Petugas berhasil ditugaskan",
      PRIORITY: "Prioritas berhasil diubah",
    };

    return NextResponse.json({
      success: true,
      message: messages[action] ?? "Berhasil memproses laporan",
      data: updated,
    });
  } catch (error: unknown) {
    console.error("[ADMIN_UPDATE_REPORT_ERROR]", error);
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server";
    const isValidation =
      message.includes("tidak valid") ||
      message.includes("tidak bisa") ||
      message.includes("Hanya") ||
      message.includes("harus") ||
      message.includes("nonaktif");
    return NextResponse.json(
      { success: false, message },
      { status: isValidation ? 422 : 500 }
    );
  }
}
