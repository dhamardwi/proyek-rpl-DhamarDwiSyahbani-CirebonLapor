import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { 
  FileText, Clock, CheckCircle, Wrench, AlertCircle, XCircle, ShieldAlert 
} from "lucide-react";
import AdminCharts from "@/components/admin/AdminCharts";
import { REPORT_STATUS_LABELS, DAMAGE_LEVEL_LABELS } from "@/lib/constants";

export const metadata = {
  title: "Dashboard Admin – CirebonLapor",
  description: "Pusat kendali laporan fasilitas umum",
};

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
    where: { priority: { in: ["TINGGI", "KRITIS"] } } 
  });

  // Chart Data preparation
  // 1. Status Chart
  const statusGroups = await db.report.groupBy({
    by: ['status'],
    _count: { id: true }
  });
  
  const statusData = statusGroups.map(s => ({
    name: REPORT_STATUS_LABELS[s.status as keyof typeof REPORT_STATUS_LABELS] || s.status,
    total: s._count.id
  })).sort((a, b) => b.total - a.total);

  // 2. Facility Chart
  const facilityGroups = await db.report.groupBy({
    by: ['facilityTypeId'],
    _count: { id: true }
  });
  
  // Need to fetch facility names
  const facilities = await db.facilityType.findMany();
  const facilityMap = facilities.reduce((acc, curr) => {
    acc[curr.id] = curr.name;
    return acc;
  }, {} as Record<string, string>);

  const facilityData = facilityGroups.map(f => ({
    name: facilityMap[f.facilityTypeId] || "Unknown",
    value: f._count.id
  })).sort((a, b) => b.value - a.value);

  // 3. Damage Level Chart
  const damageGroups = await db.report.groupBy({
    by: ['damageLevel'],
    _count: { id: true }
  });

  const damageData = damageGroups.map(d => ({
    name: DAMAGE_LEVEL_LABELS[d.damageLevel as keyof typeof DAMAGE_LEVEL_LABELS] || d.damageLevel,
    total: d._count.id
  })).sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Administrator</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ringkasan seluruh data pelaporan kerusakan fasilitas umum.
        </p>
      </div>

      {/* Stats Cards — tiap kartu bisa diklik ke daftar laporan terkait */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Laporan", value: totalReports, icon: FileText, bg: "bg-blue-100", color: "text-blue-600", href: "/admin/reports" },
          { label: "Menunggu Verifikasi", value: waitingVerif, icon: Clock, bg: "bg-yellow-100", color: "text-yellow-600", href: "/admin/reports?status=MENUNGGU_VERIFIKASI" },
          { label: "Sudah Diverifikasi", value: accepted, icon: ShieldAlert, bg: "bg-teal-100", color: "text-teal-600", href: "/admin/reports?status=DITERIMA" },
          { label: "Sedang Diproses", value: processing, icon: Wrench, bg: "bg-orange-100", color: "text-orange-600", href: "/admin/reports?status=SEDANG_DIPERBAIKI" },
          { label: "Selesai", value: completed, icon: CheckCircle, bg: "bg-green-100", color: "text-green-600", href: "/admin/reports?status=SELESAI" },
          { label: "Ditolak", value: rejected, icon: XCircle, bg: "bg-red-100", color: "text-red-600", href: "/admin/reports?status=DITOLAK" },
          { label: "Prioritas Tinggi", value: highPriority, icon: AlertCircle, bg: "bg-purple-100", color: "text-purple-600", href: "/admin/reports?priority=TINGGI,KRITIS" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Link key={i} href={stat.href} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 leading-tight">{stat.value}</p>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts */}
      <AdminCharts 
        statusData={statusData}
        facilityData={facilityData}
        damageData={damageData}
      />
    </div>
  );
}
