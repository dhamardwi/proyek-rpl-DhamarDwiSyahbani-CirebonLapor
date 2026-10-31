import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";

// PATCH: Toggle isActive user
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

    const targetUser = await db.user.findUnique({ where: { id } });
    
    if (!targetUser) {
      return NextResponse.json({ success: false, message: "User tidak ditemukan" }, { status: 404 });
    }

    if (targetUser.role === "ADMIN") {
      return NextResponse.json({ success: false, message: "Tidak dapat mengubah status Admin" }, { status: 403 });
    }

    const body = await req.json();
    const { isActive } = body;

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ success: false, message: "Payload tidak valid" }, { status: 422 });
    }

    const updated = await db.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true
      }
    });

    return NextResponse.json({
      success: true,
      message: `User berhasil di${isActive ? 'aktifkan' : 'nonaktifkan'}`,
      data: updated,
    });

  } catch (error) {
    console.error("[TOGGLE_USER_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server" },
      { status: 500 }
    );
  }
}
