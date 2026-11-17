import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { noStore } from "@/lib/api-response";
import {
  resendOtp,
  WhatsappLinkError,
} from "@/lib/whatsapp/linking";

export const dynamic = "force-dynamic";

export async function POST() {
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
    const registration = await db.whatsappRegistration.findFirst({
      where: { userId: session.user.id, status: "APPROVED" },
      orderBy: { reviewedAt: "desc" },
      select: { id: true },
    });

    if (!registration) {
      return noStore(
        { success: false, message: "Tidak ada pengajuan yang sudah disetujui." },
        400
      );
    }

    const result = await resendOtp(registration.id, { userId: session.user.id });

    return noStore({
      success: true,
      message: "Kode OTP baru telah dikirim melalui WhatsApp.",
      data: result,
    });
  } catch (error) {
    if (error instanceof WhatsappLinkError) {
      return noStore({ success: false, code: error.code, message: error.message }, 400);
    }
    console.error(
      "[WHATSAPP_RESEND_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal mengirim ulang OTP" }, 500);
  }
}
