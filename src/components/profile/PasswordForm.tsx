"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Lock, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
  const [serverError, setServerError] = useState<string | null>(null);

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
    setServerError(null);

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
        const msg = data.message || "Gagal mengubah password";
        if (msg.includes("saat ini")) {
          setErrors({ currentPassword: msg });
        } else if (msg.includes("baru")) {
          setErrors({ newPassword: msg });
        } else if (msg.includes("Konfirmasi")) {
          setErrors({ confirmPassword: msg });
        } else {
          setServerError(msg);
        }
      }
    } catch {
      setServerError("Terjadi kesalahan server");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Ubah Password
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="success">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>Password berhasil diubah. Silakan login lagi dengan password baru.</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pwd-current">Password Saat Ini</Label>
            <Input
              id="pwd-current"
              name="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={handleChange}
              className={`w-full ${errors.currentPassword ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
              disabled={isLoading || isSubmitting}
            />
            {errors.currentPassword && (
              <p className="text-[10px] text-red-600 mt-1">{errors.currentPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pwd-new">Password Baru</Label>
            <Input
              id="pwd-new"
              name="newPassword"
              type="password"
              value={formData.newPassword}
              onChange={handleChange}
              className={`w-full ${errors.newPassword ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
              disabled={isLoading || isSubmitting}
            />
            {errors.newPassword && (
              <p className="text-[10px] text-red-600 mt-1">{errors.newPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pwd-confirm">Konfirmasi Password Baru</Label>
            <Input
              id="pwd-confirm"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`w-full ${errors.confirmPassword ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
              disabled={isLoading || isSubmitting}
            />
            {errors.confirmPassword && (
              <p className="text-[10px] text-red-600 mt-1">{errors.confirmPassword}</p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading || isSubmitting || !session?.user}
            className="w-full py-2.5 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Lock className="w-4 h-4" />
            )}
            <span>{isSubmitting ? "Mengubah..." : "Ubah Password"}</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
