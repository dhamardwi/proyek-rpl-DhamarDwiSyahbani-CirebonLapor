"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import NotificationDropdown from "./NotificationDropdown";

export default function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="border-b bg-white/75 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold text-blue-600">
              CirebonLapor
            </Link>
          </div>
          
          <div className="hidden sm:flex items-center gap-6 mr-6"><Link href="/map" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Peta Sebaran</Link></div><div className="flex items-center gap-4">
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse"></div>
            ) : session ? (
              <>
                <Link
                  href="/settings/telegram"
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Pengaturan Telegram"
                >
                  <Settings className="w-5 h-5" />
                </Link>
                <Link
                  href={`/dashboard/${session.user?.role?.toLowerCase()}/profile`}
                  className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                  title="Manajemen Profil"
                >
                  <UserIcon className="w-5 h-5" />
                </Link>
                <NotificationDropdown />
                <div className="flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700 hidden sm:block">
                    {session.user?.name}
                  </span>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold hidden sm:block">
                    {session.user?.role}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}


