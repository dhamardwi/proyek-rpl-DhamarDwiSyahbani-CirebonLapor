"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Settings, User as UserIcon, Menu, MapPin } from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";

export default function Navbar() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const role = session?.user?.role as string | undefined;
  const isDashboard = typeof window !== "undefined" && window.location.pathname.startsWith("/dashboard");

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0 flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">C</span>
              </div>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                CirebonLapor
              </span>
            </Link>
          </div>

          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="/map"
              className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50"
            >
              <MapPin className="w-4 h-4 mr-1.5" />
              Peta Sebaran
            </Link>
            {!isDashboard && (
              <Link
                href="/login"
                className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50"
              >
                Masuk
              </Link>
            )}
          </div>

          <div className="flex items-center gap-3">
            {status === "loading" ? (
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
                <div className="relative group">
                  <button
                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 font-medium text-sm border border-blue-100 hover:bg-blue-100 transition-colors"
                  >
                    <UserIcon className="w-4 h-4" />
                    <span className="hidden sm:block">{session.user?.name}</span>
                  </button>

                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-200">
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
                        <UserIcon className="w-4 h-4 text-slate-500" />
                        Manajemen Profil
                      </Link>
                      <Link
                        href="/settings/telegram"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                        Pengaturan Telegram
                      </Link>
                      <hr className="my-1 border-slate-100" />
                      <button
                        onClick={() => signOut()}
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
      </div>
    </nav>
  );
}
