import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { FileText, CheckCircle, Wrench, AlertCircle } from "lucide-react";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Halo, {firstName}</h1>
          <p className="text-sm text-slate-500 sm:text-base">
            Kelola dan pantau tugas perbaikan fasilitas yang ditugaskan kepada Anda.
          </p>
        </div>
        <Link
          href="/tasks"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          Lihat Semua Tugas
        </Link>
      </div>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Tingkat penyelesaian tugas</p>
              <p className="text-xs text-slate-500">Progress tugas yang telah Anda selesaikan</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.colorClass}`}>
                  <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900">{stat.value}</p>
                  <p className="text-xs font-medium text-slate-500 sm:text-sm">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Tugas Aktif</CardTitle>
            <p className="mt-0.5 text-sm text-slate-500">Daftar tugas yang perlu ditindaklanjuti</p>
          </div>
          <Link href="/tasks" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">Lihat semua</Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentAssignments.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                <CheckCircle className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">Tidak ada tugas aktif</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Tugas baru akan muncul di sini setelah ditugaskan oleh admin.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAssignments.map((r) => (
                <Link key={r.id} href={`/tasks/${r.id}`} className="block px-5 py-4 transition-colors hover:bg-slate-50/70 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">#{r.id.slice(-6).toUpperCase()}</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">{r.facilityType.name}</span>
                      </div>
                      <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadge[r.status] ?? "border-slate-200 bg-slate-100 text-slate-600"}`}>
                      {REPORT_STATUS_LABELS[r.status as ReportStatus] ?? r.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
