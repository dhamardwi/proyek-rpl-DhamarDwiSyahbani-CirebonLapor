import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { FileText, CheckCircle, Wrench, AlertCircle } from "lucide-react";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export const metadata = {
  title: "Dashboard Petugas – CirebonLapor",
  description: "Pantau tugas perbaikan fasilitas umum",
};

const statusBadge: Record<string, string> = {
  DITUGASKAN: "bg-indigo-100 text-indigo-700 border-indigo-200",
  SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700 border-orange-200",
  SELESAI: "bg-green-100 text-green-700 border-green-200",
};

export default async function DashboardPetugasPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "PETUGAS") {
    redirect("/unauthorized");
  }

  // Statistik Petugas
  const totalTugas = await db.report.count({ where: { assignedTo: session.user.id } });

  const tugasBaru = await db.report.count({
    where: { assignedTo: session.user.id, status: "DITUGASKAN" },
  });

  const sedangDikerjakan = await db.report.count({
    where: { assignedTo: session.user.id, status: "SEDANG_DIPERBAIKI" },
  });

  const selesai = await db.report.count({
    where: { assignedTo: session.user.id, status: "SELESAI" },
  });

  // Tugas terbaru
  const recentAssignments = await db.report.findMany({
    where: { assignedTo: session.user.id, status: { not: "SELESAI" } },
    include: { facilityType: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const firstName = session.user.name?.split(" ")[0] || "Petugas";

  const stats: { label: string; value: number; icon: React.ElementType; colorClass: string; iconColor: string }[] = [
    { label: "Total Penugasan", value: totalTugas, icon: FileText, colorClass: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Tugas Baru", value: tugasBaru, icon: AlertCircle, colorClass: "bg-indigo-50", iconColor: "text-indigo-600" },
    { label: "Sedang Diproses", value: sedangDikerjakan, icon: Wrench, colorClass: "bg-orange-50", iconColor: "text-orange-600" },
    { label: "Tugas Selesai", value: selesai, icon: CheckCircle, colorClass: "bg-green-50", iconColor: "text-green-600" },
  ];

  const completionRate = totalTugas > 0 ? Math.round((selesai / totalTugas) * 100) : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Halo, {firstName}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Lihat daftar tugas perbaikan fasilitas yang ditugaskan kepada Anda.
            </p>
          </div>
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            Lihat Semua Tugas <span className="w-3.5 h-3.5 text-slate-100">→</span>
          </Link>
        </div>

        {/* Completion progress */}
        <div className="mt-6">
          <div className="flex justify-between mb-1">
            <span className="text-xs font-medium text-slate-500">Tingkat Selesai Tugas</span>
            <span className="text-xs font-semibold text-slate-900">{completionRate}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-600 rounded-full transition-all duration-1000"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="hover:shadow-xl transition-all border-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${stat.colorClass}`}>
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tugas Aktif */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Tugas Aktif
            </CardTitle>
          </div>
          <Link href="/tasks" className="text-xs font-medium text-blue-600 hover:underline">
            Lihat semua tugas
          </Link>
        </CardHeader>
        <CardContent className="pb-6">
          {recentAssignments.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4">
                <CheckCircle className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Tidak ada tugas aktif
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Anda belum memiliki tugas perbaikan saat ini. Tugas akan muncul di sini setelah Admin menugaskannya kepada Anda.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recentAssignments.map((r) => (
                <div key={r.id} className="px-4 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                          #{r.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-slate-300 text-xs">•</span>
                        <span className="text-xs font-medium text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded">
                          {r.facilityType.name}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">
                        {r.title}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {new Date(r.createdAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${statusBadge[r.status] ?? "bg-slate-100 text-slate-600 border"}`}>
                      {REPORT_STATUS_LABELS[r.status as ReportStatus] ?? r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
