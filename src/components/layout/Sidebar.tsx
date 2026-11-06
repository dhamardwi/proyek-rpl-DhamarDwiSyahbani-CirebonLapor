"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  MapPin,
  Settings,
  LogOut,
  ChevronLeft,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: ("ADMIN" | "PETUGAS" | "MASYARAKAT")[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN"],
  },
  {
    href: "/dashboard/petugas",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["PETUGAS"],
  },
  {
    href: "/dashboard/masyarakat",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["MASYARAKAT"],
  },
  {
    href: "/admin/reports",
    label: "Manajemen Laporan",
    icon: FileText,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/users",
    label: "Manajemen Pengguna",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    href: "/tasks",
    label: "Daftar Tugas",
    icon: Wrench,
    roles: ["PETUGAS"],
  },
  {
    href: "/my-reports",
    label: "Laporan Saya",
    icon: FileText,
    roles: ["MASYARAKAT"],
  },
  {
    href: "/map",
    label: "Peta Sebaran",
    icon: MapPin,
    roles: ["ADMIN", "PETUGAS", "MASYARAKAT"],
  },
];

const USER_NAV_ITEMS: NavItem[] = [
  {
    href: "/settings/telegram",
    label: "Pengaturan Telegram",
    icon: Settings,
    roles: ["ADMIN", "PETUGAS", "MASYARAKAT"],
  },
  {
    href: "/dashboard/profile",
    label: "Profil Saya",
    icon: ShieldCheck,
    roles: ["ADMIN", "PETUGAS", "MASYARAKAT"],
  },
];

export default function Sidebar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const role = session?.user?.role as
    | "ADMIN"
    | "PETUGAS"
    | "MASYARAKAT"
    | undefined;
  const isLoggedIn = status === "authenticated" && !!role;

  const navItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.roles.includes(role!)),
    [role]
  );

  const userNavItems = useMemo(
    () => USER_NAV_ITEMS.filter((item) => item.roles.includes(role!)),
    [role]
  );

  const isActive = (href: string) => {
    if (href === "/dashboard/profile") {
      return pathname.startsWith("/dashboard/") && pathname.endsWith("/profile");
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    setIsMobileOpen(false);
  };

  const isDesktop = typeof window !== "undefined" ? window.innerWidth >= 1024 : true;

  const sidebarClasses = cn(
    "fixed left-0 top-0 z-40 h-full bg-white border-r border-slate-200 transition-all duration-300",
    isCollapsed ? "w-16" : "w-64",
    isDesktop || isMobileOpen ? "translate-x-0" : "-translate-x-full"
  );

  return (
    <>
      {/* Mobile overlay */}
      {!isDesktop && isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={sidebarClasses}>
        <div className="flex h-full flex-col">
          {/* Brand */}
          <div className="flex items-center gap-2 px-4 py-5 border-b border-slate-100">
            <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
              <span className="text-white font-bold text-xs">C</span>
            </div>
            {!isCollapsed && (
              <span className="font-bold text-xl tracking-tight text-blue-600">
                CirebonLapor
              </span>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors lg:hidden"
              aria-label="Toggle sidebar"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-blue-50 text-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("w-5 h-5 shrink-0", active && "text-blue-600")} />
                  {isCollapsed ? (
                    <span className="absolute left-16 bg-white px-2 py-1.5 rounded shadow-sm border border-slate-200 text-xs font-medium whitespace-nowrap z-10">
                      {item.label}
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              );
            })}

            <div className="mt-4 px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Akun
            </div>

            {userNavItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "bg-blue-50 text-blue-700 shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <Icon className={cn("w-5 h-5 shrink-0", active && "text-blue-600")} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer: Role badge + Logout */}
          <div className="px-3 py-4 border-t border-slate-100">
            {role && session?.user && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-slate-500" />
                </div>
                {!isCollapsed && (
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {session.user.name || "Pengguna"}
                    </p>
                    <p className="text-xs text-slate-500 capitalize truncate">
                      {role}
                    </p>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {isCollapsed ? (
                <span className="absolute left-16 bg-white px-2 py-1.5 rounded shadow-sm border border-slate-200 text-xs font-medium whitespace-nowrap z-10 text-red-600">
                  Keluar
                </span>
              ) : (
                "Keluar"
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile hamburger toggle */}
      {!isDesktop && !isMobileOpen && (
        <button
          className="fixed left-4 top-4 z-50 lg:hidden bg-white px-3 py-2 rounded-lg shadow-md border border-slate-200"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Buka menu navigasi"
        >
          <svg
            className="w-5 h-5 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        </button>
      )}
    </>
  );
}
