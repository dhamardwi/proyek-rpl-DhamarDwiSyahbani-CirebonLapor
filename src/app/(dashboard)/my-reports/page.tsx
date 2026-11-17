/* eslint-disable @next/next/no-img-element -- gambar upload dengan dimensi dinamis; <Image> akan mengubah layout & tampilan */
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import {
  FileText,
  Calendar,
  MapPin,
  AlertCircle,
  ChevronRight,
  Plus,
  Inbox,
} from "lucide-react";
import {
  REPORT_STATUS_LABELS,
  PRIORITY_LABELS,
  type ReportStatus,
  type Priority,
} from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const statusVariant: Record<string, "warning" | "primary" | "success" | "danger" | "default"> = {
  MENUNGGU_VERIFIKASI: "warning",
  DIPROSES_AI: "primary",
  DITERIMA: "primary",
  DITOLAK: "danger",
  DITUGASKAN: "primary",
  SEDANG_DIPERBAIKI: "warning",
  SELESAI: "success",
};

const priorityStyles: Record<string, string> = {
  RENDAH: "text-slate-500",
  SEDANG: "text-blue-600",
  TINGGI: "text-orange-600",
  KRITIS: "text-red-600 font-semibold",
};

export const metadata = {
  title: "Laporan Saya – CirebonLapor",
  description: "Daftar laporan fasilitas umum yang Anda buat",
};

export default async function MyReportsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/my-reports");
  }

  const reports = await db.report.findMany({
    where: { userId: session.user.id },
    include: {
      facilityType: true,
      images: {
        where: { imageType: "KERUSAKAN" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalReports = reports.length;
  const selesai = reports.filter((r) => r.status === "SELESAI").length;
  const ditolak = reports.filter((r) => r.status === "DITOLAK").length;
  const menunggu = reports.filter((r) => r.status === "MENUNGGU_VERIFIKASI").length;

  const stats = [
    { label: "Total Laporan", value: totalReports },
    { label: "Menunggu Verifikasi", value: menunggu },
    { label: "Selesai", value: selesai },
    { label: "Ditolak", value: ditolak },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Laporan Saya
          </h1>
          <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
            Pantau status dan riwayat penanganan laporan fasilitas umum yang telah Anda kirim.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/reports/create" id="btn-buat-laporan">
            <Plus className="h-4 w-4" />
            Buat Laporan Baru
          </Link>
        </Button>
      </div>

      {reports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 ring-1 ring-inset ring-slate-200/60">
              <Inbox className="h-8 w-8" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Belum ada laporan</h2>
            <p className="mt-2 max-w-md text-sm text-slate-500">
              Anda belum pernah membuat laporan kerusakan fasilitas umum. Bantu lingkungan Anda dengan
              melaporkan fasilitas yang memerlukan perbaikan.
            </p>
            <Button asChild className="mt-6">
              <Link href="/reports/create">
                <FileText className="h-4 w-4" />
                Buat Laporan Sekarang
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-5 sm:p-6">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                    {stat.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Reports list */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Daftar Laporan
              </h2>
              <span className="text-xs text-slate-400">{totalReports} laporan</span>
            </div>

            <div className="grid gap-4">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/my-reports/${report.id}`}
                  className="group block overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  <div className="flex flex-col sm:flex-row">
                    {/* Thumbnail */}
                    <div className="relative h-44 w-full shrink-0 bg-slate-100 sm:h-auto sm:w-52 lg:w-56">
                      {report.images?.[0] ? (
                        <img
                          src={report.images[0].imagePath}
                          alt={report.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <FileText className="h-10 w-10" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                            #{report.id.slice(-6).toUpperCase()}
                          </span>
                          <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                            {report.facilityType.name}
                          </span>
                          {report.priority !== "RENDAH" && (
                            <span
                              className={`ml-auto inline-flex items-center gap-1 text-xs font-medium ${priorityStyles[report.priority] || "text-slate-500"}`}
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                              {PRIORITY_LABELS[report.priority as Priority] || report.priority}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-semibold leading-snug text-slate-900 transition-colors group-hover:text-blue-700 sm:text-lg line-clamp-2">
                          {report.title}
                        </h3>

                        <div className="flex flex-col gap-1.5 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
                            <span>
                              {new Date(report.createdAt).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="line-clamp-1">{report.address}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                        <Badge variant={statusVariant[report.status] || "default"}>
                          {REPORT_STATUS_LABELS[report.status as ReportStatus] || report.status}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 transition-transform group-hover:translate-x-0.5">
                          Lihat detail
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
