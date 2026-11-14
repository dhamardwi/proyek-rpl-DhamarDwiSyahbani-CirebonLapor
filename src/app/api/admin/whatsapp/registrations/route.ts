import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  approveRegistration,
  listRegistrations,
  rejectRegistration,
  resendOtp,
  WhatsappLinkError,
} from "@/lib/whatsapp/linking";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (session.user.role !== "ADMIN") {
    return noStore({ success: false, message: "Akses ditolak. Hanya Admin." }, 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const rows = await listRegistrations({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    return noStore({
      success: true,
      data: { registrations: rows, total: rows.length },
    });
  } catch (error) {
    console.error(
      "[WHATSAPP_ADMIN_LIST_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal mengambil daftar pengajuan" }, 500);
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (session.user.role !== "ADMIN") {
    return noStore({ success: false, message: "Akses ditolak. Hanya Admin." }, 403);
  }

  try {
    const body = (await req.json()) as {
      registrationId?: unknown;
      action?: unknown;
      reason?: unknown;
    };

    const registrationId =
      typeof body.registrationId === "string" ? body.registrationId : "";
    const action = typeof body.action === "string" ? body.action : "";
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    if (!registrationId || !["APPROVE", "REJECT", "RESEND"].includes(action)) {
      return noStore({ success: false, message: "Aksi tidak valid." }, 400);
    }

    if (action === "APPROVE") {
      const result = await approveRegistration(registrationId, session.user.id);
      return noStore({
        success: true,
        message: result.otpSent
          ? "Pengajuan disetujui dan kode OTP telah dikirim melalui WhatsApp."
          : "Pengajuan disetujui, tetapi kode OTP gagal dikirim. Gunakan tombol Kirim Ulang OTP.",
        data: result,
      });
    }

    if (action === "REJECT") {
      const result = await rejectRegistration(registrationId, session.user.id, reason);
      return noStore({
        success: true,
        message: "Pengajuan nomor WhatsApp ditolak.",
        data: result,
      });
    }

    const result = await resendOtp(registrationId);
    return noStore({
      success: true,
      message: "Kode OTP baru telah dikirim melalui WhatsApp.",
      data: result,
    });
  } catch (error) {
    if (error instanceof WhatsappLinkError) {
      const status = error.code === "REGISTRATION_NOT_FOUND" ? 404 : 400;
      return noStore({ success: false, code: error.code, message: error.message }, status);
    }
    console.error(
      "[WHATSAPP_ADMIN_ACTION_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal memproses pengajuan" }, 500);
  }
}
