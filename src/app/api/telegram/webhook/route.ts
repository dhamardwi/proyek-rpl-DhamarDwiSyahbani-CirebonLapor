import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram/bot-service";
import { buildReply, type TelegramIncomingMessage } from "@/lib/telegram/commands";
import { getTelegramConfig } from "@/lib/telegram/config";
import { isValidWebhookSecret } from "@/lib/telegram/webhook-auth";

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramIncomingMessage;
  edited_message?: TelegramIncomingMessage;
}

export async function POST(request: Request) {
  const config = getTelegramConfig();

  // Saat polling aktif, update diambil lewat getUpdates dan tidak lewat webhook.
  if (!config.usePolling) {
    if (!config.webhookSecret) {
      return NextResponse.json(
        { ok: false, message: "Webhook secret belum dikonfigurasi" },
        { status: 503 }
      );
    }

    const providedSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (!isValidWebhookSecret(providedSecret, config.webhookSecret)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const message = update.message ?? update.edited_message;

  try {
    const result = message ? await buildReply(message) : null;

    // Update non-teks (foto, edited_message tanpa teks, dll.) diabaikan dengan
    // sukses agar Telegram tidak mengirim ulang tanpa henti.
    if (!result) {
      return NextResponse.json({ ok: true });
    }

    // Balasan bersifat best-effort; kegagalannya tidak memengaruhi update.
    await sendTelegramMessage(result.chatId, result.reply);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Jangan log isi pesan, token, atau chat ID.
    console.error(
      "[TELEGRAM_WEBHOOK_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
