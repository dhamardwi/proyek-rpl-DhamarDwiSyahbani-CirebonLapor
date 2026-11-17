import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import {
  FileText,
  Clock,
  CheckCircle,
  Wrench,
  AlertCircle,
  XCircle,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import AdminCharts from "@/components/admin/AdminCharts";
import { REPORT_STATUS_LABELS, DAMAGE_LEVEL_LABELS } from "@/lib/constants";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";

export const metadata = {
  title: "Dashboard Admin – CirebonLapor",
  description: "Pusat kendali laporan fasilitas umum",
};

interface StatCard {
  label: string;
  value: number;
  icon: React.ElementType;
  bg: string;
  color: string;
  href: string;
  trend?: { value: string; label: string; up: boolean };
}

export default async function DashboardAdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  // Aggregate Stats
  const totalReports = await db.report.count();
  const waitingVerif = await db.report.count({ where: { status: "MENUNGGU_VERIFIKASI" } });
  const accepted = await db.report.count({ where: { status: "DITERIMA" } });
  const processing = await db.report.count({ where: { status: "SEDANG_DIPERBAIKI" } });
  const completed = await db.report.count({ where: { status: "SELESAI" } });
  const rejected = await db.report.count({ where: { status: "DITOLAK" } });

  const highPriority = await db.report.count({
    where: { priority: { in: ["TINGGI", "KRITIS"] } },
  });

  // Chart Data preparation
  const statusGroups = await db.report.groupBy({
    by: ["status"],
    _count: { id: true },
  });

  const statusData = statusGroups.map((s) => ({
    name: REPORT_STATUS_LABELS[s.status as keyof typeof REPORT_STATUS_LABELS] || s.status,
    total: s._count.id,
  })).sort((a, b) => b.total - a.total);

  const facilityGroups = await db.report.groupBy({
    by: ["facilityTypeId"],
    _count: { id: true },
  });

  const facilities = await db.facilityType.findMany();
  const facilityMap = facilities.reduce((acc, curr) => {
    acc[curr.id] = curr.name;
    return acc;
  }, {} as Record<string, string>);

  const facilityData = facilityGroups.map((f) => ({
    name: facilityMap[f.facilityTypeId] || "Unknown",
    value: f._count.id,
  })).sort((a, b) => b.value - a.value);

  const damageGroups = await db.report.groupBy({
    by: ["damageLevel"],
    _count: { id: true },
  });

  const damageData = damageGroups.map((d) => ({
    name: DAMAGE_LEVEL_LABELS[d.damageLevel as keyof typeof DAMAGE_LEVEL_LABELS] || d.damageLevel,
    total: d._count.id,
  })).sort((a, b) => b.total - a.total);

  const stats: StatCard[] = [
    {
      label: "Total Laporan",
      value: totalReports,
      icon: FileText,
      bg: "bg-blue-50",
      color: "text-blue-600",
      href: "/admin/reports",
      trend: { value: "+12%", label: "vs bulan lalu", up: true },
    },
    {
      label: "Menunggu Verifikasi",
      value: waitingVerif,
      icon: Clock,
      bg: "bg-yellow-50",
      color: "text-yellow-600",
      href: "/admin/reports?status=MENUNGGU_VERIFIKASI",
      trend: { value: "-5%", label: "vs kemarin", up: true },
    },
    {
      label: "Sudah Diverifikasi",
      value: accepted,
      icon: ShieldAlert,
      bg: "bg-teal-50",
      color: "text-teal-600",
      href: "/admin/reports?status=DITERIMA",
      trend: { value: "+8%", label: "vs minggu lalu", up: true },
    },
    {
      label: "Sedang Diproses",
      value: processing,
      icon: Wrench,
      bg: "bg-orange-50",
      color: "text-orange-600",
      href: "/admin/reports?status=SEDANG_DIPERBAIKI",
      trend: { value: "+3%", label: "vs hari ini", up: false },
    },
    {
      label: "Selesai",
      value: completed,
      icon: CheckCircle,
      bg: "bg-green-50",
      color: "text-green-600",
      href: "/admin/reports?status=SELESAI",
      trend: { value: "+15%", label: "vs bulan lalu", up: true },
    },
    {
      label: "Ditolak",
      value: rejected,
      icon: XCircle,
      bg: "bg-red-50",
      color: "text-red-600",
      href: "/admin/reports?status=DITOLAK",
      trend: { value: "-2%", label: "vs kemarin", up: true },
    },
    {
      label: "Prioritas Tinggi",
      value: highPriority,
      icon: AlertCircle,
      bg: "bg-purple-50",
      color: "text-purple-600",
      href: "/admin/reports?priority=TINGGI,KRITIS",
      trend: { value: "+20%", label: "vs bulan lalu", up: false },
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard Administrator</h1>
          <p className="text-sm text-slate-500 sm:text-base">
            Ringkasan dan analitik pelaporan fasilitas umum secara menyeluruh.
          </p>
        </div>
        <Link
          href="/admin/reports"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          <ShieldAlert className="h-4 w-4" />
          Kelola Laporan
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend?.up ? TrendingUp : TrendingDown;
          return (
            <Link key={i} href={stat.href} className="group block">
              <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  {stat.trend && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${stat.trend.up ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      <TrendIcon className="h-3 w-3" />
                      {stat.trend.value}
                    </span>
                  )}
                </CardHeader>
                <CardContent className="pb-4">
                  <p className="text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                  <p className="mt-1 text-sm font-medium text-slate-600">{stat.label}</p>
                  {stat.trend && <p className="mt-1 text-xs text-slate-400">{stat.trend.label}</p>}
                </CardContent>
                <CardFooter className="border-t border-slate-100 pt-3 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                  Lihat detail →
                </CardFooter>
              </Card>
            </Link>
          );
        })}
      </div>

      <AdminCharts
        statusData={statusData}
        facilityData={facilityData}
        damageData={damageData}
      />
    </div>
  );
}
