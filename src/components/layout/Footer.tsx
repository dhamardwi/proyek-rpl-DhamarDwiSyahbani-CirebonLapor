"use client";

import Link from "next/link";

export default function DashboardFooter() {
  return (
    <footer className="border-t border-slate-200/70 bg-white/70">
      <div className="mx-auto flex max-w-[var(--layout-content-max)] flex-col gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-blue-700 text-[10px] font-bold text-white">CL</div>
          <span className="font-medium text-slate-700">CirebonLapor</span>
        </div>
        <p className="text-center sm:text-left">© {new Date().getFullYear()} Sistem Pelaporan Fasilitas Umum Berbasis AI.</p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/map" className="transition-colors hover:text-blue-600">Peta Sebaran</Link>
          <Link href="/settings/telegram" className="transition-colors hover:text-blue-600">Pengaturan</Link>
        </div>
      </div>
    </footer>
  );
}
