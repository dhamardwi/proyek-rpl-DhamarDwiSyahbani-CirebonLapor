"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ProfileForm from "@/components/profile/ProfileForm";
import PasswordForm from "@/components/profile/PasswordForm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string;
  address: string;
  isActive: boolean;
  reportCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
  whatsapp: {
    connected: boolean;
    maskedPhoneNumber: string | null;
    verifiedAt: string | null;
    registrationStatus: string | null;
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
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          </span>
          Kembali ke Dashboard
        </Link>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Profil</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Manajemen Profil</h1>
          <p className="text-sm text-slate-500 sm:text-base">Kelola informasi akun dan keamanan profil admin Anda.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Informasi Profil</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Perbarui data identitas dan kontak utama akun Anda.</p>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
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

          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Keamanan Akun</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Ubah password untuk menjaga keamanan akses akun.</p>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <PasswordForm isLoading={isLoading} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-base font-semibold text-slate-900">Informasi Akun</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Ringkasan data akun dan aktivitas Anda.</p>
            </CardHeader>
            <CardContent className="space-y-3 p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-sm text-slate-600">Role Akun</span>
                <span className="text-sm font-medium text-slate-900">Admin</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-sm text-slate-600">Email Terdaftar</span>
                <span className="max-w-[60%] truncate text-right text-sm font-medium text-slate-900">{profile.email}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-sm text-slate-600">Total Laporan</span>
                <span className="text-sm font-medium text-slate-900">{profile.reportCount}</span>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <span className="text-sm text-slate-600">Bergabung Sejak</span>
                <span className="text-right text-sm font-medium text-slate-900">
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
      </div>
    </div>
  );
}
