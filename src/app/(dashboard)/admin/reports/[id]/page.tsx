import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import ReadOnlyMapDynamic from "@/components/map/ReadOnlyMapDynamic";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  FileText,
} from "lucide-react";
import {
  REPORT_STATUS_LABELS,
  PRIORITY_LABELS,
  DAMAGE_LEVEL_LABELS,
  type ReportStatus,
  type Priority,
  type DamageLevel,
} from "@/lib/constants";
import AdminReportActionForm from "@/components/admin/AdminReportActionForm";
import AIAnalysisCard from "@/components/admin/AIAnalysisCard";
import DuplicateReportCard from "@/components/admin/DuplicateReportCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const statusColors: Record<string, string> = {
  MENUNGGU_VERIFIKASI: "bg-yellow-100 text-yellow-700",
  DIPROSES_AI: "bg-blue-100 text-blue-700",
  DITERIMA: "bg-teal-100 text-teal-700",
  DITOLAK: "bg-red-100 text-red-700",
  DITUGASKAN: "bg-indigo-100 text-indigo-700",
  SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700",
  SELESAI: "bg-green-100 text-green-700",
};

const priorityBadge: Record<string, string> = {
  RENDAH: "bg-slate-100 text-slate-600",
  SEDANG: "bg-blue-100 text-blue-600",
  TINGGI: "bg-orange-100 text-orange-600",
  KRITIS: "bg-red-100 text-red-700",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Admin Detail Laporan #${id.slice(-6).toUpperCase()} – CirebonLapor`,
  };
}

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const [report, petugasList] = await Promise.all([
    db.report.findUnique({
      where: { id },
      include: {
        facilityType: true,
        images: true,
        user: { select: { name: true, email: true } },
        assignee: { select: { name: true, role: true } },
        statusHistory: {
          orderBy: { createdAt: "desc" },
          include: {
            updatedBy: { select: { name: true, role: true } },
          },
        },
        duplicateAnalyses: {
          orderBy: { similarityScore: "desc" },
          take: 5,
          include: {
            candidate: { select: { id: true, title: true, status: true } },
          },
        },
      },
    }),
    db.user.findMany({
      where: { role: "PETUGAS", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!report) {
    notFound();
  }

  const kerusakanImages = report.images.filter((img) => img.imageType === "KERUSAKAN");
  const perbaikanImages = report.images.filter((img) => img.imageType === "BUKTI_PERBAIKAN");

  return (
    <div className="space-y-6 sm:space-y-8">
      <Link
        href="/admin/reports"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Manajemen Laporan
      </Link>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
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
              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                {report.facilityType.name}
              </span>
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${priorityBadge[report.priority] || "bg-slate-100 text-slate-600"}`}>
                Prioritas: {PRIORITY_LABELS[report.priority as Priority] || report.priority}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {report.title}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {new Date(report.createdAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
                  #{report.id.slice(-6).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2 lg:space-y-8">
          {/* Foto Kerusakan */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Foto Kerusakan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative h-64 w-full bg-slate-100 sm:h-96">
                {kerusakanImages.length > 0 ? (
                  <img
                    src={kerusakanImages[0].imagePath}
                    alt="Foto Kerusakan"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-400">
                    <FileText className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-slate-900">
                    Deskripsi Kerusakan
                  </h3>
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                    {report.description || "Tidak ada deskripsi."}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">
                      Tingkat Kerusakan
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {DAMAGE_LEVEL_LABELS[report.damageLevel as DamageLevel] || report.damageLevel}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">
                      Prioritas
                    </p>
                    <p className="text-sm font-semibold text-slate-900">
                      {PRIORITY_LABELS[report.priority as Priority] || report.priority}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ====== AI ANALYSIS CARD ====== */}
          <AIAnalysisCard aiAnalysis={report.aiAnalysis} showForRole="ADMIN" />

          {/* ====== DUPLICATE REPORT CARD ====== */}
          <DuplicateReportCard
            analyses={report.duplicateAnalyses.map((analysis) => ({
              id: analysis.id,
              candidateReportId: analysis.candidateReportId,
              candidateTitle: analysis.candidate.title,
              similarityScore: analysis.similarityScore,
              distanceMeters: analysis.distanceMeters,
              isPotential: analysis.isPotential,
              adminStatus: analysis.adminStatus,
              aiAnalysis: analysis.aiAnalysis,
            }))}
          />

          {/* Foto Bukti Perbaikan */}
          {perbaikanImages.length > 0 && (
            <Card className="overflow-hidden rounded-2xl border-green-100 shadow-sm">
              <CardHeader className="border-b border-green-100 bg-green-50/60 pb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-green-900">
                    Bukti Perbaikan
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="relative h-64 w-full overflow-hidden rounded-xl border border-slate-100 bg-white sm:h-96">
                  <img
                    src={perbaikanImages[0].imagePath}
                    alt="Bukti Perbaikan"
                    className="h-full w-full object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lokasi */}
          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                Lokasi Kejadian
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 sm:p-6">
              <p className="text-slate-700">{report.address}</p>
              {report.latitude && report.longitude && (
                <div className="h-64 w-full overflow-hidden rounded-xl border border-slate-200 sm:h-72">
                  <ReadOnlyMapDynamic position={[report.latitude, report.longitude]} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <AdminReportActionForm
            reportId={report.id}
            currentStatus={report.status}
            currentPriority={report.priority}
            currentAssigneeId={report.assignedTo}
            petugasList={petugasList}
          />

          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                Informasi Terkait
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-5 sm:p-6">
              <div>
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-900">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  Pelapor (Warga)
                </h3>
                <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-600">
                    {report.user.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{report.user.name}</p>
                    <p className="truncate text-xs text-slate-500">{report.user.email}</p>
                  </div>
                </div>
              </div>

              {report.assignee && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-900">
                    <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
                    Petugas Ditugaskan
                  </h3>
                  <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-600">
                      {report.assignee.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{report.assignee.name}</p>
                      <p className="text-xs text-slate-500">Petugas Lapangan</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-slate-200/80 shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                Riwayat Status
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 sm:p-6">
              <div className="space-y-6">
                {report.statusHistory.map((history, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <div key={history.id} className="relative pl-7">
                      {idx !== report.statusHistory.length - 1 && (
                        <div className="absolute bottom-[-24px] left-[9px] top-6 w-px bg-slate-200" />
                      )}
                      <div className={`absolute left-0 top-1.5 h-5 w-5 rounded-full border-4 border-white shadow-sm ${isLatest ? "bg-blue-500" : "bg-slate-300"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${isLatest ? "text-slate-900" : "text-slate-600"}`}>
                          {REPORT_STATUS_LABELS[history.status as ReportStatus] || history.status}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {new Date(history.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {history.note && (
                          <p className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                            {history.note}
                          </p>
                        )}
                        {history.updatedBy && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Oleh {history.updatedBy.name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
