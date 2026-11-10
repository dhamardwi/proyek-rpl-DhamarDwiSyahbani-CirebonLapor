/**
 * Transport layer khusus untuk Telegram Bot API.
 *
 * Modul ini menyediakan fungsi fetch yang dioptimalkan untuk koneksi ke
 * https://api.telegram.org, termasuk prioritas DNS IPv6 agar connection
 * timeout via IPv4 tidak menghalangi polling dan pengiriman notifikasi.
 *
 * Pengaturan DNS hanya berlaku untuk modul ini saat diimpor, dan tidak
 * mengubah perilaku fetch untuk host lain di aplikasi (kecuali
 * setDefaultResultOrder yang bersifat process-wide; kami hanya memprioritaskan
 * IPv6, IPv4 tetap tersedia sebagai fallback).
 */

import { setDefaultResultOrder } from "node:dns";

// Prioritaskan alamat IPv6 untuk seluruh DNS lookup dalam proses.
// Ini memengaruhi semua fetch dalam proses, tetapi hanya mengubah URUTAN
// (IPv6 dulu, IPv4 sebagai fallback), tidak melarang IPv4 sama sekali.
// Tidak ada alamat IP Telegram yang di-hardcode.
setDefaultResultOrder("ipv6first");

const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Klasifikasi jenis kegagalan jaringan untuk logging yang informatif.
 */
export function classifyError(error: unknown): string {
  if (!(error instanceof Error)) return "unknown_error";

  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const causeObj = cause as Record<string, unknown>;
    if (causeObj.code === "UND_ERR_CONNECT_TIMEOUT")
      return "connection_timeout";
    if (causeObj.code === "UND_ERR_TIMEOUT") return "request_timeout";
    if (causeObj.code === "UND_ERR_ABORTED") return "request_aborted";
    if (causeObj.code === "UND_ERR_CONNECTION_REFUSED")
      return "connection_refused";
    if (causeObj.code === "UND_ERR_DNS") return "dns_error";
    if (causeObj.code === "UND_ERR_TLS") return "tls_error";
    if (causeObj.code === "UND_ERR_SOCKET") return "socket_error";
  }

  if (error.name === "TimeoutError") return "abort_timeout";
  if (error.message?.includes("fetch failed")) return "network_error";

  return "unknown_error";
}

/**
 * Menghapus token bot dan URL Bot API dari pesan error agar tidak bocor ke log.
 */
function sanitizeErrorMessage(token: string, message: string): string {
  if (!message) return message;
  let safe = message.replace(/[\r\n]+/g, " ").trim();
  if (token) safe = safe.split(token).join("[redacted]");
  if (TELEGRAM_API_BASE) safe = safe.split(TELEGRAM_API_BASE).join("[redacted]");
  if (!safe) safe = "unknown_error";
  return safe.slice(0, 200);
}

/**
 * Membuat deskripsi error yang aman untuk dicetak ke log.
 * Menampilkan name, message, cause.code, dan cause.message jika tersedia.
 * Token dan URL Bot API tidak pernah dicetak.
 */
export function describeError(token: string, error: unknown): string {
  if (!(error instanceof Error)) {
    return "unknown_error";
  }

  const parts: string[] = [error.name];

  const safeMessage = sanitizeErrorMessage(token, error.message);
  if (safeMessage && safeMessage !== "unknown_error") {
    parts.push(safeMessage);
  }

  const cause = error.cause;
  if (cause && typeof cause === "object") {
    const causeObj = cause as Record<string, unknown>;
    if (causeObj.code) parts.push(`cause.code=${String(causeObj.code)}`);
    const causeMessage =
      cause instanceof Error ? cause.message : String(cause);
    const safeCauseMessage = sanitizeErrorMessage(token, causeMessage);
    if (safeCauseMessage) parts.push(`cause.message=${safeCauseMessage}`);
  }

  return parts.join(" - ");
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

/**
 * Panggil Telegram Bot API dengan fetch yang dilengkapi AbortController,
 * timeout terpisah per operasi, dan penanganan error yang aman untuk log.
 *
 * @param token       Token bot Telegram (tidak akan dicetak ke log)
 * @param method      Nama method API, mis. "getUpdates", "sendMessage", "deleteWebhook"
 * @param payload     Body JSON yang akan dikirim
 * @param timeoutMs   Batas waktu request dalam milidetik (default: 40.000)
 * @returns           Respons terstruktur dari Telegram API
 */
export async function fetchTelegram<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>,
  timeoutMs: number = 40_000
): Promise<TelegramApiResponse<T>> {
  const controller = new AbortController();
  const abortTimeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `${TELEGRAM_API_BASE}/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
        signal: controller.signal,
        cache: "no-store",
      }
    );

    try {
      return (await response.json()) as TelegramApiResponse<T>;
    } catch {
      return { ok: false, description: `http_${response.status}` };
    }
  } catch (error) {
    // Jangan melempar error mentah yang mungkin mengandung token.
    // Kembalikan sebagai respons error agar pemanggil tidak perlu try-catch.
    const safeDesc = describeError(token, error);
    return { ok: false, description: safeDesc } as TelegramApiResponse<T>;
  } finally {
    clearTimeout(abortTimeout);
  }
}

/**
 * Wrapper tambahan untuk logging konsisten. Mengembalikan { ok, error }
 * alami untuk digunakan di bot-service dan outbox tanpa try-catch di pemanggil.
 */
export async function fetchTelegramSafe<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>,
  timeoutMs: number = 40_000
): Promise<{ ok: true; result: T } | { ok: false; error: string }> {
  try {
    const response = await fetchTelegram<T>(token, method, payload, timeoutMs);
    if (response.ok && response.result !== undefined) {
      return { ok: true, result: response.result };
    }
    return {
      ok: false,
      error: response.description ?? "unknown_error",
    };
  } catch (error) {
    const errorClass = classifyError(error);
    return {
      ok: false,
      error: `[${errorClass}] ${sanitizeErrorMessage(
        token,
        error instanceof Error ? error.message : String(error ?? "")
      )}`,
    };
  }
}
