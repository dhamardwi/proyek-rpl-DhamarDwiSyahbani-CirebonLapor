"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Lock, Loader2, AlertCircle, CheckCircle } from "lucide-react";

interface PasswordFormProps {
  isLoading: boolean;
}

export default function PasswordForm({ isLoading }: PasswordFormProps) {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const { data: session } = useSession();

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
    if (success) setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.currentPassword)
      newErrors.currentPassword = "Password saat ini wajib diisi";
    if (!formData.newPassword)
      newErrors.newPassword = "Password baru wajib diisi";
    else if (formData.newPassword.length < 8)
      newErrors.newPassword = "Password baru minimal 8 karakter";
    if (!formData.confirmPassword)
      newErrors.confirmPassword = "Konfirmasi password wajib diisi";
    else if (formData.newPassword !== formData.confirmPassword)
      newErrors.confirmPassword = "Konfirmasi password tidak cocok";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setFormData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setErrors({});
        setSuccess(true);
        setTimeout(() => setSuccess(false), 5000);
      } else {
        // Map error messages to specific fields
        const msg = data.message || "Gagal mengubah password";
        if (msg.includes("saat ini")) {
          setErrors({ currentPassword: msg });
        } else if (msg.includes("baru")) {
          setErrors({ newPassword: msg });
        } else if (msg.includes("Konfirmasi")) {
          setErrors({ confirmPassword: msg });
        } else {
          setErrors({ _form: msg });
        }
      }
    } catch {
      setErrors({ _form: "Terjadi kesalahan server" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 mb-4">
          <CheckCircle className="w-5 h-5" />
          <span>Password berhasil diubah. Silakan login lagi dengan password baru.</span>
        </div>
      )}
      {errors._form && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-4">
          <AlertCircle className="w-5 h-5" />
          <span>{errors._form}</span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Password Saat Ini
        </label>
        <input
          name="currentPassword"
          type="password"
          value={formData.currentPassword}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.currentPassword ? "border-red-500" : "border-slate-300"
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          disabled={isLoading || isSubmitting}
        />
        {errors.currentPassword && (
          <p className="text-xs text-red-600 mt-1">{errors.currentPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Password Baru
        </label>
        <input
          name="newPassword"
          type="password"
          value={formData.newPassword}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.newPassword ? "border-red-500" : "border-slate-300"
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          disabled={isLoading || isSubmitting}
        />
        {errors.newPassword && (
          <p className="text-xs text-red-600 mt-1">{errors.newPassword}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Konfirmasi Password Baru
        </label>
        <input
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.confirmPassword ? "border-red-500" : "border-slate-300"
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          disabled={isLoading || isSubmitting}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-red-600 mt-1">{errors.confirmPassword}</p>
        )}
      </div>

      <div className="pt-3">
        <button
          type="submit"
          disabled={isLoading || isSubmitting || !session?.user}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
          <span>{isSubmitting ? "Mengubah..." : "Ubah Password"}</span>
        </button>
      </div>
    </form>
  );
}