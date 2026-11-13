"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email atau password salah. Silakan coba lagi.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        <Card className="border-slate-200/80 shadow-xl shadow-slate-200/50">
          <CardHeader className="space-y-3 pb-2 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <LogIn className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold tracking-tight text-slate-900">Masuk ke akun Anda</CardTitle>
              <CardDescription className="text-sm text-slate-500">
                Kelola dan pantau laporan fasilitas umum dengan mudah
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="pt-4">
            {error && (
              <Alert variant="destructive" className="mb-5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Alamat Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Kata Sandi</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                id="btn-login"
                type="submit"
                disabled={isLoading}
                className="mt-2 h-11 w-full"
              >
                {isLoading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Memproses...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Masuk
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col border-t border-slate-100 pt-5">
            <p className="text-center text-sm text-slate-500">
              Belum punya akun?{" "}
              <Link href="/register" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
                Daftar sekarang
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
