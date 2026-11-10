import { sendTelegramMessage } from "./bot-service";
import { buildReply, type TelegramIncomingMessage } from "./commands";
import { getTelegramConfig } from "./config";
import {
  fetchTelegram,
  describeError,
  classifyError,
} from "./transport";

const LONG_POLL_TIMEOUT_SECONDS = 25;
const IDLE_DELAY_MS = 1_000;
const BASE_ERROR_DELAY_MS = 2_000;
const MAX_ERROR_DELAY_MS = 30_000;

// Timeout per jenis operasi. getUpdates dengan long polling butuh waktu lebih
// lama karena Telegram menahan koneksi hingga 25 detik menunggu update.
const DELETE_WEBHOOK_TIMEOUT_MS = 15_000;
const GET_UPDATES_TIMEOUT_MS = 40_000;

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramIncomingMessage;
  edited_message?: TelegramIncomingMessage;
}

interface PollingRuntime {
  started?: boolean;
  offset?: number;
  running?: boolean;
  connected?: boolean;
}

const RUNTIME_KEY = "__cirebonTelegramPolling";

function runtime(): PollingRuntime {
  const holder = globalThis as typeof globalThis & {
    [RUNTIME_KEY]?: PollingRuntime;
  };
  holder[RUNTIME_KEY] ??= { offset: 0, running: false, connected: false };
  return holder[RUNTIME_KEY]!;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function preparePolling(token: string): Promise<boolean> {
  // getUpdates gagal (409) bila webhook masih aktif. Menghapus webhook juga
  // membuang update lama agar pesan /start yang sudah kedaluwarsa tidak
  // diproses ulang setiap server dinyalakan kembali.
  const result = await fetchTelegram<{ ok?: boolean; description?: string }>(
    token,
    "deleteWebhook",
    { drop_pending_updates: true },
    DELETE_WEBHOOK_TIMEOUT_MS
  );

  if (!result.ok) {
    console.warn(
      "[TELEGRAM_POLLING] Gagal menghapus webhook:",
      result.description ?? "unknown"
    );
    return false;
  }

  console.log("[TELEGRAM_POLLING] Konfigurasi webhook dihapus.");
  return true;
}

async function processUpdates(
  token: string,
  updates: TelegramUpdate[]
): Promise<void> {
  for (const update of updates) {
    const message = update.message ?? update.edited_message;
    if (!message) continue;

    try {
      const result = await buildReply(message);
      if (!result) continue;

      const sent = await sendTelegramMessage(result.chatId, result.reply);
      if (!sent.ok) {
        console.warn("[TELEGRAM_POLLING] Gagal mengirim balasan:", sent.error);
      }
    } catch (error) {
      console.error(
        "[TELEGRAM_POLLING] Gagal memproses update:",
        error instanceof Error ? error.message : String(error ?? "")
      );
    }
  }
}

async function loop(token: string): Promise<void> {
  const state = runtime();
  let backoffMs = BASE_ERROR_DELAY_MS;

  while (state.running) {
    try {
      const response = await fetchTelegram<TelegramUpdate[]>(
        token,
        "getUpdates",
        {
          offset: state.offset ?? 0,
          timeout: LONG_POLL_TIMEOUT_SECONDS,
          allowed_updates: ["message"],
        },
        GET_UPDATES_TIMEOUT_MS
      );

      if (!response.ok || !Array.isArray(response.result)) {
        console.warn(
          "[TELEGRAM_POLLING] getUpdates gagal:",
          response.description ?? "unknown"
        );
        backoffMs = Math.min(backoffMs * 2, MAX_ERROR_DELAY_MS);
        await delay(backoffMs);
        continue;
      }

      // Berhasil menerima respons dari Telegram (baik ada update atau tidak).
      // Reset backoff karena koneksi sehat.
      backoffMs = BASE_ERROR_DELAY_MS;

      if (response.result.length > 0) {
        const lastUpdateId =
          response.result[response.result.length - 1].update_id;
        if (typeof lastUpdateId === "number") {
          state.offset = lastUpdateId + 1;
        }

        await processUpdates(token, response.result);
        continue;
      }

      // Long polling kosong (tidak ada update) - normal, tunggu sejenak.
      await delay(IDLE_DELAY_MS);
    } catch (error) {
      const errorClass = classifyError(error);
      console.warn(
        `[TELEGRAM_POLLING] Koneksi gagal (${errorClass}):`,
        describeError(token, error)
      );

      // Exponential backoff: semakin lama gagal, semakin jarang retry.
      backoffMs = Math.min(backoffMs * 2, MAX_ERROR_DELAY_MS);
      await delay(backoffMs);
    }
  }
}

/**
 * Menjalankan polling getUpdates di background. Aman dipanggil berkali-kali;
 * hanya satu loop yang berjalan per proses.
 */
export function startTelegramPolling(): boolean {
  const config = getTelegramConfig();

  if (!config.usePolling || !config.enabled || !config.token) {
    return false;
  }

  const state = runtime();

  if (state.started) {
    return false;
  }

  state.started = true;
  state.running = true;

  void (async () => {
    // Ulangi persiapan jika Telegram belum bisa dihubungi.
    // Hanya lanjutkan ke loop setelah deleteWebhook berhasil,
    // yang berarti koneksi ke Telegram benar-benar tercapai.
    let prepBackoff = BASE_ERROR_DELAY_MS;
    while (state.running) {
      try {
        const prepared = await preparePolling(config.token);
        if (prepared) {
          state.connected = true;
          break;
        }
      } catch (error) {
        console.warn(
          "[TELEGRAM_POLLING] Persiapan koneksi gagal:",
          describeError(config.token, error)
        );
      }

      if (!state.running) return;
      prepBackoff = Math.min(prepBackoff * 2, MAX_ERROR_DELAY_MS);
      await delay(prepBackoff);
    }

    if (!state.running) return;

    // Status berhasil hanya dicetak setelah API benar-benar memberikan respons sukses.
    console.log("[TELEGRAM_POLLING] Berhasil terhubung ke Telegram.");
    console.log("[TELEGRAM_POLLING] Menunggu update...");

    // Loop sudah memiliki retry dengan exponential backoff.
    // Catch tambahan mencegah rejection keluar dari background task.
    while (state.running) {
      try {
        await loop(config.token);
      } catch (error) {
        console.error(
          "[TELEGRAM_POLLING] Polling berhenti karena error:",
          describeError(config.token, error)
        );

        if (!state.running) return;
        await delay(BASE_ERROR_DELAY_MS);
      }
    }
  })().catch((error) => {
    console.error(
      "[TELEGRAM_POLLING] Background task gagal:",
      describeError(config.token, error)
    );

    state.running = false;
    state.started = false;
    state.connected = false;
  });

  return true;
}

export function stopTelegramPolling(): void {
  const state = runtime();
  state.running = false;
  state.started = false;
  state.connected = false;
}

/** Mengambil dan memproses update sekali (dipakai endpoint /api/telegram/poll). */
export async function pollTelegramUpdatesOnce(): Promise<{
  processed: number;
  skipped: boolean;
}> {
  const config = getTelegramConfig();

  if (!config.usePolling || !config.enabled || !config.token) {
    return { processed: 0, skipped: true };
  }

  const state = runtime();
  const response = await fetchTelegram<TelegramUpdate[]>(
    config.token,
    "getUpdates",
    {
      offset: state.offset ?? 0,
      timeout: 0,
      allowed_updates: ["message"],
    },
    GET_UPDATES_TIMEOUT_MS
  );

  if (!response.ok || !Array.isArray(response.result) || response.result.length === 0) {
    return { processed: 0, skipped: false };
  }

  const lastUpdateId = response.result[response.result.length - 1].update_id;
  if (typeof lastUpdateId === "number") {
    state.offset = lastUpdateId + 1;
  }

  await processUpdates(config.token, response.result);
  return { processed: response.result.length, skipped: false };
}
