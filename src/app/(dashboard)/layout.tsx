"use client";

import { PropsWithChildren, useEffect, useRef, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import DashboardFooter from "@/components/layout/Footer";
import NotificationDropdown from "@/components/shared/NotificationDropdown";
import { User, Settings, Menu, LogOut, ChevronDown, MapPin } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

export default function DashboardLayout({ children }: PropsWithChildren) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const role = session?.user?.role as string | undefined;
  const isLoading = status === "loading";

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    setIsSidebarOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  const profileHref = role ? `/dashboard/${role.toLowerCase()}/profile` : "/dashboard";

  return (
    <div className="app-bg flex min-h-screen flex-col">
      <header className="sticky top-0 z-[var(--layout-z-header)] h-[var(--layout-header-height)] border-b border-slate-200/70 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
        <div className="flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Buka navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 shadow-sm shadow-blue-600/20">
                <span className="text-xs font-bold text-white">CL</span>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-sm font-semibold tracking-tight text-slate-900">CirebonLapor</span>
                <span className="hidden text-[11px] text-slate-500 sm:block">Pelaporan Fasilitas Umum</span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/map"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 md:inline-flex"
            >
              <MapPin className="h-4 w-4" />
              Peta Sebaran
            </Link>

            {isLoading ? (
              <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-200" />
            ) : session ? (
              <>
                {role === "MASYARAKAT" && (
                  <Link
                    href="/settings/whatsapp"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                    title="Pengaturan WhatsApp"
                  >
                    <Settings className="h-4.5 w-4.5" />
                  </Link>
                )}
                <NotificationDropdown />
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen((v) => !v)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm transition-all",
                      isUserMenuOpen
                        ? "border-blue-200 bg-blue-50/70 text-blue-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                      <User className="h-4 w-4" />
                    </div>
                    <span className="hidden max-w-[8rem] truncate font-medium sm:block">{session.user?.name}</span>
                    <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isUserMenuOpen && "rotate-180")} />
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-slate-200/80 bg-white p-1.5 shadow-lg shadow-slate-200/60 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2.5">
                        <p className="truncate text-sm font-semibold text-slate-900">{session.user?.name}</p>
                        <p className="text-xs capitalize text-slate-500">{role?.toLowerCase()}</p>
                      </div>
                      <div className="my-1 h-px bg-slate-100" />
                      <Link
                        href={profileHref}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <User className="h-4 w-4 text-slate-400" />
                        Profil Saya
                      </Link>
                      <Link
                        href={role === "ADMIN" ? "/admin/whatsapp" : "/settings/whatsapp"}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Settings className="h-4 w-4 text-slate-400" />
                        Pengaturan WhatsApp
                      </Link>
                      <div className="my-1 h-px bg-slate-100" />
                      <button
                        onClick={() => signOut()}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Keluar
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
              >
                Masuk
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-var(--layout-header-height))] flex-1">
        <Sidebar
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          isMobileOpen={isSidebarOpen}
          setIsMobileOpen={setIsSidebarOpen}
        />
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[var(--layout-content-max)] p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

      <DashboardFooter />
    </div>
  );
}
