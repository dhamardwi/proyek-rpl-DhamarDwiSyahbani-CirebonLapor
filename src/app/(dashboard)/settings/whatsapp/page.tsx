import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isFonnteConfigured } from "@/lib/whatsapp/config";
import { getWhatsappStatus } from "@/lib/whatsapp/linking";
import WhatsAppSettings, {
  type WhatsappSettingsData,
} from "@/components/settings/WhatsAppSettings";

export const metadata = {
  title: "Pengaturan WhatsApp - CirebonLapor",
  description: "Hubungkan nomor WhatsApp untuk menerima notifikasi laporan",
};

export const dynamic = "force-dynamic";

export default async function WhatsappSettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/settings/whatsapp");
  }
  if (session.user.role === "ADMIN") {
    redirect("/admin/whatsapp");
  }
  if (session.user.role === "PETUGAS") {
    redirect("/dashboard/petugas");
  }

  const status = await getWhatsappStatus(session.user.id);

  const initialData: WhatsappSettingsData = {
    ...status,
    configured: isFonnteConfigured(),
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">
          Pengaturan Akun
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Pengaturan WhatsApp
        </h1>
        <p className="max-w-3xl text-sm text-slate-500 sm:text-base">
          Daftarkan nomor WhatsApp pribadi untuk menerima notifikasi laporan sesuai peran Anda.
        </p>
      </div>

      <WhatsAppSettings initialData={initialData} />
    </div>
  );
}
