import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
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

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
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

/**
 * DELETE /api/users/:id
 * Menghapus pengguna (hanya Admin)
 */
export const DELETE = (async (
  req: NextRequest,
  context: { params: Promise<Record<string, unknown>> }
) => {
  const params = await context.params;
  const { id } = params as { id: string };
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
        { success: false, message: "Akses ditolak. Hanya Admin yang dapat menghapus pengguna." },
        { status: 403 }
      );
    }

    const userId = id;

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

    const adminCount = await db.user.count({
      where: { role: "ADMIN" },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { success: false, message: "Tidak dapat menghapus Admin tunggal. Minimal harus ada 1 Admin." },
        { status: 400 }
      );
    }

    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: `Pengguna ${user.name} berhasil dihapus.`,
    });
  } catch (error) {
    console.error("[USERS_DELETE_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
});