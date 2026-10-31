import { createHash, randomBytes } from "crypto";
import db from "@/lib/db";

export const TELEGRAM_LINK_TOKEN_TTL_MS = 10 * 60 * 1000;

export type TelegramLinkErrorCode =
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "USED_TOKEN"
  | "CHAT_ALREADY_LINKED"
  | "USER_NOT_FOUND";

export class TelegramLinkError extends Error {
  constructor(
    public readonly code: TelegramLinkErrorCode,
    message: string
  ) {
    super(message);
    this.name = "TelegramLinkError";
  }
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function isValidRawToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{20,200}$/.test(token);
}

/**
 * Membuat token satu kali pakai. Yang disimpan hanya hash SHA-256, bukan
 * token asli, sehingga kebocoran database tidak langsung memberi akses.
 */
export async function createLinkToken(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true },
  });

  if (!user || !user.isActive) {
    throw new TelegramLinkError("USER_NOT_FOUND", "Akun tidak tersedia.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TELEGRAM_LINK_TOKEN_TTL_MS);

  await db.$transaction([
    // Satu pengguna hanya punya satu tautan aktif pada satu waktu.
    db.telegramLinkToken.deleteMany({
      where: { userId, usedAt: null },
    }),
    db.telegramLinkToken.create({
      data: {
        userId,
        tokenHash: hashToken(rawToken),
        expiresAt,
      },
    }),
  ]);

  return { token: rawToken, expiresAt };
}

export interface ConsumeLinkResult {
  userId: string;
  userName: string;
  role: string;
}

/**
 * Memverifikasi token lalu menautkan chat Telegram ke akun pemilik token.
 * Token tidak pernah menentukan userId dari input Telegram; userId selalu
 * berasal dari baris token di database.
 */
export async function consumeLinkToken(input: {
  token: string;
  chatId: string;
  telegramUsername?: string | null;
}): Promise<ConsumeLinkResult> {
  const rawToken = input.token.trim();
  const chatId = input.chatId.trim();

  if (!isValidRawToken(rawToken) || !/^-?\d{1,25}$/.test(chatId)) {
    throw new TelegramLinkError("INVALID_TOKEN", "Tautan tidak valid.");
  }

  const tokenHash = hashToken(rawToken);

  return db.$transaction(async (tx) => {
    const stored = await tx.telegramLinkToken.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, name: true, role: true, isActive: true } },
      },
    });

    if (!stored) {
      throw new TelegramLinkError("INVALID_TOKEN", "Tautan tidak valid.");
    }
    if (stored.usedAt) {
      throw new TelegramLinkError(
        "USED_TOKEN",
        "Tautan ini sudah pernah digunakan."
      );
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new TelegramLinkError(
        "EXPIRED_TOKEN",
        "Tautan sudah kedaluwarsa."
      );
    }
    if (!stored.user.isActive) {
      throw new TelegramLinkError("USER_NOT_FOUND", "Akun tidak aktif.");
    }

    const existingChat = await tx.telegramLink.findUnique({
      where: { chatId },
      select: { userId: true },
    });

    if (existingChat && existingChat.userId !== stored.userId) {
      throw new TelegramLinkError(
        "CHAT_ALREADY_LINKED",
        "Akun Telegram ini sudah terhubung ke akun aplikasi lain."
      );
    }

    // Klaim token secara atomik: dua request paralel tidak bisa sama-sama sukses.
    const claimed = await tx.telegramLinkToken.updateMany({
      where: {
        id: stored.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (claimed.count !== 1) {
      throw new TelegramLinkError(
        "USED_TOKEN",
        "Tautan ini sudah pernah digunakan."
      );
    }

    await tx.telegramLink.upsert({
      where: { userId: stored.userId },
      update: {
        chatId,
        username: input.telegramUsername?.trim() || null,
        connectedAt: new Date(),
      },
      create: {
        userId: stored.userId,
        chatId,
        username: input.telegramUsername?.trim() || null,
      },
    });

    // Sisa tautan lama milik user ini tidak boleh bisa dipakai lagi.
    await tx.telegramLinkToken.deleteMany({
      where: { userId: stored.userId, usedAt: null },
    });

    return {
      userId: stored.user.id,
      userName: stored.user.name,
      role: stored.user.role,
    };
  });
}

export function maskChatId(chatId: string): string {
  const suffix = chatId.slice(-4);
  return `••••${suffix}`;
}

export async function getTelegramStatus(userId: string) {
  const link = await db.telegramLink.findUnique({
    where: { userId },
    select: {
      chatId: true,
      username: true,
      connectedAt: true,
    },
  });

  if (!link) {
    return { connected: false as const };
  }

  return {
    connected: true as const,
    maskedChatId: maskChatId(link.chatId),
    telegramUsername: link.username,
    connectedAt: link.connectedAt.toISOString(),
  };
}

export async function disconnectTelegram(userId: string): Promise<number> {
  const result = await db.telegramLink.deleteMany({ where: { userId } });
  return result.count;
}

export async function disconnectByChatId(chatId: string): Promise<{
  disconnected: boolean;
  userName?: string;
}> {
  const link = await db.telegramLink.findUnique({
    where: { chatId },
    select: { userId: true, user: { select: { name: true } } },
  });

  if (!link) return { disconnected: false };

  await db.telegramLink.deleteMany({ where: { userId: link.userId } });
  return { disconnected: true, userName: link.user.name };
}

export async function findLinkByChatId(chatId: string) {
  return db.telegramLink.findUnique({
    where: { chatId },
    select: {
      userId: true,
      user: { select: { name: true, role: true } },
    },
  });
}
