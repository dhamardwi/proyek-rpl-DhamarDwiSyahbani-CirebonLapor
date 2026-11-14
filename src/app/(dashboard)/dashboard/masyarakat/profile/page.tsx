import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { maskWhatsappNumber } from "@/lib/whatsapp/config";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "Manajemen Profil – CirebonLapor",
  description: "Kelola informasi profil dan integrasi WhatsApp Anda",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "MASYARAKAT") {
    redirect("/unauthorized");
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      role: true,
      _count: {
        select: { reports: true },
      },
      whatsappLink: {
        select: {
          phoneNumber: true,
          verifiedAt: true,
        },
      },
      whatsappRegistrations: {
        where: { status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <ProfileClient
      initialData={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone ?? "",
        address: user.address ?? "",
        role: user.role,
        isActive: user.isActive,
        reportCount: user._count.reports,
        taskCount: 0,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        whatsapp: {
          connected: !!user.whatsappLink,
          maskedPhoneNumber: user.whatsappLink
            ? maskWhatsappNumber(user.whatsappLink.phoneNumber)
            : null,
          verifiedAt: user.whatsappLink?.verifiedAt?.toISOString() ?? null,
          registrationStatus: user.whatsappRegistrations[0]?.status ?? null,
        },
      }}
    />
  );
}
