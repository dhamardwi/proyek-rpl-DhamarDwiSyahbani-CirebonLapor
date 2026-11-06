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
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <div className="space-y-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Administrator</h1>
            <p className="text-sm text-slate-500 mt-1">
              Ringkasan seluruh data pelaporan kerusakan fasilitas umum.
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <ShieldAlert className="w-4 h-4" />
            Kelola Laporan
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend?.up ? TrendingUp : TrendingDown;
          return (
            <Card key={i} className="hover:shadow-xl transition-all group">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                </div>
                {stat.trend && (
                  <div className="flex items-center gap-1">
                    <TrendIcon className={`w-3 h-3 ${stat.trend.up ? "text-green-500" : "text-red-500"}`} />
                    <span className={`text-xs font-semibold ${stat.trend.up ? "text-green-600" : "text-red-600"}`}>
                      {stat.trend.value}
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                {stat.trend && (
                  <p className="text-xs text-slate-400 mt-1">{stat.trend.label}</p>
                )}
              </CardContent>
              <CardFooter>
                <Link
                  href={stat.href}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  Lihat detail <span className="w-3.5 h-3.5 text-slate-400">→</span>
                </Link>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <AdminCharts
          statusData={statusData}
          facilityData={facilityData}
          damageData={damageData}
        />
      </div>
    </div>
  );
}
