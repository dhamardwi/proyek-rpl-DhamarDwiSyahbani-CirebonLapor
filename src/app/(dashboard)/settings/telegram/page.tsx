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
  if (session.user.role === "ADMIN" || session.user.role === "PETUGAS") {
    redirect(`/dashboard/${(session.user.role ?? "admin").toLowerCase()}`);
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
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Pengaturan Akun</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Pengaturan Telegram</h1>
        <p className="max-w-3xl text-sm text-slate-500 sm:text-base">
          Hubungkan akun Telegram pribadi untuk menerima notifikasi laporan sesuai peran Anda.
        </p>
      </div>

      <TelegramSettings initialData={initialData} />
    </div>
  );
}
