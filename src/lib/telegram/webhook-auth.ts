import { timingSafeEqual } from "crypto";

/**
 * Perbandingan constant-time untuk secret token webhook Telegram.
 * Secret kosong selalu ditolak agar deployment yang salah konfigurasi tidak
 * membuka endpoint webhook tanpa autentikasi.
 */
export function isValidWebhookSecret(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) return false;

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
