"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.errors) {
          const fieldErrors: Record<string, string> = {};
          Object.entries(data.errors).forEach(([key, val]) => {
            fieldErrors[key] = (val as string[])[0];
          });
          setErrors(fieldErrors);
        } else {
          setServerError(data.message || "Terjadi kesalahan. Silakan coba lagi.");
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setServerError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = (() => {
    const p = formData.password;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    return score;
  })();

  const strengthColors = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-500"];
  const strengthLabels = ["Lemah", "Sedang", "Cukup", "Kuat"];

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-svh bg-slate-50 px-6">
        <div className="w-full max-w-md">
          <Card className="text-center shadow-lg">
            <CardContent className="py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-6 mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 mb-2">
                Akun Berhasil Dibuat!
              </CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Mengalihkan ke halaman login...
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-svh bg-slate-50 px-6">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center pb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl mb-4">
              <UserPlus className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">Daftar Akun Baru</CardTitle>
            <CardDescription className="text-sm text-slate-500">
              Bergabung dan laporkan masalah fasilitas desa
            </CardDescription>
          </CardHeader>

          {serverError && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Lengkap</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Masukkan nama lengkap"
                  className={`text-sm ${errors.name ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
                />
                {errors.name && (
                  <p className="text-[10px] text-red-600 mt-1">{errors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Alamat Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="nama@email.com"
                  className={`text-sm ${errors.email ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
                />
                {errors.email && (
                  <p className="text-[10px] text-red-600 mt-1">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Min. 8 karakter"
                    className={`text-sm pr-12 ${errors.password ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {formData.password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all ${
                            i < passwordStrength ? strengthColors[passwordStrength - 1] : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-[10px] ${passwordStrength >= 3 ? "text-green-600" : "text-slate-500"}`}>
                      Kekuatan: {strengthLabels[passwordStrength - 1] ?? "Lemah"}
                    </p>
                  </div>
                )}
                {errors.password && (
                  <p className="text-[10px] text-red-600 mt-1">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Ulangi password"
                    className={`text-sm pr-12 ${errors.confirmPassword ? "border-red-400 bg-red-50 focus:ring-2 focus:ring-red-100" : "border-slate-200 focus:ring-2 focus:ring-blue-100 focus:border-blue-500"}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showConfirm ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[10px] text-red-600 mt-1">{errors.confirmPassword}</p>
                )}
              </div>

              <Button
                id="btn-register"
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 shadow-sm shadow-green-100 hover:shadow-green-200 mt-2 py-3"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Membuat Akun...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Daftar Sekarang
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-6">
            <p className="text-center text-sm text-slate-500">
              Sudah punya akun?{" "}
              <Link href="/login" className="text-blue-600 font-medium hover:underline">
                Masuk di sini
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
