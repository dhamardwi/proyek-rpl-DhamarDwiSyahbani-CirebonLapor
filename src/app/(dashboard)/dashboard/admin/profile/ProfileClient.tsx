"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ProfileForm from "@/components/profile/ProfileForm";
import ProfileAvatar from "@/components/profile/ProfileAvatar";
import PasswordForm from "@/components/profile/PasswordForm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  address: string;
  profileImage: string | null;
  isActive: boolean;
  reportCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
  telegram: {
    connected: boolean;
    chatId: string | null;
    username: string | null;
    connectedAt: string | null;
  };
}

interface ProfileClientProps {
  initialData: ProfileData;
}

export default function ProfileClient({ initialData }: ProfileClientProps) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.success && data.data) {
        setProfile(data.data);
      }
    } catch (error) {
      console.error("[PROFILE_FETCH_ERROR]", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleProfileUpdate = async (data: {
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
  }) => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(result.message || "Gagal memperbarui profil");
    }
    await fetchProfile();
    return result.data;
  };

  if (!session?.user || session.user.role !== "ADMIN" || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600">Akses ditolak. Silakan login.</p>
          <Link href="/login" className="mt-4 text-blue-600 hover:text-blue-700 font-medium">
            Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors mb-4"
        >
          <span className="w-4 h-4 flex items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <span className="w-2 h-2 bg-blue-600 rounded-full" />
          </span>
          Kembali ke Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Manajemen Profil</h1>
        <p className="text-sm text-slate-500">
          Kelola informasi profil akun admin Anda
        </p>
      </div>

      <Card>
        <CardHeader className="pb-6">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Informasi Profil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm
            profile={{
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              address: profile.address,
              role: profile.role,
            }}
            onUpdate={handleProfileUpdate}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-6">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Foto Profil
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileAvatar
            currentImage={profile.profileImage}
            onUpdate={async (imageUrl) => {
              return imageUrl;
            }}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-6">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Ubah Password
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm isLoading={isLoading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-6">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Informasi Akun
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center p-4 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-sm text-slate-600">Role Akun</span>
            <span className="text-sm font-medium text-slate-900 capitalize">
              Admin
            </span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-sm text-slate-600">Email Terdaftar</span>
            <span className="text-sm font-medium text-slate-900">{profile.email}</span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-sm text-slate-600">Total Laporan</span>
            <span className="text-sm font-medium text-slate-900">{profile.reportCount}</span>
          </div>
          <div className="flex justify-between items-center p-4 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-sm text-slate-600">Bergabung Sejak</span>
            <span className="text-sm font-medium text-slate-900">
              {new Date(profile.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
