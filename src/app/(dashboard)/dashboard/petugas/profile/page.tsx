import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "Manajemen Profil – CirebonLapor",
  description: "Kelola informasi profil Anda",
};

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "PETUGAS") {
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
        select: { assignments: true },
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
        reportCount: 0,
        taskCount: user._count.assignments,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
        whatsapp: {
          connected: false,
          maskedPhoneNumber: null,
          verifiedAt: null,
          registrationStatus: null,
        },
      }}
    />
  );
}