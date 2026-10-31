"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserX, UserCheck, Loader2 } from "lucide-react";

export function ToggleUserStatus({ userId, isActive, currentRole }: { userId: string, isActive: boolean, currentRole: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const toggleStatus = async () => {
    if (!confirm(`Yakin ingin ${isActive ? 'menonaktifkan' : 'mengaktifkan'} user ini?`)) return;
    
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive })
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.message || "Gagal mengubah status user");
      }
    } catch {
      alert("Terjadi kesalahan sistem");
    } finally {
      setIsLoading(false);
    }
  };

  if (currentRole === "ADMIN") return null;

  return (
    <button
      onClick={toggleStatus}
      disabled={isLoading}
      className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
        isActive 
          ? "text-red-600 hover:bg-red-50" 
          : "text-green-600 hover:bg-green-50"
      }`}
      title={isActive ? "Nonaktifkan User" : "Aktifkan User"}
    >
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : isActive ? (
        <UserX className="w-5 h-5" />
      ) : (
        <UserCheck className="w-5 h-5" />
      )}
    </button>
  );
}
