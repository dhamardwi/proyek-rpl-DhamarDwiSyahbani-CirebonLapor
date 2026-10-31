/**
 * Mendaftarkan webhook Telegram.
 *
 * Pemakaian:
 *   npm run telegram:webhook
 *   npm run telegram:webhook:delete
 *
 * Token bot dibaca dari environment dan tidak pernah dicetak ke console.
 */
import "./load-env";
import {
  getTelegramConfig,
  isHttpsUrl,
  isLocalhostUrl,
  normalizeAppUrl,
} from "../src/lib/telegram/config";

function readUrlOverride(): string | null {
  const inline = process.argv.find((arg) => arg.startsWith("--url="));
  if (inline) return inline.slice("--url=".length);

  const index = process.argv.indexOf("--url");
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];

  return null;
}

async function main() {
  const config = getTelegramConfig();
  const { token, webhookSecret } = config;
  const remove = process.argv.includes("--delete");
  const urlOverride = readUrlOverride();
  const baseUrl = urlOverride ? normalizeAppUrl(urlOverride) : config.appUrl;
  const webhookUrl = baseUrl.endsWith("/api/telegram/webhook")
    ? baseUrl
    : `${baseUrl}/api/telegram/webhook`;

  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN belum diisi.");
  }

  const method = remove ? "deleteWebhook" : "setWebhook";
  const body: Record<string, unknown> = remove
    ? { drop_pending_updates: false }
    : {
        url: webhookUrl,
        secret_token: webhookSecret,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      };

  if (!remove) {
    if (!webhookSecret || webhookSecret.length < 16) {
      throw new Error(
        "TELEGRAM_WEBHOOK_SECRET wajib diisi dan minimal 16 karakter sebelum mendaftarkan webhook."
      );
    }
    if (!isHttpsUrl(webhookUrl) || isLocalhostUrl(webhookUrl)) {
      throw new Error(
        `Webhook Telegram memerlukan URL publik HTTPS, bukan ${webhookUrl}. ` +
          "Gunakan tunnel (mis. cloudflared/ngrok) atau URL deployment, lalu jalankan " +
          "`npm run telegram:webhook -- --url https://domain-anda`."
      );
    }
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload: { ok?: boolean; description?: string } = {};
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    // Abaikan body yang bukan JSON.
  }

  if (!response.ok || !payload.ok) {
    throw new Error(payload.description || `Telegram API HTTP ${response.status}`);
  }

  if (remove) {
    console.log("Webhook Telegram berhasil dihapus.");
  } else {
    console.log(`Webhook Telegram terdaftar di ${webhookUrl}`);
    console.log("Pastikan URL tersebut dapat diakses publik melalui HTTPS.");
  }
}

main().catch((error) => {
  console.error(
    "[TELEGRAM_SET_WEBHOOK_ERROR]",
    error instanceof Error ? error.message : "unknown"
  );
  process.exit(1);
});
