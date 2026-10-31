import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import {
  Search, ChevronRight
} from "lucide-react";
import {
  REPORT_STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY,
  type ReportStatus,
  type Priority
} from "@/lib/constants";
import { Prisma } from "@prisma/client";

const VALID_PRIORITIES = new Set<string>(Object.values(PRIORITY));

export const metadata = {
  title: "Manajemen Laporan – Admin",
};

const statusColors: Record<string, string> = {
  MENUNGGU_VERIFIKASI: "bg-yellow-100 text-yellow-700 border-yellow-200",
  DIPROSES_AI: "bg-blue-100 text-blue-700 border-blue-200",
  DITERIMA: "bg-teal-100 text-teal-700 border-teal-200",
  DITOLAK: "bg-red-100 text-red-700 border-red-200",
  DITUGASKAN: "bg-indigo-100 text-indigo-700 border-indigo-200",
  SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700 border-orange-200",
  SELESAI: "bg-green-100 text-green-700 border-green-200",
};

const priorityColors: Record<string, string> = {
  RENDAH: "text-slate-500",
  SEDANG: "text-blue-500",
  TINGGI: "text-orange-500",
  KRITIS: "text-red-600 font-bold",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const sp = await searchParams;
  const query = typeof sp.q === 'string' ? sp.q : undefined;
  const statusFilter = typeof sp.status === 'string' ? sp.status : undefined;
  const facilityFilter = typeof sp.facility === 'string' ? sp.facility : undefined;
  const priorityParam = typeof sp.priority === 'string' ? sp.priority : undefined;
  // Dukung ?priority=TINGGI,KRITIS (dipakai kartu dashboard "Prioritas Tinggi")
  const priorityFilter = priorityParam
    ? priorityParam.split(",").map((s) => s.trim().toUpperCase()).filter((s) => VALID_PRIORITIES.has(s))
    : [];
  const page = typeof sp.page === 'string' ? parseInt(sp.page) : 1;
  const perPage = 10;

  const where: Prisma.ReportWhereInput = {};
  
  if (query) {
    where.OR = [
      { title: { contains: query } },
      { address: { contains: query } },
      { id: { contains: query } },
      { user: { name: { contains: query } } }
    ];
  }
  if (statusFilter && statusFilter !== 'ALL') {
    where.status = statusFilter;
  }
  if (facilityFilter && facilityFilter !== 'ALL') {
    where.facilityTypeId = facilityFilter;
  }
  if (priorityFilter.length > 0) {
    where.priority = { in: priorityFilter };
  }

  const [total, reports, facilities] = await Promise.all([
    db.report.count({ where }),
    db.report.findMany({
      where,
      include: {
        facilityType: true,
        user: { select: { name: true } },
        assignee: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.facilityType.findMany({ orderBy: { name: "asc" } })
  ]);

  const totalPages = Math.ceil(total / perPage);
  // Pertahankan filter prioritas (dari kartu dashboard) saat paginasi/cari
  const priorityQuery = priorityFilter.length > 0 ? `&priority=${priorityFilter.join(",")}` : "";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Manajemen Laporan</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola dan pantau seluruh laporan dari masyarakat
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mb-6">
        <form className="flex flex-col sm:flex-row gap-4">
          {priorityFilter.length > 0 && (
            <input type="hidden" name="priority" value={priorityFilter.join(",")} />
          )}
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              name="q"
              defaultValue={query}
              placeholder="Cari ID, judul, alamat, pelapor..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
            />
          </div>
          
          <div className="flex gap-4">
            <select 
              name="status" 
              defaultValue={statusFilter || 'ALL'}
              className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm bg-white"
            >
              <option value="ALL">Semua Status</option>
              {Object.entries(REPORT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select 
              name="facility" 
              defaultValue={facilityFilter || 'ALL'}
              className="px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm bg-white"
            >
              <option value="ALL">Semua Fasilitas</option>
              {facilities.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>

            <button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-2 rounded-xl font-medium text-sm transition-colors">
              Filter
            </button>
          </div>
        </form>
        {priorityFilter.length > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-slate-500">Filter prioritas:</span>
            <span className="font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
              {priorityFilter.join(", ")}
            </span>
            <Link
              href={`/admin/reports?${[
                query ? `q=${encodeURIComponent(query)}` : "",
                statusFilter ? `status=${statusFilter}` : "",
                facilityFilter ? `facility=${facilityFilter}` : "",
              ].filter(Boolean).join("&")}`}
              className="text-blue-600 hover:underline font-medium"
            >
              Hapus filter prioritas
            </Link>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Info Laporan</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status & Prioritas</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Petugas</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada data laporan yang ditemukan.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                        #{report.id.slice(-6).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 line-clamp-1">{report.title}</span>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <span className="text-blue-600 font-medium">{report.facilityType.name}</span>
                          <span>•</span>
                          <span>Oleh: {report.user.name}</span>
                        </div>
                        <span className="text-xs text-slate-400 mt-1">
                          {new Date(report.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2 items-start">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColors[report.status] || "bg-slate-100 text-slate-600"}`}>
                          {REPORT_STATUS_LABELS[report.status as ReportStatus] || report.status}
                        </span>
                        {report.priority !== "RENDAH" && (
                          <span className={`text-xs font-medium ${priorityColors[report.priority]}`}>
                            P: {PRIORITY_LABELS[report.priority as Priority]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {report.assignee ? (
                        <span className="text-sm text-slate-700">{report.assignee.name}</span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Belum ditugaskan</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link 
                        href={`/admin/reports/${report.id}`}
                        className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Lihat Detail"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (Simple) */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">
              Halaman {page} dari {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={`/admin/reports?page=${page - 1}${query ? `&q=${query}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}${facilityFilter ? `&facility=${facilityFilter}` : ''}${priorityQuery}`}
                  className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Sebelumnya
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/admin/reports?page=${page + 1}${query ? `&q=${query}` : ''}${statusFilter ? `&status=${statusFilter}` : ''}${facilityFilter ? `&facility=${facilityFilter}` : ''}${priorityQuery}`}
                  className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Selanjutnya
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
