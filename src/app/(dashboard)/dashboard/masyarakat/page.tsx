import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { FileText, Clock, CheckCircle, PlusCircle, AlertCircle } from "lucide-react";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = {
  title: "Dashboard Masyarakat – CirebonLapor",
  description: "Pantau laporan fasilitas umum Anda",
};

const statusBadge: Record<string, string> = {
  MENUNGGU_VERIFIKASI: "bg-yellow-100 text-yellow-700 border-yellow-200",
  DIPROSES_AI: "bg-blue-100 text-blue-700 border-blue-200",
  DITERIMA: "bg-teal-100 text-teal-700 border-teal-200",
  DITOLAK: "bg-red-100 text-red-700 border-red-200",
  DITUGASKAN: "bg-indigo-100 text-indigo-700 border-indigo-200",
  SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700 border-orange-200",
  SELESAI: "bg-green-100 text-green-700 border-green-200",
};

export default async function DashboardMasyarakatPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "MASYARAKAT") {
    redirect("/unauthorized");
  }

  // Ambil laporan milik user ini
  const reports = await db.report.findMany({
    where: { userId: session.user.id },
    include: { facilityType: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const totalReports = await db.report.count({ where: { userId: session.user.id } });
  const menunggu = await db.report.count({
    where: { userId: session.user.id, status: "MENUNGGU_VERIFIKASI" },
  });
  const selesai = await db.report.count({
    where: { userId: session.user.id, status: "SELESAI" },
  });
  const ditolak = await db.report.count({
    where: { userId: session.user.id, status: "DITOLAK" },
  });

  const firstName = session.user.name?.split(" ")[0] || "Pengguna";

  const stats: { label: string; value: number; icon: React.ElementType; colorClass: string; iconColor: string }[] = [
    { label: "Total Laporan", value: totalReports, icon: FileText, colorClass: "bg-blue-50", iconColor: "text-blue-600" },
    { label: "Menunggu Verifikasi", value: menunggu, icon: Clock, colorClass: "bg-yellow-50", iconColor: "text-yellow-600" },
    { label: "Selesai", value: selesai, icon: CheckCircle, colorClass: "bg-green-50", iconColor: "text-green-600" },
    { label: "Ditolak", value: ditolak, icon: AlertCircle, colorClass: "bg-red-50", iconColor: "text-red-600" },
  ];

  const completionRate = totalReports > 0 ? Math.round((selesai / totalReports) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Selamat datang, {firstName}
          </h1>
          <p className="text-sm text-slate-500 sm:text-base">
            Pantau status dan perkembangan laporan fasilitas umum Anda.
          </p>
        </div>
        <Link
          href="/reports/create"
          id="btn-buat-laporan"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-medium text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
        >
          <PlusCircle className="h-4 w-4" />
          Buat Laporan
        </Link>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Tingkat penyelesaian laporan</p>
              <p className="text-xs text-slate-500">Persentase laporan yang telah selesai ditangani</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{completionRate}%</p>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${completionRate}%` }} />
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
            <CardTitle className="text-base font-semibold text-slate-900">Laporan Terbaru</CardTitle>
            <p className="mt-0.5 text-sm text-slate-500">Aktivitas pelaporan terkini Anda</p>
          </div>
          <Link href="/my-reports" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
            Lihat semua
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">Belum ada laporan</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                Buat laporan pertama Anda untuk memantau status penanganan fasilitas umum.
              </p>
              <Link
                href="/reports/create"
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                <PlusCircle className="h-4 w-4" />
                Buat laporan sekarang
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reports.map((r) => (
                <Link key={r.id} href={`/my-reports/${r.id}`} className="block px-5 py-4 transition-colors hover:bg-slate-50/70 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">#{r.id.slice(-6).toUpperCase()}</span>
                        <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                          {r.facilityType.name}
                        </span>
                      </div>
                      <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
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
