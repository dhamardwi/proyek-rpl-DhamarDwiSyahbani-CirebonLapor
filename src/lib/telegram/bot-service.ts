import { getTelegramConfig } from "./config";
import { fetchTelegram, describeError, classifyError } from "./transport";

export type TelegramSendResult =
  | { ok: true }
  | { ok: false; error: string; retryable: boolean };

const TELEGRAM_TIMEOUT_MS = 15_000;

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
    const response = await fetchTelegram<{
      ok?: boolean;
      description?: string;
      error_code?: number;
      parameters?: { retry_after?: number };
    }>(
      token,
      "sendMessage",
      {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      },
      TELEGRAM_TIMEOUT_MS
    );

    if (response.ok) {
      return { ok: true };
    }

    const errorCode = response.error_code ?? 0;
    const statusCode = Number(response.description?.replace("http_", "") ?? 0);

    const retryable =
      errorCode === 429 ||
      errorCode >= 500 ||
      statusCode === 429 ||
      statusCode >= 500;

    return {
      ok: false,
      error: response.description ?? "unknown_error",
      retryable,
    };
  } catch (error) {
    // Error jaringan (connection timeout, DNS, TLS, dll.) adalah retryable.
    const errorClass = classifyError(error);
    const isNetworkError =
      errorClass === "connection_timeout" ||
      errorClass === "request_timeout" ||
      errorClass === "dns_error" ||
      errorClass === "tls_error" ||
      errorClass === "socket_error" ||
      errorClass === "connection_refused" ||
      errorClass === "network_error";

    return {
      ok: false,
      error: describeError(token, error),
      retryable: isNetworkError,
    };
  }
}
