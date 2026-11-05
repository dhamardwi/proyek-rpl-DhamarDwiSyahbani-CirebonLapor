"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Save,
  Loader2,
} from "lucide-react";

interface ProfileFormProps {
  profile: {
    name: string;
    email: string;
    phone: string;
    address: string;
    role: string;
  };
  onUpdate: (data: {
    name: string;
    email: string;
    phone: string | null;
    address: string | null;
  }) => Promise<void>;
  isLoading: boolean;
}

export default function ProfileForm({
  profile,
  onUpdate,
  isLoading,
}: ProfileFormProps) {
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    address: profile.address,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: session } = useSession();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    },
    [errors]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = "Nama lengkap wajib diisi";
    if (!formData.email.trim()) newErrors.email = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Format email tidak valid";
    if (
      formData.phone &&
      !/^[\d\s\-\+\(\)]+$/.test(formData.phone)
    )
      newErrors.phone = "Format nomor telepon tidak valid";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      await onUpdate({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || null,
        address: formData.address.trim() || null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nama Lengkap
        </label>
        <input
          name="name"
          type="text"
          value={formData.name}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.name ? "border-red-500" : "border-slate-300"
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          disabled={isLoading || isSubmitting}
        />
        {errors.name && (
          <p className="text-xs text-red-600 mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Email
        </label>
        <input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.email ? "border-red-500" : "border-slate-300"
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          disabled={isLoading || isSubmitting}
        />
        {errors.email && (
          <p className="text-xs text-red-600 mt-1">{errors.email}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nomor Telepon / WhatsApp
        </label>
        <input
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.phone ? "border-red-500" : "border-slate-300"
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          placeholder="08123456789"
          disabled={isLoading || isSubmitting}
        />
        {errors.phone && (
          <p className="text-xs text-red-600 mt-1">{errors.phone}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Alamat
        </label>
        <textarea
          name="address"
          value={formData.address}
          onChange={handleChange}
          rows={3}
          className={`w-full px-3 py-2 rounded-lg border ${
            errors.address ? "border-red-500" : "border-slate-300"
          } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
          placeholder="Masukkan alamat lengkap"
          disabled={isLoading || isSubmitting}
        />
        {errors.address && (
          <p className="text-xs text-red-600 mt-1">{errors.address}</p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-3">
        <button
          type="submit"
          disabled={isLoading || isSubmitting || !session?.user}
          className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setFormData({
              name: profile.name,
              email: profile.email,
              phone: profile.phone,
              address: profile.address,
            });
            setErrors({});
          }}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading || isSubmitting}
        >
          Batal
        </button>
      </div>
    </form>
  );
}