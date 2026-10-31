import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { FileText, CheckCircle, Wrench, AlertCircle } from "lucide-react";
import Link from "next/link";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/lib/constants";

export const metadata = {
  title: "Dashboard Petugas – CirebonLapor",
  description: "Pantau tugas perbaikan fasilitas umum",
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

  const statusBadge: Record<string, string> = {
    DITUGASKAN: "bg-indigo-100 text-indigo-700",
    SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700",
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Halo, Petugas {session.user.name?.split(" ")[0]}
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Lihat daftar tugas perbaikan fasilitas yang ditugaskan kepada Anda.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Penugasan", value: totalTugas, icon: FileText, colorClass: "bg-blue-100", iconColor: "text-blue-600" },
          { label: "Tugas Baru", value: tugasBaru, icon: AlertCircle, colorClass: "bg-indigo-100", iconColor: "text-indigo-600" },
          { label: "Sedang Diproses", value: sedangDikerjakan, icon: Wrench, colorClass: "bg-orange-100", iconColor: "text-orange-600" },
          { label: "Tugas Selesai", value: selesai, icon: CheckCircle, colorClass: "bg-green-100", iconColor: "text-green-600" },
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

      {/* Tugas Aktif */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Tugas Aktif</h2>
          <Link href="/tasks" className="text-sm text-blue-600 hover:underline font-medium">
            Lihat semua tugas
          </Link>
        </div>

        {recentAssignments.length === 0 ? (
          <div className="py-16 text-center">
            <CheckCircle className="w-10 h-10 text-green-200 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">Tidak ada tugas perbaikan aktif saat ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recentAssignments.map((r) => (
              <div key={r.id} className="px-6 py-4 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{r.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.facilityType.name} · {new Date(r.createdAt).toLocaleDateString("id-ID")}
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
