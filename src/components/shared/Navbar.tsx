"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Settings, User as UserIcon, MapPin, Menu, X, LayoutDashboard, ChevronDown } from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const role = session?.user?.role?.toLowerCase();
  const dashboardHref = role ? `/dashboard/${role}` : "/dashboard";
  const settingsHref = role === "admin" ? "/admin/whatsapp" : "/settings/whatsapp";

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-bold text-white shadow-sm shadow-blue-600/20">
                CL
              </div>
              <span className="text-sm font-semibold tracking-tight text-slate-900 sm:text-base">CirebonLapor</span>
            </Link>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <Link href="/map" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
              <MapPin className="h-4 w-4" /> Peta Sebaran
            </Link>
            {session && (
              <Link href={dashboardHref} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                <LayoutDashboard className="h-4 w-4" /> Dashboard
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            {status === "loading" ? (
              <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-200" />
            ) : session ? (
              <>
                <NotificationDropdown />
                <div className="relative hidden sm:block" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-all",
                      isUserMenuOpen ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-white hover:bg-slate-50"
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <UserIcon className="h-4 w-4" />
                    </div>
                    <span className="max-w-[7rem] truncate font-medium text-slate-700">{session.user?.name}</span>
                    <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isUserMenuOpen && "rotate-180")} />
                  </button>
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-lg shadow-slate-200/60">
                      <div className="px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-slate-900">{session.user?.name}</p>
                        <p className="text-xs capitalize text-slate-500">{session.user?.role?.toLowerCase()}</p>
                      </div>
                      <div className="my-1 h-px bg-slate-100" />
                      <Link href={dashboardHref} onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <LayoutDashboard className="h-4 w-4 text-slate-400" /> Dashboard
                      </Link>
                      <Link href={`/dashboard/${role}/profile`} onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <UserIcon className="h-4 w-4 text-slate-400" /> Profil
                      </Link>
                      <Link href={settingsHref} onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <Settings className="h-4 w-4 text-slate-400" /> Pengaturan WhatsApp
                      </Link>
                      <div className="my-1 h-px bg-slate-100" />
                      <button onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                        <LogOut className="h-4 w-4" /> Keluar
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/login" className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">Masuk</Link>
                <Link href="/register" className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700">Daftar</Link>
              </div>
            )}
            <button
              onClick={() => setIsMobileOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
              aria-label="Menu"
            >
              {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {isMobileOpen && (
        <div className="border-t border-slate-200/70 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            <Link href="/map" onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <MapPin className="h-4 w-4 text-slate-400" /> Peta Sebaran
            </Link>
            {session ? (
              <>
                <Link href={dashboardHref} onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <LayoutDashboard className="h-4 w-4 text-slate-400" /> Dashboard
                </Link>
                <Link href={`/dashboard/${role}/profile`} onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <UserIcon className="h-4 w-4 text-slate-400" /> Profil
                </Link>
                <Link href={settingsHref} onClick={() => setIsMobileOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <Settings className="h-4 w-4 text-slate-400" /> Pengaturan WhatsApp
                </Link>
                <button onClick={() => signOut({ callbackUrl: "/login" })} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                  <LogOut className="h-4 w-4" /> Keluar
                </button>
              </>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link href="/login" onClick={() => setIsMobileOpen(false)} className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 text-sm font-medium text-slate-700">Masuk</Link>
                <Link href="/register" onClick={() => setIsMobileOpen(false)} className="inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white">Daftar</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
