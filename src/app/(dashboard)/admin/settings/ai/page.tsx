import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getAiProviderStatuses } from "@/lib/ai/config";
import AISettings from "@/components/settings/AISettings";

export const metadata = {
  title: "Konfigurasi AI - CirebonLapor",
  description: "Kelola konfigurasi NVIDIA NIM dan Google Gemini",
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
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Konfigurasi AI</h1>
        <p className="text-sm text-slate-500 mt-1">
          Atur API key, endpoint, dan model yang dipakai chatbot serta analisis laporan.
          API key disimpan terenkripsi dan tidak pernah dikirim ke browser.
        </p>
      </div>

      <AISettings initialProviders={providers} />
    </div>
  );
}
