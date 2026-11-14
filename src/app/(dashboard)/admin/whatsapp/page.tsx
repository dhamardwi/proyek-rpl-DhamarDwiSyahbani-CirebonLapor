import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listRegistrations } from "@/lib/whatsapp/linking";
import WhatsappRegistrationsClient from "./RegistrationsClient";

export const metadata = {
  title: "Persetujuan WhatsApp - CirebonLapor",
  description: "Tinjau dan setujui pengajuan nomor WhatsApp pengguna",
};

export const dynamic = "force-dynamic";

export default async function WhatsappRegistrationsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/whatsapp");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const initialRegistrations = await listRegistrations({ status: "PENDING" });

  return <WhatsappRegistrationsClient initialRegistrations={initialRegistrations} />;
}
