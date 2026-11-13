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
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Administrasi</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Manajemen Laporan</h1>
          <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
            Kelola, filter, dan tinjau seluruh laporan masyarakat dalam satu tampilan yang rapi.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-semibold text-slate-900">Filter & Pencarian</CardTitle>
          <p className="mt-0.5 text-sm text-slate-500">Saring laporan berdasarkan kata kunci, status, atau fasilitas.</p>
        </CardHeader>
        <CardContent className="pt-5">
          <form className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_220px_220px_auto] lg:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="q" className="sr-only">Pencarian</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="q"
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="Cari ID, judul, alamat, atau pelapor..."
                  className="h-10 pl-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="status" className="sr-only">Status</Label>
              <Select id="status" name="status" defaultValue={statusFilter || "ALL"} className="h-10">
                <option value="ALL">Semua Status</option>
                {Object.entries(REPORT_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="facility" className="sr-only">Fasilitas</Label>
              <Select id="facility" name="facility" defaultValue={facilityFilter || "ALL"} className="h-10">
                <option value="ALL">Semua Fasilitas</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" className="h-10 w-full lg:w-auto lg:min-w-[104px]">Terapkan</Button>
          </form>
          {priorityFilter.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Filter prioritas aktif:</span>
              <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 font-semibold text-orange-700">
                {priorityFilter.join(", ")}
              </span>
              <Link
                href={`/admin/reports?${baseQuery.replace(priorityQuery, "").replace(/^&/, "") || ""}`}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Hapus filter
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-white/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Daftar Laporan
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">Total {total} laporan ditemukan</p>
          </div>
          {priorityFilter.length > 0 && (
            <Badge variant="primary" className="w-fit">
              Prioritas: {priorityFilter.join(", ")}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader className="bg-slate-50/80">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="w-24 px-5">ID</TableHead>
                  <TableHead className="px-5">Info Laporan</TableHead>
                  <TableHead className="w-52 px-5">Status & Prioritas</TableHead>
                  <TableHead className="w-40 px-5">Petugas</TableHead>
                  <TableHead className="w-24 px-5 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5} className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md space-y-2">
                        <p className="text-base font-semibold text-slate-800">Tidak ada laporan ditemukan</p>
                        <p className="text-sm text-slate-500">Coba ubah kata kunci atau filter untuk melihat hasil lainnya.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((report) => (
                    <TableRow key={report.id} className="border-slate-100 transition-colors hover:bg-slate-50/70">
                      <TableCell className="px-5 py-4 align-top font-mono text-xs">
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-600">
                          #{report.id.slice(-6).toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="line-clamp-1 font-medium text-slate-900">
                            {report.title}
                          </span>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span className="font-medium text-blue-600">
                              {report.facilityType.name}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span>Oleh: {report.user.name}</span>
                          </div>
                          <span className="mt-1.5 text-xs text-slate-400">
                            {new Date(report.createdAt).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 align-top">
                        <div className="flex flex-col items-start gap-2">
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
                              Prioritas: {PRIORITY_LABELS[report.priority as Priority]}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 align-top">
                        {report.assignee ? (
                          <span className="text-sm font-medium text-slate-700">{report.assignee.name}</span>
                        ) : (
                          <span className="text-xs italic text-slate-400">Belum ditugaskan</span>
                        )}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-right align-top">
                        <Link
                          href={`/admin/reports/${report.id}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-blue-50"
                          title="Lihat Detail"
                          aria-label={`Lihat detail laporan ${report.id}`}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Menampilkan <span className="font-medium text-slate-900">{((page - 1) * perPage + 1) || 0}</span> -{" "}
                <span className="font-medium text-slate-900">{Math.min(page * perPage, total)}</span> dari{" "}
                <span className="font-medium text-slate-900">{total}</span> laporan
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={page > 1 ? `/admin/reports?page=${page - 1}${baseQuery ? `&${baseQuery}` : ""}` : "#"}
                  aria-disabled={page <= 1}
                  className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                    page > 1
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "pointer-events-none border-slate-100 bg-slate-100 text-slate-400"
                  }`}
                >
                  Sebelumnya
                </Link>
                <p className="px-2 text-sm text-slate-600">
                  Halaman <span className="font-medium text-slate-900">{page}</span> dari{" "}
                  <span className="font-medium text-slate-900">{totalPages}</span>
                </p>
                <Link
                  href={page < totalPages ? `/admin/reports?page=${page + 1}${baseQuery ? `&${baseQuery}` : ""}` : "#"}
                  aria-disabled={page >= totalPages}
                  className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
                    page < totalPages
                      ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      : "pointer-events-none border-slate-100 bg-slate-100 text-slate-400"
                  }`}
                >
                  Selanjutnya
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
