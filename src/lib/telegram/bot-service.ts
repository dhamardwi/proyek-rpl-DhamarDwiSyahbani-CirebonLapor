import { getTelegramConfig } from "./config";

export type TelegramSendResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean };

const TELEGRAM_API_BASE = "https://api.telegram.org";
const TELEGRAM_TIMEOUT_MS = 10_000;

function sanitizeError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? "");
  const token = getTelegramConfig().token;

  let safe = raw.replace(/[\r\n]+/g, " ").trim();
  // Jangan pernah menyimpan/mencetak URL Bot API yang memuat token.
  if (token) safe = safe.split(token).join("[redacted]");
  if (!safe) safe = "unknown_error";

  return safe.slice(0, 180);
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

/**
 * Memanggil Bot API. Semua kegagalan dikembalikan sebagai hasil, tidak
 * dilempar ke pemanggil, agar transaksi utama aplikasi tidak pernah gagal
 * hanya karena Telegram bermasalah.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<TelegramSendResult> {
  const { token, enabled } = getTelegramConfig();

  if (!enabled || !token) {
    return { ok: false, error: "telegram_not_configured", retryable: false };
  }
  if (!chatId || !text.trim()) {
    return { ok: false, error: "invalid_payload", retryable: false };
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      cache: "no-store",
    });

    let payload: TelegramApiResponse = {};
    try {
      payload = (await response.json()) as TelegramApiResponse;
    } catch {
      return { ok: false, error: "invalid_telegram_response", retryable: true };
    }

    if (response.ok && payload.ok) {
      return { ok: true };
    }

    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      payload.error_code === 429 ||
      (payload.error_code ?? 0) >= 500;

    return {
      ok: false,
      error: sanitizeError(payload.description || `http_${response.status}`),
      retryable,
    };
  } catch (error) {
    // Pesan error fetch dapat memuat URL lengkap (termasuk token), jadi
    // jangan pernah meneruskan objek error mentah ke log.
    return { ok: false, error: sanitizeError(error), retryable: true };
  }
}
