import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { noStore } from "@/lib/api-response";
import {
  getWhatsappStatus,
  verifyOtp,
  WhatsappLinkError,
} from "@/lib/whatsapp/linking";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (session.user.role === "ADMIN" || session.user.role === "PETUGAS") {
    return noStore(
      { success: false, message: "Verifikasi WhatsApp hanya tersedia untuk akun masyarakat." },
      403
    );
  }

  try {
    const body = (await req.json()) as { otp?: unknown };
    const otp = typeof body.otp === "string" ? body.otp : "";

    const result = await verifyOtp({ userId: session.user.id, otp });
    const status = await getWhatsappStatus(session.user.id);

    return noStore({
      success: true,
      message: "Nomor WhatsApp berhasil diverifikasi dan diaktifkan.",
      data: { ...result, status },
    });
  } catch (error) {
    if (error instanceof WhatsappLinkError) {
      return noStore({ success: false, code: error.code, message: error.message }, 400);
    }
    console.error(
      "[WHATSAPP_VERIFY_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal memverifikasi OTP" }, 500);
  }
}
