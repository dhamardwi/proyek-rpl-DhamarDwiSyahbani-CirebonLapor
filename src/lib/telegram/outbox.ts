import { after } from "next/server";
import db from "@/lib/db";
import { sendTelegramMessage } from "./bot-service";
import { isTelegramConfigured } from "./config";

export const TELEGRAM_MAX_ATTEMPTS = 3;
const CLAIM_LEASE_MS = 5 * 60 * 1000;
const RETRY_DELAYS_MS = [30_000, 2 * 60_000, 5 * 60_000];

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function retryDelay(attempt: number): number {
  return RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 5 * 60_000;
}

/**
 * Menambahkan pesan ke outbox. Outbox membuat pengiriman tidak memblokir
 * request utama, tahan terhadap kegagalan sementara, dan idempoten lewat
 * dedupeKey unik.
 */
export async function enqueueTelegramMessage(input: {
  userId?: string | null;
  chatId: string;
  text: string;
  dedupeKey: string;
}): Promise<boolean> {
  if (!isTelegramConfigured()) return false;

  try {
    await db.telegramOutbox.create({
      data: {
        userId: input.userId ?? null,
        chatId: input.chatId,
        message: input.text,
        dedupeKey: input.dedupeKey,
        // Gunakan jam proses ini agar konsisten dengan perbandingan due-time
        // di worker. Default `now()` SQLite dapat berbeda beberapa milidetik
        // dari `Date` Node dan membuat pesan baru sesekali terlihat belum due.
        nextAttemptAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    console.error("[TELEGRAM_OUTBOX_ENQUEUE_ERROR]", error instanceof Error ? error.message : "unknown");
    return false;
  }
}

/**
 * Mengantrekan pesan hanya jika pengguna sudah menautkan Telegram.
 * dedupeKey di-scope per pengguna agar event yang sama untuk beberapa
 * penerima tidak saling menimpa.
 */
export async function enqueueTelegramForUser(params: {
  userId: string;
  text: string;
  dedupeKey: string;
}): Promise<boolean> {
  if (!isTelegramConfigured()) return false;

  const link = await db.telegramLink.findUnique({
    where: { userId: params.userId },
    select: { chatId: true },
  });

  if (!link) return false;

  return enqueueTelegramMessage({
    userId: params.userId,
    chatId: link.chatId,
    text: params.text,
    dedupeKey: `${params.dedupeKey}:${params.userId}`,
  });
}

/**
 * Menjadwalkan pemrosesan setelah response selesai. Jika `after` tidak
 * tersedia (mis. dipanggil dari skrip), fallback ke fire-and-forget.
 * Set TELEGRAM_AUTO_PROCESS=false untuk mematikan otomatisasi (dipakai tes).
 */
export function scheduleTelegramOutboxProcessing(): void {
  if (process.env.TELEGRAM_AUTO_PROCESS === "false") return;

  try {
    after(async () => {
      await processTelegramOutbox();
    });
  } catch {
    void processTelegramOutbox().catch(() => {
      // Kegagalan outbox tidak boleh memengaruhi request utama.
    });
  }
}

/**
 * Mengirim pesan PENDING yang sudah jatuh tempo. Klaim dilakukan atomik
 * sehingga beberapa worker tidak mengirim pesan yang sama dua kali.
 */
export async function processTelegramOutbox(options?: { max?: number }): Promise<{
  sent: number;
  failed: number;
  retried: number;
}> {
  const max = Math.max(1, Math.min(options?.max ?? 10, 50));
  const now = new Date();

  // Pulihkan klaim yang macet (worker mati di tengah pengiriman).
  await db.telegramOutbox.updateMany({
    where: { status: "PROCESSING", nextAttemptAt: { lt: now } },
    data: { status: "PENDING" },
  });

  const candidates = await db.telegramOutbox.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      attempts: { lt: TELEGRAM_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: max,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const candidate of candidates) {
    const claimed = await db.telegramOutbox.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: {
        status: "PROCESSING",
        nextAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS),
      },
    });

    if (claimed.count !== 1) continue;

    const item = await db.telegramOutbox.findUnique({ where: { id: candidate.id } });
    if (!item) continue;

    // Hormati pemutusan koneksi: jangan kirim ke chat yang sudah dilepas.
    if (item.userId) {
      const stillLinked = await db.telegramLink.findFirst({
        where: { userId: item.userId, chatId: item.chatId },
        select: { id: true },
      });
      if (!stillLinked) {
        await db.telegramOutbox.update({
          where: { id: item.id },
          data: { status: "FAILED", lastError: "telegram_disconnected" },
        });
        failed += 1;
        continue;
      }
    }

    const result = await sendTelegramMessage(item.chatId, item.message);

    if (result.ok) {
      await db.telegramOutbox.update({
        where: { id: item.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          lastError: null,
        },
      });
      sent += 1;
      continue;
    }

    const attempts = item.attempts + 1;
    const terminal = !result.retryable || attempts >= TELEGRAM_MAX_ATTEMPTS;

    await db.telegramOutbox.update({
      where: { id: item.id },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        attempts,
        lastError: result.error,
        nextAttemptAt: terminal
          ? item.nextAttemptAt
          : new Date(Date.now() + retryDelay(attempts)),
      },
    });

    if (terminal) failed += 1;
    else retried += 1;
  }

  return { sent, failed, retried };
}
