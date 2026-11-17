import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getCurrentSession } from "@/lib/auth-session";
import db from "@/lib/db";
import { DELETED_USER_EMAIL, DELETED_USER_NAME } from "@/lib/constants";

/**
 * DELETE /api/users/:id
 * Menghapus pengguna (hanya Admin).
 *
 * Laporan dan histori status milik pengguna tidak ikut dihapus. Relasi yang
 * wajib (pelapor laporan & updatedBy histori) dialihkan ke akun teknis
 * "Pengguna Dihapus" agar integritas data tetap terjaga. Relasi opsional
 * (penugasan petugas & reviewer duplikat) otomatis menjadi NULL, sedangkan
 * data notifikasi/WhatsApp ikut terhapus bersama akun.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Admin yang dapat menghapus pengguna." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = typeof id === "string" ? id.trim() : "";

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "ID pengguna tidak valid" },
        { status: 400 }
      );
    }

    if (userId === session.user.id) {
      return NextResponse.json(
        { success: false, message: "Tidak dapat menghapus akun Anda sendiri." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    if (user.email === DELETED_USER_EMAIL) {
      return NextResponse.json(
        { success: false, message: "Akun sistem tidak dapat dihapus." },
        { status: 400 }
      );
    }

    // Jangan sampai sistem kehilangan seluruh akun Admin.
    if (user.role === "ADMIN") {
      const adminCount = await db.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) {
        return NextResponse.json(
          { success: false, message: "Tidak dapat menghapus Admin tunggal. Minimal harus ada 1 Admin." },
          { status: 400 }
        );
      }
    }

    // Hash di luar transaksi agar transaksi tetap singkat.
    const tombstonePassword = await bcrypt.hash(
      `deleted-${user.id}-${Date.now()}`,
      10
    );

    await db.$transaction(async (tx) => {
      // Akun teknis penampung laporan/histori. Dibuat sekali dan dipakai ulang.
      const deletedUser = await tx.user.upsert({
        where: { email: DELETED_USER_EMAIL },
        update: {},
        create: {
          name: DELETED_USER_NAME,
          email: DELETED_USER_EMAIL,
          password: tombstonePassword,
          role: "MASYARAKAT",
          isActive: false,
        },
        select: { id: true },
      });

      // Pertahankan laporan sebagai pelapor "Pengguna Dihapus".
      await tx.report.updateMany({
        where: { userId: user.id },
        data: { userId: deletedUser.id },
      });

      // Pertahankan histori status sebagai "Pengguna Dihapus".
      await tx.reportStatusHistory.updateMany({
        where: { updatedById: user.id },
        data: { updatedById: deletedUser.id },
      });

      // Antrean WhatsApp tidak memakai foreign key, bersihkan manual.
      await tx.whatsappOutbox.deleteMany({ where: { userId: user.id } });

      // Notifikasi, WhatsApp link/registration, dan relasi opsional lain
      // ditangani oleh constraint database (Cascade / SetNull).
      await tx.user.delete({ where: { id: user.id } });
    });

    return NextResponse.json({
      success: true,
      message: `Pengguna ${user.name} berhasil dihapus.`,
    });
  } catch (error) {
    console.error("[USERS_DELETE_ERROR]", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        return NextResponse.json(
          { success: false, message: "Pengguna tidak ditemukan" },
          { status: 404 }
        );
      }

      if (error.code === "P2003") {
        return NextResponse.json(
          {
            success: false,
            message: "Pengguna tidak dapat dihapus karena masih terhubung dengan data lain.",
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
