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
  ChevronRight,
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

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
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
    roles: ["MASYARAKAT"],
  },
  {
    href: "/dashboard/profile",
    label: "Profil Saya",
    icon: ShieldCheck,
    roles: ["ADMIN", "PETUGAS", "MASYARAKAT"],
  },
];

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(true);

  const role = session?.user?.role as
    | "ADMIN"
    | "PETUGAS"
    | "MASYARAKAT"
    | undefined;

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

  // Track window size
  useEffect(() => {
    const updateSize = () => {
      setIsDesktop(typeof window !== "undefined" ? window.innerWidth >= 1024 : true);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Close mobile sidebar on route change
  useEffect(() => {
    if (!isDesktop) {
      setIsMobileOpen(false);
    }
  }, [pathname, isDesktop]);

  const handleLogout = () => {
    setIsMobileOpen(false);
  };

  // Sidebar width classes based on collapsed state
  const sidebarWidth = isCollapsed
    ? "var(--layout-sidebar-collapsed-width)"
    : "var(--layout-sidebar-width)";

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!isDesktop && isMobileOpen && (
        <div
          className="fixed inset-0 z-[var(--layout-z-overlay)] bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ============ SIDEBAR ============ */}
      <aside
        className={cn(
          // Desktop: part of flex flow (relative), pushes main content
          // Mobile: fixed overlay drawer
          isDesktop ? "relative" : "fixed",
          "left-0 top-[var(--layout-header-height)] z-[var(--layout-z-sidebar)]",
          "bg-white border-r border-slate-200",
          "h-[calc(100vh-var(--layout-header-height))]",
          "flex flex-col shadow-sm",
          // Width
          `w-[${sidebarWidth}]`,
          "transition-all duration-300 ease-in-out",
          // Mobile only: full viewport height, hidden by default
          !isDesktop ? "h-screen top-0" : "",
          !isDesktop && !isMobileOpen ? "-translate-x-full" : "",
          !isDesktop && isMobileOpen ? "translate-x-0" : ""
        )}
      >
        <div className="flex h-full flex-col">
          {/* Brand + Toggle */}
          <div className="flex items-center justify-between gap-2 px-4 py-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg flex-shrink-0">
                <span className="text-white font-bold text-xs">C</span>
              </div>
              {!isCollapsed && (
                <span className="font-bold text-lg tracking-tight text-blue-600 truncate">
                  CirebonLapor
                </span>
              )}
            </div>

            {/* Desktop collapse toggle (chevron) */}
            {isDesktop && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                aria-label={isCollapsed ? "Buka sidebar" : "Tutup sidebar"}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            )}

            {/* Mobile hamburger toggle */}
            {!isDesktop && (
              <button
                onClick={() => setIsMobileOpen(true)}
                className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex-shrink-0"
                aria-label="Buka navigasi"
              >
                <span className="w-4 h-4">☰</span>
              </button>
            )}
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
                  <div className="flex items-center justify-center w-8 shrink-0">
                    <Icon className={cn("w-5 h-5", active && "text-blue-600")} />
                  </div>
                  {!isCollapsed && item.label}
                  {isCollapsed && (
                    <span className="absolute left-[64px] top-1/2 -translate-y-1/2 bg-white px-2 py-1.5 rounded shadow-sm border border-slate-200 text-xs font-medium whitespace-nowrap z-[var(--layout-z-tooltip)] opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.label}
                    </span>
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
                  <div className="flex items-center justify-center w-8 shrink-0">
                    <Icon className={cn("w-5 h-5", active && "text-blue-600")} />
                  </div>
                  {!isCollapsed && item.label}
                </Link>
              );
            })}
          </nav>

          {/* Footer: Role badge + Logout */}
          <div className="px-3 py-4 border-t border-slate-100 bg-slate-50">
            {role && session?.user && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 flex-1">
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
              <LogOut className="w-4 h-4 shrink-0" />
              {!isCollapsed && "Keluar"}
              {isCollapsed && (
                <span className="absolute left-[64px] top-1/2 -translate-y-1/2 bg-white px-2 py-1.5 rounded shadow-sm border border-slate-200 text-xs font-medium whitespace-nowrap z-[var(--layout-z-tooltip)] text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Keluar
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
