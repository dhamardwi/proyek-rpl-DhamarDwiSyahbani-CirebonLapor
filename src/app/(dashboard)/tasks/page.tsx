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
  title: "Daftar Tugas – CirebonLapor",
  description: "Daftar tugas perbaikan fasilitas umum",
};

export default async function TasksPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "PETUGAS") {
    redirect("/unauthorized");
  }

  const reports = await db.report.findMany({
    where: { assignedTo: session.user.id },
    include: {
      facilityType: true,
      images: {
        where: { imageType: "KERUSAKAN" },
        take: 1,
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const totalTugas = reports.length;
  const selesai = reports.filter((r) => r.status === "SELESAI").length;
  const baru = reports.filter((r) => r.status === "DITUGASKAN").length;
  const diproses = reports.filter((r) => r.status === "SEDANG_DIPERBAIKI").length;

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daftar Tugas Perbaikan</h1>
            <p className="text-sm text-slate-500 mt-1">
              Kelola tugas perbaikan fasilitas umum yang ditugaskan kepada Anda.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <span className="w-3.5 h-3.5 text-slate-400">←</span> Kembali ke Dashboard
          </Link>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-0 hover:shadow-xl transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Tugas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{totalTugas}</p>
          </CardContent>
        </Card>
        <Card className="border-0 hover:shadow-xl transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tugas Baru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{baru}</p>
          </CardContent>
        </Card>
        <Card className="border-0 hover:shadow-xl transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sedang Diproses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">{diproses}</p>
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
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardHeader className="pb-6">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Belum ada tugas
            </CardTitle>
          </CardHeader>
          <CardContent className="py-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-6">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Belum ada tugas
            </h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Anda belum memiliki tugas perbaikan saat ini. Tugas akan muncul di sini setelah Admin
              menugaskannya kepada Anda.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg shadow-sm transition-colors"
            >
              Kembali ke Dashboard
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-6">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Daftar Tugas Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:gap-6">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/tasks/${report.id}`}
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
                          <span className={`text-xs flex items-center gap-1 ml-auto ${priorityColors[report.priority]}`}>
                            <AlertCircle className="w-3.5 h-3.5" />
                            {PRIORITY_LABELS[report.priority as Priority] || report.priority}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                          {report.title}
                        </h3>

                        <div className="flex flex-col gap-1.5 mb-4">
                          <div className="flex items-center gap-1.5 text-sm text-slate-500">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span>
                              Ditugaskan sejak:{" "}
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
                        </div>

                        <div className="text-blue-600 flex items-center gap-1 font-medium text-sm group-hover:translate-x-1 transition-transform">
                          Detail Tugas <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
