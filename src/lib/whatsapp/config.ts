/**
 * Konfigurasi kanal WhatsApp (Fonnte).
 *
 * Modul ini hanya boleh diimpor di server. Token API tidak pernah dikirim ke
 * komponen client dan tidak pernah ditulis ke log.
 */

export interface FonnteConfig {
  token: string;
  apiUrl: string;
  countryCode: string;
  enabled: boolean;
}

const DEFAULT_API_URL = "https://api.fonnte.com/send";
const DEFAULT_COUNTRY_CODE = "62";

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function getAppUrl(): string {
  const fallback = "http://localhost:3000";
  const raw =
    readEnv("APP_URL") || readEnv("NEXT_PUBLIC_APP_URL") || readEnv("NEXTAUTH_URL") || fallback;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function getFonnteConfig(): FonnteConfig {
  const enabledValue = readEnv("FONNTE_NOTIFICATIONS_ENABLED").toLowerCase();

  return {
    token: readEnv("FONNTE_API_TOKEN"),
    apiUrl: readEnv("FONNTE_API_URL") || DEFAULT_API_URL,
    countryCode: normalizeCountryCode(readEnv("FONNTE_COUNTRY_CODE")),
    enabled: enabledValue !== "false" && enabledValue !== "0",
  };
}

export function normalizeCountryCode(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits || DEFAULT_COUNTRY_CODE;
}

/** Kanal siap mengirim pesan bila token tersedia dan fitur tidak dimatikan. */
export function isFonnteConfigured(): boolean {
  const config = getFonnteConfig();
  return config.enabled && Boolean(config.token);
}

/**
 * Normalisasi nomor WhatsApp ke format internasional tanpa tanda "+".
 * Contoh: "0812-3456-7890" -> "6281234567890".
 *
 * Mengembalikan null bila nomor tidak valid.
 */
export function normalizeWhatsappNumber(
  value: string | null | undefined,
  countryCode: string = getFonnteConfig().countryCode
): string | null {
  if (!value) return null;

  const cc = normalizeCountryCode(countryCode);
  let digits = value.trim().replace(/[^\d]/g, "");

  if (!digits) return null;

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("0")) {
    digits = `${cc}${digits.slice(1)}`;
  } else if (digits.startsWith(cc)) {
    // Sudah dalam format internasional.
  } else if (digits.startsWith("8")) {
    digits = `${cc}${digits}`;
  }

  // Panjang E.164 yang wajar (termasuk kode negara).
  if (!/^\d{8,15}$/.test(digits)) return null;
  if (!digits.startsWith(cc)) return null;

  return digits;
}

/** Masking nomor untuk tampilan UI/log: 6281234567890 -> +62••••••7890. */
export function maskWhatsappNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/[^\d]/g, "");
  if (digits.length <= 6) return "••••••";
  const prefix = digits.slice(0, 2);
  const suffix = digits.slice(-4);
  return `+${prefix}••••••${suffix}`;
}
