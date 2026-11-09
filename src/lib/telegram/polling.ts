import { sendTelegramMessage } from "./bot-service";
import { buildReply, type TelegramIncomingMessage } from "./commands";
import { getTelegramConfig } from "./config";
import { processTelegramOutbox } from "./outbox";

const TELEGRAM_API_BASE = "https://api.telegram.org";
const LONG_POLL_TIMEOUT_SECONDS = 25;
const IDLE_DELAY_MS = 1_000;
const ERROR_DELAY_MS = 5_000;

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramIncomingMessage;
  edited_message?: TelegramIncomingMessage;
}

interface TelegramApiResponse<T> {
  ok?: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

interface PollingRuntime {
  started?: boolean;
  offset?: number;
  running?: boolean;
}

const RUNTIME_KEY = "__cirebonTelegramPolling";

function runtime(): PollingRuntime {
  const holder = globalThis as typeof globalThis & {
    [RUNTIME_KEY]?: PollingRuntime;
  };
  holder[RUNTIME_KEY] ??= { offset: 0, running: false };
  return holder[RUNTIME_KEY]!;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callApi<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>
): Promise<TelegramApiResponse<T>> {
  const response = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
    signal: AbortSignal.timeout((LONG_POLL_TIMEOUT_SECONDS + 20) * 1_000),
    cache: "no-store",
  });

  try {
    return (await response.json()) as TelegramApiResponse<T>;
  } catch {
    return { ok: false, description: `http_${response.status}` };
  }
}

async function preparePolling(token: string): Promise<void> {
  // getUpdates gagal (409) bila webhook masih aktif. Menghapus webhook juga
  // membuang update lama agar pesan /start yang sudah kedaluwarsa tidak
  // diproses ulang setiap server dinyalakan kembali.
  const result = await callApi(token, "deleteWebhook", {
    drop_pending_updates: true,
  });

  if (!result.ok) {
    console.warn(
      "[TELEGRAM_POLLING] Gagal menghapus webhook:",
      result.description ?? "unknown"
    );
  }
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
        error instanceof Error ? error.message : "unknown"
      );
    }
  }
}

let lastOutboxProcess = 0;
const OUTBOX_PROCESS_INTERVAL_MS = 30_000;

async function loop(token: string): Promise<void> {
  const state = runtime();

  while (state.running) {
    try {
      const response = await callApi<TelegramUpdate[]>(token, "getUpdates", {
        offset: state.offset ?? 0,
        timeout: LONG_POLL_TIMEOUT_SECONDS,
        allowed_updates: ["message"],
      });

      if (!response.ok || !Array.isArray(response.result)) {
        console.warn(
          "[TELEGRAM_POLLING] getUpdates gagal:",
          response.description ?? "unknown"
        );
        await delay(ERROR_DELAY_MS);
        continue;
      }

      if (response.result.length > 0) {
        const lastUpdateId = response.result[response.result.length - 1].update_id;
        if (typeof lastUpdateId === "number") {
          state.offset = lastUpdateId + 1;
        }

        await processUpdates(token, response.result);
        continue;
      }

      // Proses antrean outbox Telegram secara berkala saat idle,
      // sehingga notifikasi terkirim meskipun `after()` tidak terpicu.
      const now = Date.now();
      if (now - lastOutboxProcess >= OUTBOX_PROCESS_INTERVAL_MS) {
        lastOutboxProcess = now;
        try {
          await processTelegramOutbox({ max: 25 });
        } catch (error) {
          console.warn(
            "[TELEGRAM_POLLING] Gagal memproses outbox:",
            error instanceof Error ? error.message : "unknown"
          );
        }
      }

      await delay(IDLE_DELAY_MS);
    } catch (error) {
      // Pesan error fetch dapat memuat URL Bot API (termasuk token), jadi
      // jangan pernah mencetak objek error mentah.
      console.warn(
        "[TELEGRAM_POLLING] Koneksi ke Telegram gagal:",
        error instanceof Error ? error.name : "unknown"
      );
      await delay(ERROR_DELAY_MS);
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
    await preparePolling(config.token);

    if (!state.running) return;

    console.log("[TELEGRAM_POLLING] Aktif mengambil update dari Telegram.");
    await loop(config.token);
  })();

  return true;
}

export function stopTelegramPolling(): void {
  const state = runtime();
  state.running = false;
  state.started = false;
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
  const response = await callApi<TelegramUpdate[]>(config.token, "getUpdates", {
    offset: state.offset ?? 0,
    timeout: 0,
    allowed_updates: ["message"],
  });

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
