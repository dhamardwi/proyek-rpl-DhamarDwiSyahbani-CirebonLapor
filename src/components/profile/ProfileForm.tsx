"use client";

import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";


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
  const [serverError, setServerError] = useState<string | null>(null);

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
    setServerError(null);

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
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Gagal memperbarui profil");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="profile-name">Nama Lengkap</Label>
            <Input
              id="profile-name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? "border-red-400 bg-red-50 focus:ring-red-100" : ""}
              disabled={isLoading || isSubmitting}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-email">Email</Label>
            <Input
              id="profile-email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? "border-red-400 bg-red-50 focus:ring-red-100" : ""}
              disabled={isLoading || isSubmitting}
            />
            {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-phone">Nomor Telepon / WhatsApp</Label>
            <Input
              id="profile-phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="08123456789"
              className={errors.phone ? "border-red-400 bg-red-50 focus:ring-red-100" : ""}
              disabled={isLoading || isSubmitting}
            />
            {errors.phone && <p className="text-xs text-red-600">{errors.phone}</p>}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="profile-address">Alamat</Label>
            <Textarea
              id="profile-address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={3}
              placeholder="Masukkan alamat lengkap"
              className={errors.address ? "border-red-400 bg-red-50 focus:ring-red-100" : ""}
              disabled={isLoading || isSubmitting}
            />
            {errors.address && <p className="text-xs text-red-600">{errors.address}</p>}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            onClick={() => {
              setFormData({
                name: profile.name,
                email: profile.email,
                phone: profile.phone,
                address: profile.address,
              });
              setErrors({});
              setServerError(null);
            }}
            variant="outline"
            disabled={isLoading || isSubmitting}
            className="sm:w-auto"
          >
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isLoading || isSubmitting || !session?.user}
            className="sm:w-auto"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>{isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
