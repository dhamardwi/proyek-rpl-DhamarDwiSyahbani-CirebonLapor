import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { maskWhatsappNumber } from "@/lib/whatsapp/config";
import { DELETED_USER_EMAIL } from "@/lib/constants";
import { z } from "zod";

/**
 * GET /api/profile
 * Mengambil profil pengguna yang sedang login
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        whatsappLink: {
          select: {
            phoneNumber: true,
            verifiedAt: true,
          },
        },
        whatsappRegistrations: {
          where: { status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
        _count: {
          select: { reports: true, assignments: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Pengguna tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone ?? "",
        address: user.address ?? "",
        isActive: user.isActive,
        reportCount: user._count.reports,
        taskCount: user._count.assignments,
        whatsapp: {
          connected: !!user.whatsappLink,
          maskedPhoneNumber: user.whatsappLink
            ? maskWhatsappNumber(user.whatsappLink.phoneNumber)
            : null,
          verifiedAt: user.whatsappLink?.verifiedAt ?? null,
          registrationStatus: user.whatsappRegistrations[0]?.status ?? null,
        },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("[PROFILE_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/profile
 * Memperbarui informasi profil pengguna (nama, email, phone, address)
 * Role tidak boleh diubah melalui endpoint ini
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();

    const updateSchema = z.object({
      name: z.string().min(1, "Nama lengkap wajib diisi").max(100),
      email: z.string().email("Format email tidak valid"),
      phone: z.string().optional().nullable(),
      address: z.string().optional().nullable(),
    });

    const validated = updateSchema.parse(body);

    if (validated.email.trim().toLowerCase() === DELETED_USER_EMAIL) {
      return NextResponse.json(
        { success: false, message: "Email tidak dapat digunakan" },
        { status: 400 }
      );
    }

    // Cek apakah email sudah digunakan oleh pengguna lain
    const existingUser = await db.user.findFirst({
      where: {
        email: validated.email,
        id: { not: session.user.id },
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "Email sudah digunakan oleh pengguna lain" },
        { status: 400 }
      );
    }

    const updatedUser = await db.user.update({
      where: { id: session.user.id },
      data: {
        name: validated.name,
        email: validated.email,
        phone: validated.phone ?? null,
        address: validated.address ?? null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        address: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Profil berhasil diperbarui",
      data: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        phone: updatedUser.phone ?? "",
        address: updatedUser.address ?? "",
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message || "Validasi gagal" },
        { status: 400 }
      );
    }
    console.error("[PROFILE_UPDATE_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}