import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { DELETED_USER_EMAIL } from "@/lib/constants";

// POST: Tambah Petugas Baru
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, password, role } = body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName || !normalizedEmail || !password || role !== "PETUGAS") {
      return NextResponse.json({ success: false, message: "Data tidak lengkap atau role tidak valid" }, { status: 422 });
    }

    if (normalizedEmail === DELETED_USER_EMAIL) {
      return NextResponse.json({ success: false, message: "Email tidak dapat digunakan" }, { status: 422 });
    }

    // Samakan dengan policy registrasi: min 8 + kapital + kecil + angka
    const passwordPolicy = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).{8,}$/;
    if (!passwordPolicy.test(password)) {
      return NextResponse.json(
        { success: false, message: "Password minimal 8 karakter dan mengandung huruf kapital, huruf kecil, dan angka" },
        { status: 422 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json({ success: false, message: "Email sudah terdaftar" }, { status: 422 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.user.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        password: hashedPassword,
        role: "PETUGAS",
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      }
    });

    return NextResponse.json({
      success: true,
      message: "Petugas berhasil ditambahkan",
      data: newUser,
    });

  } catch (error) {
    console.error("[ADD_PETUGAS_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
