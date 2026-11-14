import { after } from "next/server";
import db from "@/lib/db";
import { sendWhatsappMessage } from "./fonnte-service";
import { isFonnteConfigured } from "./config";

export const WHATSAPP_MAX_ATTEMPTS = 3;
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
export async function enqueueWhatsappMessage(input: {
  userId?: string | null;
  phoneNumber: string;
  text: string;
  dedupeKey: string;
}): Promise<boolean> {
  if (!isFonnteConfigured()) return false;

  try {
    await db.whatsappOutbox.create({
      data: {
        userId: input.userId ?? null,
        phoneNumber: input.phoneNumber,
        message: input.text,
        dedupeKey: input.dedupeKey,
        nextAttemptAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    console.error(
      "[WHATSAPP_OUTBOX_ENQUEUE_ERROR]",
      error instanceof Error ? error.message : "unknown"
    );
    return false;
  }
}

/**
 * Mengantrekan pesan hanya jika pengguna memiliki nomor WhatsApp aktif.
 * dedupeKey di-scope per pengguna agar event yang sama untuk beberapa
 * penerima tidak saling menimpa.
 *
 * Notifikasi WhatsApp tidak didukung untuk role ADMIN dan PETUGAS.
 */
export async function enqueueWhatsappForUser(params: {
  userId: string;
  text: string;
  dedupeKey: string;
}): Promise<boolean> {
  if (!isFonnteConfigured()) return false;

  const link = await db.whatsappLink.findUnique({
    where: { userId: params.userId },
    select: { phoneNumber: true, user: { select: { role: true, isActive: true } } },
  });

  if (!link) return false;
  if (link.user.role !== "MASYARAKAT" || !link.user.isActive) return false;

  return enqueueWhatsappMessage({
    userId: params.userId,
    phoneNumber: link.phoneNumber,
    text: params.text,
    dedupeKey: `${params.dedupeKey}:${params.userId}`,
  });
}

/**
 * Menjadwalkan pemrosesan setelah response selesai. Jika `after` tidak
 * tersedia (mis. dipanggil dari skrip), fallback ke fire-and-forget.
 * Set WHATSAPP_AUTO_PROCESS=false untuk mematikan otomatisasi (dipakai tes).
 */
export function scheduleWhatsappOutboxProcessing(): void {
  if (process.env.WHATSAPP_AUTO_PROCESS === "false") return;

  try {
    after(async () => {
      await processWhatsappOutbox();
    });
  } catch {
    void processWhatsappOutbox().catch(() => {
      // Kegagalan outbox tidak boleh memengaruhi request utama.
    });
  }
}

/**
 * Mengirim pesan PENDING yang sudah jatuh tempo. Klaim dilakukan atomik
 * sehingga beberapa worker tidak mengirim pesan yang sama dua kali.
 */
export async function processWhatsappOutbox(options?: { max?: number }): Promise<{
  sent: number;
  failed: number;
  retried: number;
}> {
  const max = Math.max(1, Math.min(options?.max ?? 10, 50));
  const now = new Date();

  // Pulihkan klaim yang macet (worker mati di tengah pengiriman).
  await db.whatsappOutbox.updateMany({
    where: { status: "PROCESSING", nextAttemptAt: { lt: now } },
    data: { status: "PENDING" },
  });

  const candidates = await db.whatsappOutbox.findMany({
    where: {
      status: "PENDING",
      nextAttemptAt: { lte: now },
      attempts: { lt: WHATSAPP_MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "asc" },
    take: max,
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  let retried = 0;

  for (const candidate of candidates) {
    const claimed = await db.whatsappOutbox.updateMany({
      where: { id: candidate.id, status: "PENDING" },
      data: {
        status: "PROCESSING",
        nextAttemptAt: new Date(Date.now() + CLAIM_LEASE_MS),
      },
    });

    if (claimed.count !== 1) continue;

    const item = await db.whatsappOutbox.findUnique({ where: { id: candidate.id } });
    if (!item) continue;

    // Hormati pemutusan/penggantian nomor: jangan kirim ke nomor yang tidak
    // lagi aktif untuk pengguna tersebut.
    if (item.userId) {
      const stillLinked = await db.whatsappLink.findFirst({
        where: { userId: item.userId, phoneNumber: item.phoneNumber },
        select: { id: true },
      });
      if (!stillLinked) {
        await db.whatsappOutbox.update({
          where: { id: item.id },
          data: { status: "FAILED", lastError: "whatsapp_disconnected" },
        });
        failed += 1;
        continue;
      }
    }

    const result = await sendWhatsappMessage(item.phoneNumber, item.message);

    if (result.ok) {
      await db.whatsappOutbox.update({
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
    const terminal = !result.retryable || attempts >= WHATSAPP_MAX_ATTEMPTS;

    await db.whatsappOutbox.update({
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
