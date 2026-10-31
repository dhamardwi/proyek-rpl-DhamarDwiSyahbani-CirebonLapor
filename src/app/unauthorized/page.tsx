import { ShieldX, ArrowLeft, LogIn } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Akses Ditolak – CirebonLapor",
  description: "Anda tidak memiliki izin untuk mengakses halaman ini",
};

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-12 bg-gradient-to-br from-red-50 via-white to-orange-50">
      <div className="text-center max-w-md">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-3xl mb-6">
          <ShieldX className="w-10 h-10 text-red-600" />
        </div>

        {/* Error Code */}
        <p className="text-sm font-bold text-red-400 tracking-widest uppercase mb-2">
          Error 403
        </p>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-slate-900 mb-4">
          Akses Ditolak
        </h1>

        {/* Description */}
        <p className="text-slate-500 mb-8 leading-relaxed">
          Anda tidak memiliki izin untuk mengakses halaman ini. 
          Halaman ini hanya dapat diakses oleh pengguna dengan role tertentu.
        </p>

        {/* Info Box */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-left">
          <p className="text-sm text-amber-800 font-medium mb-1">Apa yang bisa Anda lakukan?</p>
          <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
            <li>Kembali ke halaman sebelumnya</li>
            <li>Login dengan akun yang sesuai</li>
            <li>Hubungi admin jika Anda merasa ini kesalahan</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            id="btn-back-dashboard"
            className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
          <Link
            href="/login"
            id="btn-login-other"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-all text-sm"
          >
            <LogIn className="w-4 h-4" />
            Login Akun Lain
          </Link>
        </div>
      </div>
    </div>
  );
}
