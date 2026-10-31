import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  getTelegramConfig,
  isHttpsUrl,
  isLocalhostUrl,
  isTelegramConfigured,
  isTelegramWebhookConfigured,
} from "@/lib/telegram/config";
import { getTelegramStatus } from "@/lib/telegram/linking";
import TelegramSettings, {
  type TelegramSettingsData,
} from "@/components/settings/TelegramSettings";

export const metadata = {
  title: "Pengaturan Telegram - CirebonLapor",
  description: "Hubungkan akun Telegram untuk menerima notifikasi laporan",
};

export const dynamic = "force-dynamic";

export default async function TelegramSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/settings/telegram");
  }

  const [status, config] = await Promise.all([
    getTelegramStatus(session.user.id),
    Promise.resolve(getTelegramConfig()),
  ]);

  const initialData: TelegramSettingsData = {
    ...status,
    configured: isTelegramConfigured(),
    webhookConfigured: isTelegramWebhookConfigured(),
    usePolling: config.usePolling === true,
    appUrl: config.appUrl,
    appUrlIsHttps: isHttpsUrl(config.appUrl),
    appUrlIsLocalhost: isLocalhostUrl(config.appUrl),
    botUsername: config.username || null,
    tokenTtlMinutes: 10,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Pengaturan Telegram</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-2">
          Hubungkan akun Telegram pribadi untuk menerima notifikasi laporan sesuai peran Anda.
        </p>
      </div>

      <TelegramSettings initialData={initialData} role={session.user.role ?? "MASYARAKAT"} />
    </div>
  );
}
