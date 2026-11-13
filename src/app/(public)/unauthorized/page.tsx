import { ShieldX, ArrowLeft, LogIn } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Akses Ditolak – CirebonLapor",
  description: "Anda tidak memiliki izin untuk mengakses halaman ini",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white/90 p-8 text-center shadow-xl shadow-slate-200/50 backdrop-blur sm:p-10">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100">
          <ShieldX className="h-8 w-8" />
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-red-500">Error 403</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Akses ditolak</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-500 sm:text-base">
          Anda tidak memiliki izin untuk mengakses halaman ini. Silakan kembali atau masuk menggunakan akun dengan peran yang sesuai.
        </p>

        <div className="mt-7 rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 text-left">
          <p className="text-sm font-semibold text-amber-900">Yang dapat Anda lakukan</p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-800/90">
            <li>• Kembali ke dashboard atau halaman sebelumnya</li>
            <li>• Masuk dengan akun yang memiliki akses</li>
            <li>• Hubungi administrator jika ini tidak sesuai</li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            id="btn-back-dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard
          </Link>
          <Link
            href="/login"
            id="btn-login-other"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-medium text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
          >
            <LogIn className="h-4 w-4" />
            Masuk Akun Lain
          </Link>
        </div>
      </div>
    </div>
  );
}
