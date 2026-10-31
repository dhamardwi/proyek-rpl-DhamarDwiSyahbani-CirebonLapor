import { randomUUID } from "crypto";
import db from "./db";
import { formatGenericMessage } from "./telegram/messages";
import {
  enqueueTelegramForUser,
  scheduleTelegramOutboxProcessing,
} from "./telegram/outbox";

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  link?: string;
  /**
   * Kunci idempotensi per event. Penerima otomatis ditambahkan ke kunci,
   * sehingga satu event hanya menghasilkan satu notifikasi per pengguna.
   */
  dedupeKey?: string;
  /**
   * Teks Telegram (HTML). Jika dihilangkan, notifikasi in-app dipakai sebagai
   * fallback. Set `false` untuk event yang tidak perlu dikirim ke Telegram.
   */
  telegram?: { text: string } | false;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

/**
 * Menyimpan notifikasi in-app (perilaku lama) dan, bila pengguna sudah
 * menautkan Telegram, mengantrekannya ke outbox Telegram.
 *
 * Semua kegagalan kanal Telegram bersifat fail-open: transaksi bisnis utama
 * tidak pernah dibatalkan oleh notifikasi.
 */
export async function createNotification({
  userId,
  title,
  message,
  link,
  dedupeKey,
  telegram,
}: CreateNotificationInput): Promise<void> {
  const eventKey = dedupeKey ? `${dedupeKey}:${userId}` : null;

  try {
    if (eventKey) {
      const existing = await db.notification.findUnique({ where: { eventKey } });
      if (existing) return;
    }

    await db.notification.create({
      data: {
        userId,
        title,
        message,
        link,
        eventKey,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) return;
    console.error("[CREATE_NOTIFICATION_ERROR]", error);
    return;
  }

  if (telegram === false) return;

  try {
    const text =
      telegram?.text ??
      formatGenericMessage({ title, message, linkPath: link });

    if (!text.trim()) return;

    const enqueued = await enqueueTelegramForUser({
      userId,
      text,
      dedupeKey: eventKey ?? `notification:${randomUUID()}`,
    });

    if (enqueued) scheduleTelegramOutboxProcessing();
  } catch (error) {
    // Jangan log payload pesan atau chat ID.
    console.error(
      "[TELEGRAM_NOTIFICATION_ENQUEUE_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
  }
}
