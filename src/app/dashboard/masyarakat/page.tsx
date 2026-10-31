import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { FileText, Clock, CheckCircle, PlusCircle } from "lucide-react";
import Link from "next/link";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/constants";

export const metadata = {
  title: "Dashboard Masyarakat – CirebonLapor",
  description: "Pantau laporan fasilitas umum Anda",
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

  const statusBadge: Record<string, string> = {
    MENUNGGU_VERIFIKASI: "bg-yellow-100 text-yellow-700",
    DIPROSES_AI: "bg-blue-100 text-blue-700",
    DITERIMA: "bg-teal-100 text-teal-700",
    DITOLAK: "bg-red-100 text-red-700",
    DITUGASKAN: "bg-indigo-100 text-indigo-700",
    SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700",
    SELESAI: "bg-green-100 text-green-700",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Selamat datang, {session.user.name?.split(" ")[0]}!
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Pantau dan kelola laporan fasilitas umum Anda
          </p>
        </div>
        <Link
          href="/reports/create"
          id="btn-buat-laporan"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-md shadow-blue-100"
        >
          <PlusCircle className="w-4 h-4" />
          Buat Laporan
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {[
          { label: "Total Laporan", value: totalReports, icon: FileText, colorClass: "bg-blue-100", iconColor: "text-blue-600" },
          { label: "Menunggu", value: menunggu, icon: Clock, colorClass: "bg-yellow-100", iconColor: "text-yellow-600" },
          { label: "Selesai", value: selesai, icon: CheckCircle, colorClass: "bg-green-100", iconColor: "text-green-600" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-2xl border border-slate-100 p-6 flex items-center gap-4 shadow-sm">
              <div className={`p-3 rounded-xl ${stat.colorClass}`}>
                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Laporan Terbaru */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Laporan Terbaru</h2>
          <Link href="/my-reports" className="text-sm text-blue-600 hover:underline font-medium">
            Lihat semua
          </Link>
        </div>

        {reports.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Belum ada laporan. Buat laporan pertama Anda!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {reports.map((r) => (
              <div key={r.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.facilityType.name} · {new Date(r.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0 ${statusBadge[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {REPORT_STATUS_LABELS[r.status as ReportStatus] ?? r.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
