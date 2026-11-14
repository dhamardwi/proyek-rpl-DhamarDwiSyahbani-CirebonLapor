"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  MapPin,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Wrench,
  Bot,
  ClipboardList,
  MessageCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";

type Role = "ADMIN" | "PETUGAS" | "MASYARAKAT";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: Role[];
  match?: (pathname: string) => boolean;
}

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (val: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (val: boolean) => void;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/dashboard/petugas", label: "Dashboard", icon: LayoutDashboard, roles: ["PETUGAS"] },
  { href: "/dashboard/masyarakat", label: "Dashboard", icon: LayoutDashboard, roles: ["MASYARAKAT"] },
  { href: "/admin/reports", label: "Manajemen Laporan", icon: FileText, roles: ["ADMIN"] },
  { href: "/admin/users", label: "Manajemen Pengguna", icon: Users, roles: ["ADMIN"] },
  { href: "/admin/whatsapp", label: "Persetujuan WhatsApp", icon: MessageCircle, roles: ["ADMIN"] },
  { href: "/admin/settings/ai", label: "Konfigurasi AI", icon: Bot, roles: ["ADMIN"] },
  { href: "/tasks", label: "Daftar Tugas", icon: Wrench, roles: ["PETUGAS"] },
  { href: "/my-reports", label: "Laporan Saya", icon: ClipboardList, roles: ["MASYARAKAT"] },
  { href: "/reports/create", label: "Buat Laporan", icon: FileText, roles: ["MASYARAKAT"] },
  { href: "/map", label: "Peta Sebaran", icon: MapPin, roles: ["ADMIN", "PETUGAS", "MASYARAKAT"] },
];

function isItemActive(pathname: string, item: NavItem, role?: Role) {
  if (item.match) return item.match(pathname);
  if (item.href === "/dashboard/profile") {
    return pathname.includes("/dashboard/") && pathname.endsWith("/profile");
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function Sidebar({
  isCollapsed,
  setIsCollapsed,
  isMobileOpen,
  setIsMobileOpen,
}: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = session?.user?.role as Role | undefined;

  const profileHref = role ? `/dashboard/${role.toLowerCase()}/profile` : "/dashboard";

  const navItems = useMemo(() => NAV_ITEMS.filter((item) => role && item.roles.includes(role)), [role]);
  const userNavItems = useMemo<NavItem[]>(
    () => {
      if (!role) return [];
      const items: NavItem[] = [
        {
          href: profileHref,
          label: "Profil Saya",
          icon: CircleUserRound,
          roles: ["ADMIN", "PETUGAS", "MASYARAKAT"],
          match: (p) => p.endsWith("/profile"),
        },
      ];
      if (role === "MASYARAKAT") {
        items.unshift({
          href: "/settings/whatsapp",
          label: "Pengaturan WhatsApp",
          icon: Settings,
          roles: ["MASYARAKAT"],
        });
      }
      return items;
    },
    [role, profileHref]
  );

  const NavLink = ({ item }: { item: NavItem }) => {
    const active = isItemActive(pathname, item, role);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        onClick={() => setIsMobileOpen(false)}
        title={isCollapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          active
            ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-slate-500 group-hover:text-slate-700")} />
        <span className={cn("truncate transition-all duration-200", isCollapsed ? "w-0 opacity-0 lg:hidden xl:w-0 xl:opacity-0" : "w-auto opacity-100")}>
          {item.label}
        </span>
        {/* Tooltip when collapsed on desktop */}
        <span
          className={cn(
            "pointer-events-none absolute left-full top-1/2 z-[var(--layout-z-tooltip)] ml-2 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 opacity-0 shadow-md transition-opacity",
            "hidden lg:block",
            isCollapsed ? "group-hover:opacity-100" : "lg:hidden"
          )}
        >
          {item.label}
        </span>
      </Link>
    );
  };

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200/70 px-3 py-3 lg:px-4">
        <div className={cn("flex items-center gap-2 overflow-hidden", isCollapsed && "lg:w-full lg:justify-center")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-xs font-bold text-white shadow-sm shadow-blue-600/20">
            CL
          </div>
          <span className={cn("truncate text-sm font-semibold text-slate-900", isCollapsed && "lg:hidden")}>Navigasi</span>
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:inline-flex"
          aria-label={isCollapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        <button
          onClick={() => setIsMobileOpen(false)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Tutup navigasi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <p className={cn("px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400", isCollapsed && "lg:hidden")}>Menu</p>
          {navItems.map((item) => (
            <NavLink key={item.href} item={item} />
          ))}
        </div>
        <div className="space-y-1">
          <p className={cn("px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400", isCollapsed && "lg:hidden")}>Akun</p>
          {userNavItems.map((item) => (
            <NavLink key={item.href + item.label} item={item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-slate-200/70 p-3">
        {session?.user && (
          <div className={cn("mb-2 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5", isCollapsed && "lg:justify-center lg:px-2")}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-sm font-semibold text-blue-700">
              {session.user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
              <p className="truncate text-sm font-medium text-slate-900">{session.user.name}</p>
              <p className="text-xs capitalize text-slate-500">{role?.toLowerCase()}</p>
            </div>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={isCollapsed ? "Keluar" : undefined}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600",
            isCollapsed && "lg:justify-center"
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className={cn(isCollapsed && "lg:hidden")}>Keluar</span>
          <span
            className={cn(
              "pointer-events-none absolute left-full top-1/2 z-[var(--layout-z-tooltip)] ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 opacity-0 shadow-md transition-opacity group-hover:opacity-100 lg:block",
              !isCollapsed && "lg:hidden"
            )}
          >
            Keluar
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[var(--layout-z-overlay)] bg-slate-900/50 backdrop-blur-sm transition-opacity lg:hidden",
          isMobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setIsMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "sticky top-[var(--layout-header-height)] hidden h-[calc(100vh-var(--layout-header-height))] shrink-0 border-r border-slate-200/70 bg-white/90 backdrop-blur-sm transition-[width] duration-300 ease-out lg:flex",
          isCollapsed ? "w-[var(--layout-sidebar-collapsed-width)]" : "w-[var(--layout-sidebar-width)]"
        )}
      >
        {content}
      </aside>

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-[calc(var(--layout-z-overlay)+1)] w-[18rem] max-w-[85vw] border-r border-slate-200 bg-white shadow-2xl transition-transform duration-300 ease-out lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </aside>
    </>
  );
}
