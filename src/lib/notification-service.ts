import { randomUUID } from "crypto";
import db from "./db";
import { formatGenericMessage } from "./whatsapp/messages";
import {
  enqueueWhatsappForUser,
  scheduleWhatsappOutboxProcessing,
} from "./whatsapp/outbox";

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
   * Teks WhatsApp (plain text). Jika dihilangkan, notifikasi in-app dipakai
   * sebagai fallback. Set `false` untuk event yang tidak perlu dikirim ke
   * WhatsApp.
   */
  whatsapp?: { text: string } | false;
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
 * memverifikasi nomor WhatsApp, mengantrekannya ke outbox WhatsApp.
 *
 * Semua kegagalan kanal WhatsApp bersifat fail-open: transaksi bisnis utama
 * tidak pernah dibatalkan oleh notifikasi.
 */
export async function createNotification({
  userId,
  title,
  message,
  link,
  dedupeKey,
  whatsapp,
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

  if (whatsapp === false) return;

  try {
    const text =
      whatsapp?.text ??
      formatGenericMessage({ title, message, linkPath: link });

    if (!text.trim()) return;

    const enqueued = await enqueueWhatsappForUser({
      userId,
      text,
      dedupeKey: eventKey ?? `notification:${randomUUID()}`,
    });

    if (enqueued) scheduleWhatsappOutboxProcessing();
  } catch (error) {
    // Jangan log payload pesan atau nomor telepon.
    console.error(
      "[WHATSAPP_NOTIFICATION_ENQUEUE_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
  }
}
