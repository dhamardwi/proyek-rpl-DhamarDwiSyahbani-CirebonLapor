import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  buildTelegramDeepLink,
  getTelegramConfig,
  isHttpsUrl,
  isLocalhostUrl,
  isTelegramConfigured,
  isTelegramWebhookConfigured,
} from "@/lib/telegram/config";
import {
  createLinkToken,
  disconnectTelegram,
  getTelegramStatus,
} from "@/lib/telegram/linking";

export const dynamic = "force-dynamic";

function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (session.user.role === "ADMIN" || session.user.role === "PETUGAS") {
    return noStore(
      { success: false, message: "Integrasi Telegram tidak tersedia untuk akun admin atau petugas." },
      403
    );
  }

  try {
    const status = await getTelegramStatus(session.user.id);
    const config = getTelegramConfig();

    return noStore({
      success: true,
      data: {
        ...status,
        configured: isTelegramConfigured(),
        webhookConfigured: isTelegramWebhookConfigured(),
        usePolling: config.usePolling === true,
        appUrl: config.appUrl,
        appUrlIsHttps: isHttpsUrl(config.appUrl),
        appUrlIsLocalhost: isLocalhostUrl(config.appUrl),
        botUsername: config.username || null,
        tokenTtlMinutes: 10,
      },
    });
  } catch (error) {
    console.error(
      "[TELEGRAM_SETTINGS_GET_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal mengambil status Telegram" }, 500);
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (session.user.role === "ADMIN" || session.user.role === "PETUGAS") {
    return noStore(
      { success: false, message: "Integrasi Telegram tidak tersedia untuk akun admin atau petugas." },
      403
    );
  }

  const config = getTelegramConfig();

  if (!isTelegramConfigured()) {
    return noStore(
      { success: false, message: "Integrasi Telegram belum dikonfigurasi oleh admin." },
      503
    );
  }

  // Secret webhook hanya wajib saat mode webhook; polling tidak memerlukannya.
  if (!config.usePolling && !isTelegramWebhookConfigured()) {
    return noStore(
      {
        success: false,
        message:
          "Webhook Telegram belum siap: TELEGRAM_WEBHOOK_SECRET belum diatur. " +
          "Tanpa secret, bot tidak dapat membalas pesan penautan.",
      },
      503
    );
  }

  try {
    const { token, expiresAt } = await createLinkToken(session.user.id);
    const deepLink = buildTelegramDeepLink(token);

    if (!deepLink) {
      return noStore(
        { success: false, message: "Username bot Telegram belum dikonfigurasi." },
        503
      );
    }

    // Token mentah tidak dikirim terpisah; hanya tersedia di dalam deep link
    // yang berumur pendek dan sekali pakai.
    return noStore({
      success: true,
      data: {
        deepLink,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(
      "[TELEGRAM_SETTINGS_POST_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal membuat tautan Telegram" }, 500);
  }
}

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return noStore({ success: false, message: "Unauthorized" }, 401);
  }
  if (session.user.role === "ADMIN" || session.user.role === "PETUGAS") {
    return noStore(
      { success: false, message: "Integrasi Telegram tidak tersedia untuk akun admin atau petugas." },
      403
    );
  }

  try {
    const removed = await disconnectTelegram(session.user.id);
    return noStore({
      success: true,
      data: { disconnected: removed > 0 },
      message:
        removed > 0
          ? "Koneksi Telegram berhasil diputuskan."
          : "Tidak ada koneksi Telegram yang aktif.",
    });
  } catch (error) {
    console.error(
      "[TELEGRAM_SETTINGS_DELETE_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return noStore({ success: false, message: "Gagal memutuskan koneksi Telegram" }, 500);
  }
}
