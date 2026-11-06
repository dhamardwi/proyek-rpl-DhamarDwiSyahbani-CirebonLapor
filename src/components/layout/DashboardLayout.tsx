"use client";

import { PropsWithChildren, useState } from "react";
import Sidebar from "./Sidebar";
import NotificationDropdown from "@/components/shared/NotificationDropdown";
import { User, Settings, Bell, Menu, LogOut } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: PropsWithChildren<DashboardLayoutProps>) {
  const { data: session, status } = useSession();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const role = session?.user?.role as string | undefined;
  const isLoading = status === "loading";

  const handleLogout = () => {
    signOut();
    setIsUserMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className={cn("flex-1 flex flex-col relative", isMobileOpen ? "overflow-hidden" : "")}>
        {/* Navbar */}
        <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="flex items-center justify-between px-6 py-3 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              {!isMobileOpen && (
                <button
                  className="lg:hidden p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  onClick={() => setIsMobileOpen(true)}
                  aria-label="Buka navigasi"
                >
                  <Menu className="w-5 h-5" />
                </button>
              )}
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">C</span>
                </div>
                <span className="font-bold text-lg tracking-tight text-slate-900">
                  CirebonLapor
                </span>
              </Link>
            </div>

            <div className="hidden ml-6 flex items-center gap-4">
              <Link
                href="/map"
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50"
              >
                Peta Sebaran
              </Link>
            </div>

            <div className="ml-auto flex items-center gap-3">
              {isLoading ? (
                <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse"></div>
              ) : session ? (
                <>
                  <Link
                    href="/settings/telegram"
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Pengaturan Telegram"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                  <NotificationDropdown />
                  <div
                    className="relative group"
                    onMouseEnter={() => setIsUserMenuOpen(true)}
                    onMouseLeave={() => setIsUserMenuOpen(false)}
                  >
                    <button
                      onClick={() => setIsUserMenuOpen((prev) => !prev)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium text-sm border border-blue-100 hover:bg-blue-100 transition-colors"
                    >
                      <User className="w-4 h-4" />
                      <span className="hidden sm:block">{session.user?.name}</span>
                    </button>

                    {isUserMenuOpen && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50">
                        <div className="p-3 border-b border-slate-100">
                          <p className="text-sm font-medium text-slate-900">
                            {session.user?.name}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">
                            {session.user?.role}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/${session.user?.role?.toLowerCase()}/profile`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <User className="w-4 h-4 text-slate-500" />
                          Manajemen Profil
                        </Link>
                        <Link
                          href="/settings/telegram"
                          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <Settings className="w-4 h-4 text-slate-500" />
                          Pengaturan Telegram
                        </Link>
                        <hr className="my-1 border-slate-100" />
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          Keluar
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Masuk
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
