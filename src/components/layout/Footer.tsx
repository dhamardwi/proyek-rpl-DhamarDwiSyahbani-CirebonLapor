"use client";

import Link from "next/link";

export default function DashboardFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="px-6 py-4 sm:px-8 lg:px-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-[10px]">C</span>
          </div>
          <span className="text-sm font-semibold text-slate-900">
            CirebonLapor
          </span>
        </div>
        <div className="text-xs text-slate-500">
          © {new Date().getFullYear()} CirebonLapor. Sistem Pelaporan Fasilitas Umum Desa Berbasis AI.
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <Link href="/map" className="hover:text-blue-600 transition-colors">
            Peta Sebaran
          </Link>
          <Link href="/settings/telegram" className="hover:text-blue-600 transition-colors">
            Pengaturan Telegram
          </Link>
        </div>
      </div>
    </footer>
  );
}
