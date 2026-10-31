/**
 * Dijalankan sekali saat server Next.js dinyalakan.
 *
 * Bila TELEGRAM_USE_POLLING=true, bot mengambil update lewat getUpdates di
 * background sehingga perintah /start langsung dibalas tanpa webhook publik.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startTelegramPolling } = await import("./lib/telegram/polling");
  startTelegramPolling();
}
