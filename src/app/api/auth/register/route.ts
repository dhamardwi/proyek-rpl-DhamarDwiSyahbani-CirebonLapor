import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { RegisterSchema } from "@/lib/validations/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validasi input dengan Zod
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Validasi gagal",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const { name, email, password } = parsed.data;

    // 2. Cek apakah email sudah digunakan
    const existing = await db.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: "Email sudah terdaftar. Gunakan email lain atau login.",
        },
        { status: 409 }
      );
    }

    // 3. Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 4. Buat user baru dengan role MASYARAKAT
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "MASYARAKAT",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Akun berhasil dibuat. Silakan login.",
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER_API]", error);
    return NextResponse.json(
      {
        success: false,
        message: "Terjadi kesalahan server. Silakan coba lagi.",
      },
      { status: 500 }
    );
  }
}
