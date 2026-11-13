import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAiProviderStatuses } from "@/lib/ai/config";
import AISettings from "@/components/settings/AISettings";

export const metadata = {
  title: "Konfigurasi AI - CirebonLapor",
  description: "Kelola konfigurasi NVIDIA NIM untuk chatbot",
};

export const dynamic = "force-dynamic";

export default async function AISettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/settings/ai");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const providers = await getAiProviderStatuses();

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Pengaturan Sistem</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Konfigurasi AI</h1>
        <p className="max-w-3xl text-sm text-slate-500 sm:text-base">
          Atur API key, endpoint, dan model yang dipakai chatbot CirebonLapor. API key disimpan terenkripsi dan tidak pernah dikirim ke browser.
        </p>
      </div>

      <AISettings initialProviders={providers} />
    </div>
  );
}
