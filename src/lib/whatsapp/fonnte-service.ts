import { getFonnteConfig } from "./config";

/**
 * Adapter tunggal untuk Fonnte API.
 *
 * Semua pengiriman WhatsApp (notifikasi dan OTP) harus melalui modul ini agar
 * timeout, validasi respons, dan sanitasi error konsisten.
 */

export type WhatsappSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string; retryable: boolean };

const WHATSAPP_TIMEOUT_MS = 15_000;

const RETRYABLE_KEYWORDS = ["timeout", "timed out", "server", "limit", "busy", "try again"];

function sanitizeErrorMessage(token: string, message: string): string {
  let safe = (message || "").replace(/[\r\n]+/g, " ").trim();
  if (token) safe = safe.split(token).join("[redacted]");
  if (!safe) safe = "unknown_error";
  return safe.slice(0, 200);
}

function classifyNetworkError(error: unknown): { retryable: boolean; message: string } {
  if (!(error instanceof Error)) {
    return { retryable: true, message: "unknown_error" };
  }

  if (error.name === "AbortError" || error.name === "TimeoutError") {
    return { retryable: true, message: "request_timeout" };
  }

  const cause = error.cause as { code?: string } | undefined;
  const code = cause?.code;
  const retryableCodes = [
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_TIMEOUT",
    "UND_ERR_DNS",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECTION_REFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "EAI_AGAIN",
  ];

  if (code && retryableCodes.includes(code)) {
    return { retryable: true, message: `network_error:${code}` };
  }

  if (error.message?.includes("fetch failed")) {
    return { retryable: true, message: "network_error" };
  }

  return { retryable: false, message: error.message || "unknown_error" };
}

/**
 * Mengirim satu pesan teks melalui Fonnte.
 *
 * Nomor target wajib sudah ternormalisasi (mis. 6281234567890). Kegagalan
 * dikembalikan sebagai hasil, bukan dilempar, agar transaksi bisnis utama
 * tidak pernah ikut gagal.
 */
export async function sendWhatsappMessage(
  target: string,
  message: string
): Promise<WhatsappSendResult> {
  const { token, apiUrl, enabled } = getFonnteConfig();

  if (!enabled || !token) {
    return { ok: false, error: "whatsapp_not_configured", retryable: false };
  }
  if (!target || !message.trim()) {
    return { ok: false, error: "invalid_payload", retryable: false };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({ target, message });

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: controller.signal,
      cache: "no-store",
    });

    let payload: {
      status?: boolean | string;
      id?: string[] | string;
      reason?: string;
      detail?: string;
    } = {};

    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      return {
        ok: false,
        error: `http_${response.status}`,
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      };
    }

    const success = payload.status === true || payload.status === "true";

    if (response.ok && success) {
      const messageId = Array.isArray(payload.id) ? payload.id[0] : payload.id;
      return { ok: true, messageId };
    }

    const reason = payload.reason || payload.detail || `http_${response.status}`;
    const safeReason = sanitizeErrorMessage(token, reason);
    const lowerReason = safeReason.toLowerCase();

    const retryable =
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500 ||
      RETRYABLE_KEYWORDS.some((keyword) => lowerReason.includes(keyword));

    return { ok: false, error: safeReason, retryable };
  } catch (error) {
    const classified = classifyNetworkError(error);
    return {
      ok: false,
      error: sanitizeErrorMessage(token, classified.message),
      retryable: classified.retryable,
    };
  } finally {
    clearTimeout(timeout);
  }
}
