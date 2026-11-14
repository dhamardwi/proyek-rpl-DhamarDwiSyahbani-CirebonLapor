import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isFonnteConfigured } from "@/lib/whatsapp/config";
import {
  disconnectWhatsapp,
  getWhatsappStatus,
  submitWhatsappRegistration,
  WhatsappLinkError,
} from "@/lib/whatsapp/linking";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function forbiddenForStaff(role: string | undefined): boolean {
  return role === "ADMIN" || role === "PETUGAS";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (forbiddenForStaff(session.user.role)) {
    return noStore(
      {
        success: false,
        message:
          "Pengaturan WhatsApp hanya tersedia untuk akun masyarakat. Administrator dapat membuka halaman Persetujuan WhatsApp.",
      },
      403
    );
  }

  try {
    const status = await getWhatsappStatus(session.user.id);
    return noStore({
      success: true,
      data: {
        ...status,
        configured: isFonnteConfigured(),
      },
    });
  } catch (error) {
    console.error(
      "[WHATSAPP_SETTINGS_GET_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal mengambil status WhatsApp" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (forbiddenForStaff(session.user.role)) {
    return noStore(
      { success: false, message: "Pengaturan WhatsApp hanya tersedia untuk akun masyarakat." },
      403
    );
  }
  if (!isFonnteConfigured()) {
    return noStore(
      { success: false, message: "Integrasi WhatsApp belum dikonfigurasi oleh administrator." },
      503
    );
  }

  try {
    const body = (await req.json()) as { phoneNumber?: unknown };
    const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber : "";

    if (!phoneNumber.trim()) {
      return noStore({ success: false, message: "Nomor WhatsApp wajib diisi." }, 400);
    }

    const registration = await submitWhatsappRegistration({
      userId: session.user.id,
      phoneNumber,
    });

    return noStore({
      success: true,
      message:
        "Pengajuan nomor WhatsApp berhasil dikirim. Menunggu persetujuan administrator.",
      data: registration,
    });
  } catch (error) {
    if (error instanceof WhatsappLinkError) {
      const status = error.code === "USER_NOT_FOUND" ? 403 : 400;
      return noStore({ success: false, message: error.message }, status);
    }
    console.error(
      "[WHATSAPP_SETTINGS_POST_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal mengirim pengajuan WhatsApp" }, 500);
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (forbiddenForStaff(session.user.role)) {
    return noStore(
      { success: false, message: "Pengaturan WhatsApp hanya tersedia untuk akun masyarakat." },
      403
    );
  }

  try {
    const removed = await disconnectWhatsapp(session.user.id);
    return noStore({
      success: true,
      data: { disconnected: removed > 0 },
      message:
        removed > 0
          ? "Koneksi WhatsApp berhasil diputuskan."
          : "Tidak ada nomor WhatsApp yang aktif.",
    });
  } catch (error) {
    console.error(
      "[WHATSAPP_SETTINGS_DELETE_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal memutuskan koneksi WhatsApp" }, 500);
  }
}
