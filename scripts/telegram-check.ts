/**
 * Diagnostik konfigurasi Telegram (tidak pernah mencetak token).
 *
 * Pemakaian:
 *   npm run telegram:check
 *   npm run telegram:check -- --url https://domain-anda
 */

import "./load-env";
import {
  getTelegramConfig,
  isHttpsUrl,
  isLocalhostUrl,
  normalizeAppUrl,
} from "../src/lib/telegram/config";
import { fetchTelegram } from "../src/lib/telegram/transport";

interface TelegramApiResult<T> {
  ok?: boolean;
  result?: T;
  description?: string;
}

interface BotInfo {
  id: number;
  username?: string;
}

interface WebhookInfo {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
  allowed_updates?: string[];
}

function readUrlOverride(): string | null {
  const inline = process.argv.find((arg) => arg.startsWith("--url="));
  if (inline) return inline.slice("--url=".length);

  const index = process.argv.indexOf("--url");
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];

  return null;
}

async function callApi<T>(
  token: string,
  method: string
): Promise<TelegramApiResult<T>> {
  const result = await fetchTelegram<T>(token, method, undefined, 20_000);
  return {
    ok: result.ok,
    result: result.result,
    description: result.ok ? undefined : result.description,
  };
}

async function main() {
  const config = getTelegramConfig();
  const urlOverride = readUrlOverride();
  const baseUrl = urlOverride ? normalizeAppUrl(urlOverride) : config.appUrl;
  const expectedUrl = baseUrl.endsWith("/api/telegram/webhook")
    ? baseUrl
    : `${baseUrl}/api/telegram/webhook`;

  console.log("== Konfigurasi ==");
  console.log(`Token bot: ${config.token ? "terisi" : "KOSONG"}`);
  console.log(`Username bot: ${config.username ? `@${config.username}` : "KOSONG"}`);
  console.log(`Notifikasi aktif: ${config.enabled ? "ya" : "tidak"}`);
  console.log(`Mode: ${config.usePolling ? "polling (getUpdates)" : "webhook"}`);
  console.log(`Webhook secret: ${config.webhookSecret ? "terisi" : "KOSONG"}`);
  console.log(`APP_URL: ${config.appUrl}`);
  console.log(`URL webhook yang diharapkan: ${expectedUrl}`);

  if (!config.token) {
    console.log("\nWebhook belum bisa diperiksa karena token bot kosong.");
    return;
  }

  console.log("\n== Telegram API ==");

  const me = await callApi<BotInfo>(config.token, "getMe");
  if (!me.ok || !me.result) {
    console.log(`getMe gagal: ${me.description ?? "unknown"}`);
    return;
  }
  console.log(`Bot valid: @${me.result.username ?? "(tanpa username)"} (id ${me.result.id})`);

  const info = await callApi<WebhookInfo>(config.token, "getWebhookInfo");
  if (!info.ok || !info.result) {
    console.log(`getWebhookInfo gagal: ${info.description ?? "unknown"}`);
    return;
  }

  const registeredUrl = info.result.url ?? "";
  console.log(`Webhook terdaftar: ${registeredUrl || "BELUM ADA"}`);
  console.log(`Update tertunda: ${info.result.pending_update_count ?? 0}`);

  if (info.result.last_error_message) {
    const date = info.result.last_error_date
      ? new Date(info.result.last_error_date * 1000).toLocaleString("id-ID")
      : "tidak diketahui";
    console.log(`Error terakhir (${date}): ${info.result.last_error_message}`);
  }

  console.log("\n== Kesimpulan ==");

  if (config.usePolling) {
    if (registeredUrl) {
      console.log(
        "PERINGATAN: masih ada webhook terdaftar. Polling akan menghapusnya otomatis saat server dinyalakan."
      );
    } else {
      console.log("OK: mode polling aktif dan webhook tidak diperlukan.");
    }
  } else {
    if (!config.webhookSecret) {
      console.log(
        "GAGAL: TELEGRAM_WEBHOOK_SECRET kosong. Endpoint webhook akan menolak update (503)."
      );
    }
    if (!isHttpsUrl(expectedUrl) || isLocalhostUrl(expectedUrl)) {
      console.log(
        "GAGAL: APP_URL harus berupa URL publik HTTPS. Telegram tidak dapat memanggil localhost."
      );
    }
    if (!registeredUrl) {
      console.log(
        "GAGAL: webhook belum didaftarkan. Jalankan `npm run telegram:webhook` setelah APP_URL publik HTTPS diatur."
      );
    } else if (registeredUrl !== expectedUrl) {
      console.log(
        "PERINGATAN: URL webhook terdaftar berbeda dari APP_URL. Daftarkan ulang dengan `npm run telegram:webhook`."
      );
    } else {
      console.log("OK: URL webhook sudah sesuai.");
    }
  }

  if (registeredUrl && !info.result.last_error_message) {
    console.log("OK: belum ada error pengiriman update dari Telegram.");
  }
}

main().catch((error) => {
  console.error(
    "[TELEGRAM_CHECK_ERROR]",
    error instanceof Error ? error.message : "unknown"
  );
  process.exit(1);
});
