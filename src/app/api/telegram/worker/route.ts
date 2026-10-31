import { NextResponse } from "next/server";
import { isTelegramConfigured } from "@/lib/telegram/config";
import { processTelegramOutbox } from "@/lib/telegram/outbox";
import { isValidWebhookSecret } from "@/lib/telegram/webhook-auth";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

/**
 * Endpoint untuk cron/background worker yang memproses retry outbox.
 * Lindungi dengan TELEGRAM_WORKER_SECRET. Jika secret tidak diisi, endpoint
 * dinonaktifkan; pengiriman normal tetap berjalan lewat `after()`.
 */
async function handleWorker(request: Request) {
  const secret = process.env.TELEGRAM_WORKER_SECRET?.trim() ?? "";

  if (!secret) {
    return NextResponse.json(
      { success: false, message: "Worker Telegram tidak dikonfigurasi" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";

  if (!isValidWebhookSecret(provided, secret)) {
    return NextResponse.json(
      { success: false },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }

  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { success: false, message: "Telegram belum dikonfigurasi" },
      { status: 503, headers: NO_STORE_HEADERS }
    );
  }

  try {
    const result = await processTelegramOutbox({ max: 25 });
    return NextResponse.json(
      { success: true, data: result },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error(
      "[TELEGRAM_WORKER_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json(
      { success: false, message: "Worker gagal memproses antrean" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function GET(request: Request) {
  return handleWorker(request);
}

export async function POST(request: Request) {
  return handleWorker(request);
}
