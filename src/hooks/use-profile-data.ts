"use client";
import { getErrorMessage } from "@/lib/ui-helpers";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

export interface ProfileData {
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

export interface ProfileUpdateInput {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
}

/**
 * Logikapengambilan & pembaruan profil yang dipakai bersama oleh
 * ProfileClient admin/petugas/masyarakat (Tahap C4). Guard role
 * sengaja tetap berada di masing-masing komponen karena nilainya beda.
 */
export function useProfileData(initialData: ProfileData) {
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

  /* eslint-disable react-hooks/set-state-in-effect -- Fetch profil saat mount; perilaku existing dipertahankan */
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleProfileUpdate = async (data: ProfileUpdateInput) => {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok || !result.success) {
      throw new Error(getErrorMessage(result, "Gagal memperbarui profil"));
    }
    await fetchProfile();
    return result.data;
  };

  return { session, profile, isLoading, fetchProfile, handleProfileUpdate };
}
