/**
 * Konfigurasi Telegram.
 *
 * Modul ini hanya boleh diimpor di server. Jangan pernah mengirim token bot
 * ke komponen client atau menuliskannya ke log.
 */

export interface TelegramConfig {
  token: string;
  username: string;
  webhookSecret: string;
  appUrl: string;
  enabled: boolean;
  usePolling?: boolean;
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function normalizeBotUsername(value: string): string {
  return value.trim().replace(/^@+/, "");
}

export function normalizeAppUrl(value: string): string {
  const fallback = "http://localhost:3000";
  const raw = value.trim() || fallback;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return fallback;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function getAppUrl(): string {
  return normalizeAppUrl(
    readEnv("APP_URL") || readEnv("NEXT_PUBLIC_APP_URL") || readEnv("NEXTAUTH_URL")
  );
}

export function getTelegramConfig(): TelegramConfig {
  const enabledValue = readEnv("TELEGRAM_NOTIFICATIONS_ENABLED").toLowerCase();
  const usePolling = readEnv("TELEGRAM_USE_POLLING").toLowerCase() === "true";

  return {
    token: readEnv("TELEGRAM_BOT_TOKEN"),
    username: normalizeBotUsername(readEnv("TELEGRAM_BOT_USERNAME")),
    webhookSecret: readEnv("TELEGRAM_WEBHOOK_SECRET"),
    appUrl: getAppUrl(),
    enabled: enabledValue !== "false" && enabledValue !== "0",
    usePolling,
  };
}

/** Bot siap mengirim pesan bila token tersedia dan fitur tidak dimatikan. */
export function isTelegramConfigured(): boolean {
  const config = getTelegramConfig();
  return config.enabled && Boolean(config.token);
}

/**
 * Penautan akun hanya bisa berhasil jika webhook sudah memiliki secret.
 * Tanpa secret, endpoint webhook sengaja menolak semua update (503), sehingga
 * bot tidak akan pernah membalas pesan /start.
 */
export function isTelegramWebhookConfigured(): boolean {
  // In polling mode webhook secret is not required
  if (getTelegramConfig().usePolling) return false;
  return isTelegramConfigured() && Boolean(getTelegramConfig().webhookSecret);
}

/**
 * Validasi URL bergantung pada mode yang digunakan.
 * - Polling mode: HTTP localhost diperbolehkan.
 * - Webhook mode: Wajib HTTPS publik.
 */
export function isAppUrlValidForTelegram(): { valid: boolean; message: string } {
  const config = getTelegramConfig();
  const url = config.appUrl;

  if (config.usePolling) {
    // Polling mode: HTTP localhost OK, https juga OK
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return { valid: true, message: "OK" };
      }
      return { valid: false, message: "Protocol tidak didukung" };
    } catch {
      return { valid: false, message: "URL tidak valid" };
    }
  }

  // Webhook mode: Wajib HTTPS publik, localhost ditolak
  if (isHttpsUrl(url)) {
    return { valid: true, message: "OK" };
  }
  if (isLocalhostUrl(url)) {
    return { valid: false, message: "URL localhost tidak dapat diakses Telegram untuk webhook. gunakan polling mode atau tunnel HTTPS." };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:") {
      return { valid: true, message: "OK" };
    }
    return { valid: false, message: "URL harus https: untuk mode webhook" };
  } catch {
    return { valid: false, message: "URL tidak valid" };
  }
}

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export function isLocalhostUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

/** Deep link aman ke bot. Token pengaitan dibuat di server dan berumur pendek. */
export function buildTelegramDeepLink(token: string): string | null {
  const { username } = getTelegramConfig();
  if (!username || !token) return null;
  return `https://t.me/${encodeURIComponent(username)}?start=${encodeURIComponent(token)}`;
}
