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
} from "lucide-react";
import {
  REPORT_STATUS_LABELS,
  PRIORITY_LABELS,
  type ReportStatus,
  type Priority,
} from "@/lib/constants";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Laporan Saya</h1>
            <p className="text-sm text-slate-500 mt-1">
              Pantau status penanganan dari laporan-laporan yang telah Anda buat.
            </p>
          </div>
          <Link
            href="/reports/create"
            id="btn-buat-laporan"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4" />
            Buat Laporan Baru
          </Link>
        </div>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardHeader className="pb-6">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Belum ada laporan
            </CardTitle>
          </CardHeader>
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-6">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Belum ada laporan
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Anda belum pernah membuat laporan kerusakan fasilitas umum.
              Mari bantu desa menjadi lebih baik dengan melaporkan fasilitas yang butuh perbaikan.
            </p>
            <Link
              href="/reports/create"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4" />
              Buat Laporan Sekarang
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Quick stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-0 hover:shadow-xl transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Total Laporan
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{totalReports}</p>
              </CardContent>
            </Card>
            <Card className="border-0 hover:shadow-xl transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Menunggu
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{menunggu}</p>
              </CardContent>
            </Card>
            <Card className="border-0 hover:shadow-xl transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Selesai
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{selesai}</p>
              </CardContent>
            </Card>
            <Card className="border-0 hover:shadow-xl transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Ditolak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-slate-900">{ditolak}</p>
              </CardContent>
            </Card>
          </div>

          {/* Reports list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Laporan Terbaru
                </CardTitle>
              </div>
              <Link href="/my-reports" className="text-xs font-medium text-blue-600 hover:underline">
                Lihat semua
              </Link>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:gap-6">
                {reports.map((report) => (
                  <Link
                    key={report.id}
                    href={`/my-reports/${report.id}`}
                    className="block bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all overflow-hidden group"
                  >
                    <div className="flex flex-col sm:flex-row">
                      {/* Thumbnail */}
                      <div className="relative w-full sm:w-48 h-48 sm:h-auto shrink-0 bg-slate-100">
                        {report.images?.[0] ? (
                          <img
                            src={report.images[0].imagePath}
                            alt={report.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-300">
                            <FileText className="w-10 h-10" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                              #{report.id.slice(-6).toUpperCase()}
                            </span>
                            <span className="text-slate-300 text-xs">•</span>
                            <span className="text-xs font-medium text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded">
                              {report.facilityType.name}
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                            {report.title}
                          </h3>

                          <div className="flex flex-col gap-1.5 mb-4">
                            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                              <Calendar className="w-4 h-4 shrink-0" />
                              <span>
                                {new Date(report.createdAt).toLocaleDateString("id-ID", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-sm text-slate-500">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span className="line-clamp-1">{report.address}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                          <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border ${statusColors[report.status] || "bg-slate-100 text-slate-600"}`}>
                              {REPORT_STATUS_LABELS[report.status as ReportStatus] || report.status}
                            </span>
                            {report.priority !== "RENDAH" && (
                              <span className={`text-xs flex items-center gap-1 ${priorityColors[report.priority]}`}>
                                <AlertCircle className="w-3.5 h-3.5" />
                                {PRIORITY_LABELS[report.priority as Priority] || report.priority}
                              </span>
                            )}
                          </div>

                          <div className="text-blue-600 p-1.5 rounded-full group-hover:bg-blue-50 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
