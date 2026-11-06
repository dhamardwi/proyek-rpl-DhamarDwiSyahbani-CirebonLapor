import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
import {
  REPORT_STATUS_LABELS,
  PRIORITY_LABELS,
  PRIORITY,
  type ReportStatus,
  type Priority,
} from "@/lib/constants";
import { Prisma } from "@prisma/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
  KRITIS: "text-red-600 font-semibold",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : undefined;
  const statusFilter = typeof sp.status === "string" ? sp.status : undefined;
  const facilityFilter = typeof sp.facility === "string" ? sp.facility : undefined;
  const priorityParam = typeof sp.priority === "string" ? sp.priority : undefined;
  const priorityFilter = priorityParam
    ? priorityParam.split(",").map((s) => s.trim().toUpperCase()).filter((s) => VALID_PRIORITIES.has(s))
    : [];
  const page = typeof sp.page === "string" ? parseInt(sp.page) : 1;
  const perPage = 10;

  const where: Prisma.ReportWhereInput = {};

  if (query) {
    where.OR = [
      { title: { contains: query } },
      { address: { contains: query } },
      { id: { contains: query } },
      { user: { name: { contains: query } } },
    ];
  }
  if (statusFilter && statusFilter !== "ALL") {
    where.status = statusFilter;
  }
  if (facilityFilter && facilityFilter !== "ALL") {
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
        assignee: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.facilityType.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = Math.ceil(total / perPage);
  const priorityQuery = priorityFilter.length > 0 ? `&priority=${priorityFilter.join(",")}` : "";

  const baseQuery = [
    query ? `q=${encodeURIComponent(query)}` : "",
    statusFilter ? `status=${statusFilter}` : "",
    facilityFilter ? `facility=${facilityFilter}` : "",
    priorityQuery,
  ].filter(Boolean).join("&");

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manajemen Laporan</h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola dan pantau seluruh laporan dari masyarakat
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" /> Kembali
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Filter & Pencarian
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <form className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Cari ID, judul, alamat, pelapor..."
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none"
              />
            </div>
            <Select
              name="status"
              defaultValue={statusFilter || "ALL"}
              className="w-full sm:w-auto max-w-[200px] text-sm"
            >
              <option value="ALL">Semua Status</option>
              {Object.entries(REPORT_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
            <Select
              name="facility"
              defaultValue={facilityFilter || "ALL"}
              className="w-full sm:w-auto max-w-[200px] text-sm"
            >
              <option value="ALL">Semua Fasilitas</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
            <Button type="submit" className="text-sm">
              Filter
            </Button>
          </form>
          {priorityFilter.length > 0 && (
            <div className="mt-4 flex items-center gap-2 text-xs">
              <span className="text-slate-500">Filter prioritas aktif:</span>
              <span className="font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full">
                {priorityFilter.join(", ")}
              </span>
              <Link
                href={`/admin/reports?${baseQuery.replace(priorityQuery, "").replace(/^&/, "") || ""}`}
                className="text-blue-600 hover:underline font-medium"
              >
                Hapus filter prioritas
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Daftar Laporan ({total})
            </CardTitle>
          </div>
          {priorityFilter.length > 0 && (
            <Badge variant="primary">
              {priorityFilter.join(", ")}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Info Laporan</TableHead>
                  <TableHead className="w-48">Status & Prioritas</TableHead>
                  <TableHead className="w-32">Petugas</TableHead>
                  <TableHead className="w-20 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Tidak ada data laporan yang ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-mono text-xs">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          #{report.id.slice(-6).toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 line-clamp-1">
                            {report.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                            <span className="text-blue-600 font-medium">
                              {report.facilityType.name}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>Oleh: {report.user.name}</span>
                          </div>
                          <span className="text-xs text-slate-400 mt-1">
                            {new Date(report.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col gap-2 items-start">
                          <Badge
                            variant={
                              report.status === "SELESAI"
                                ? "success"
                                : report.status === "DITOLAK"
                                  ? "danger"
                                  : report.status === "DITERIMA" || report.status === "DITUGASKAN"
                                    ? "primary"
                                    : "warning"
                            }
                          >
                            {REPORT_STATUS_LABELS[report.status as ReportStatus] || report.status}
                          </Badge>
                          {report.priority !== "RENDAH" && (
                            <span className={`text-xs font-medium ${priorityColors[report.priority]}`}>
                              P: {PRIORITY_LABELS[report.priority as Priority]}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {report.assignee ? (
                          <span className="text-sm text-slate-700">{report.assignee.name}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Belum ditugaskan</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <Link
                          href={`/admin/reports/${report.id}`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Lihat Detail"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <p className="text-sm text-slate-600">
                      Menampilkan {((page - 1) * perPage + 1) || 0} -{" "}
                      {Math.min(page * perPage, total)} dari {total} laporan
                    </p>
                    <div className="flex items-center gap-2">
                      {page > 1 && (
                        <Link
                          href={`/admin/reports?page=${page - 1}${baseQuery ? `&${baseQuery}` : ""}`}
                          className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Sebelumnya
                        </Link>
                      )}
                      <p className="px-3 py-1.5 text-sm text-slate-600">
                        Halaman {page} dari {totalPages}
                      </p>
                      {page < totalPages && (
                        <Link
                          href={`/admin/reports?page=${page + 1}${baseQuery ? `&${baseQuery}` : ""}`}
                          className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          Selanjutnya
                        </Link>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
