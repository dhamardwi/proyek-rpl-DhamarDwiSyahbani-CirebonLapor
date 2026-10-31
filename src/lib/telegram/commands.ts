import { getAppUrl } from "./config";
import {
  consumeLinkToken,
  disconnectByChatId,
  findLinkByChatId,
  TelegramLinkError,
} from "./linking";
import { escapeHtml } from "./messages";

export interface TelegramIncomingMessage {
  text?: string;
  chat?: { id?: number | string; username?: string };
  from?: { username?: string };
}

export interface ParsedTelegramCommand {
  chatId: string;
  text: string;
  command: string;
  args: string[];
  telegramUsername?: string;
}

const ROLE_LABELS: Record<string, string> = {
  MASYARAKAT: "Masyarakat",
  PETUGAS: "Petugas",
  ADMIN: "Admin",
};

function settingsUrl(): string {
  return `${getAppUrl()}/settings/telegram`;
}

export function instructions(name?: string): string {
  const greeting = name ? `Halo ${escapeHtml(name)}!` : "Halo!";
  return [
    `👋 <b>CirebonLapor</b>`,
    "",
    `${greeting} Bot ini mengirim notifikasi laporan fasilitas umum sesuai akun Anda.`,
    "",
    "Untuk menghubungkan akun, buka:",
    `<a href="${escapeHtml(settingsUrl())}">Pengaturan Telegram</a>`,
    "",
    "Perintah tersedia:",
    "/start - petunjuk penggunaan",
    "/status - cek status koneksi",
    "/disconnect - putuskan koneksi Telegram",
  ].join("\n");
}

export async function handleStart(
  chatId: string,
  token: string | undefined,
  telegramUsername?: string
): Promise<string> {
  if (!token) {
    const link = await findLinkByChatId(chatId);
    if (link) {
      return handleStatus(chatId);
    }
    return instructions();
  }

  try {
    const result = await consumeLinkToken({ token, chatId, telegramUsername });
    const role = ROLE_LABELS[result.role] ?? result.role;

    return [
      "✅ <b>Akun berhasil terhubung</b>",
      "",
      `Halo ${escapeHtml(result.userName)}, akun CirebonLapor Anda (${escapeHtml(role)}) kini terhubung dengan Telegram ini.`,
      "",
      "Notifikasi akan dikirim sesuai peran dan laporan yang menjadi hak akses Anda.",
      "",
      "Perintah tersedia:",
      "/status - cek status koneksi",
      "/disconnect - putuskan koneksi",
    ].join("\n");
  } catch (error) {
    if (error instanceof TelegramLinkError) {
      const reason =
        error.code === "CHAT_ALREADY_LINKED"
          ? "Akun Telegram ini sudah terhubung ke akun aplikasi lain."
          : "Tautan tidak valid, sudah digunakan, atau sudah kedaluwarsa.";

      return [
        `❌ <b>Gagal menghubungkan</b>`,
        "",
        escapeHtml(reason),
        "",
        "Silakan buat tautan baru dari halaman pengaturan:",
        `<a href="${escapeHtml(settingsUrl())}">Pengaturan Telegram</a>`,
      ].join("\n");
    }
    throw error;
  }
}

export async function handleStatus(chatId: string): Promise<string> {
  const link = await findLinkByChatId(chatId);
  if (!link) {
    return instructions();
  }

  const role = ROLE_LABELS[link.user.role] ?? link.user.role;
  return [
    "✅ <b>Telegram terhubung</b>",
    "",
    `Akun: ${escapeHtml(link.user.name)} (${escapeHtml(role)})`,
    "",
    "Gunakan /disconnect jika ingin memutuskan koneksi.",
  ].join("\n");
}

export async function handleDisconnect(chatId: string): Promise<string> {
  const result = await disconnectByChatId(chatId);

  if (!result.disconnected) {
    return "ℹ️ Telegram ini belum terhubung ke akun CirebonLapor mana pun.";
  }

  return [
    "✅ <b>Koneksi diputuskan</b>",
    "",
    `Telegram ini tidak lagi menerima notifikasi untuk akun ${escapeHtml(result.userName ?? "Anda")}.`,
    "",
    "Anda dapat menghubungkan kembali melalui halaman pengaturan aplikasi.",
  ].join("\n");
}

export function parseTelegramMessage(
  message: TelegramIncomingMessage | undefined
): ParsedTelegramCommand | null {
  const chatId = message?.chat?.id != null ? String(message.chat.id) : null;
  const text = message?.text?.trim();

  if (!chatId || !text) return null;

  const [rawCommand, ...args] = text.split(/\s+/);
  return {
    chatId,
    text,
    command: (rawCommand ?? "").split("@")[0].toLowerCase(),
    args,
    telegramUsername: message?.chat?.username ?? message?.from?.username,
  };
}

/** Menyusun balasan untuk satu pesan masuk Telegram. */
export async function buildReply(message: TelegramIncomingMessage): Promise<{
  chatId: string;
  reply: string;
} | null> {
  const parsed = parseTelegramMessage(message);
  if (!parsed) return null;

  let reply: string;

  if (parsed.command === "/start") {
    reply = await handleStart(parsed.chatId, parsed.args[0], parsed.telegramUsername);
  } else if (parsed.command === "/status") {
    reply = await handleStatus(parsed.chatId);
  } else if (parsed.command === "/disconnect") {
    reply = await handleDisconnect(parsed.chatId);
  } else {
    reply = instructions();
  }

  return { chatId: parsed.chatId, reply };
}
