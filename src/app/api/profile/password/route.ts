import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

/**
 * POST /api/profile/password
 * Mengubah password pengguna
 * Memerlukan password saat ini untuk verifikasi
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const passwordSchema = z.object({
      currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
      newPassword: z
        .string()
        .min(8, "Password baru minimal 8 karakter")
        .max(128, "Password baru maksimal 128 karakter"),
      confirmPassword: z.string(),
    });

    const validated = passwordSchema.parse(body);

    if (validated.newPassword !== validated.confirmPassword) {
      return NextResponse.json(
        { success: false, message: "Konfirmasi password baru tidak cocok" },
        { status: 400 }
      );
    }

    // Ambil user dengan password
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    // Verifikasi password saat ini
    const isPasswordValid = await bcrypt.compare(
      validated.currentPassword,
      user.password
    );

    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, message: "Password saat ini tidak benar" },
        { status: 400 }
      );
    }

    // Cek jika password baru sama dengan password lama
    const isSamePassword = await bcrypt.compare(
      validated.newPassword,
      user.password
    );

    if (isSamePassword) {
      return NextResponse.json(
        { success: false, message: "Password baru tidak boleh sama dengan password saat ini" },
        { status: 400 }
      );
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(validated.newPassword, 12);

    // Simpan password baru
    await db.user.update({
      where: { id: session.user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({
      success: true,
      message: "Password berhasil diubah. Silakan login lagi dengan password baru.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message || "Validasi gagal" },
        { status: 400 }
      );
    }
    console.error("[PROFILE_PASSWORD_CHANGE_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}