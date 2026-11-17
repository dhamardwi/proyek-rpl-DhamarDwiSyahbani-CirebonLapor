import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { DELETED_USER_EMAIL } from "@/lib/constants";
import { maskWhatsappNumber } from "@/lib/whatsapp/config";

/**
 * GET /api/users
 * Mengambil daftar pengguna (hanya Admin)
 * Query params: search, role, page, pageSize
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, message: "Akses ditolak. Hanya Admin yang dapat mengakses." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const role = searchParams.get("role") ?? "";
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") ?? "10", 10);

    // Akun teknis penampung laporan pengguna terhapus tidak ditampilkan.
    const where: Record<string, unknown> = {
      email: { not: DELETED_USER_EMAIL },
    };

    if (search) {
      // SQLite tidak mendukung `mode: "insensitive"`; LIKE sudah
      // case-insensitive untuk pencarian nama/email.
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    if (role && ["ADMIN", "PETUGAS", "MASYARAKAT"].includes(role)) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          phone: true,
          address: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { reports: true, assignments: true },
          },
          whatsappLink: {
            select: {
              phoneNumber: true,
              verifiedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users: users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          phone: u.phone ?? "",
          address: u.address ?? "",
          reportCount: u._count.reports,
          taskCount: u._count.assignments,
          whatsappConnected: !!u.whatsappLink,
          whatsappPhoneNumber: u.whatsappLink
            ? maskWhatsappNumber(u.whatsappLink.phoneNumber)
            : null,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("[USERS_GET_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
