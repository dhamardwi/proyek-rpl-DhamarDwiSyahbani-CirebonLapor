/* eslint-disable @next/next/no-img-element -- gambar upload dengan dimensi dinamis; <Image> akan mengubah layout & tampilan */
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
  ImageOff,
} from "lucide-react";
import {
  REPORT_STATUS_LABELS,
  PRIORITY_LABELS,
  DAMAGE_LEVEL_LABELS,
  type ReportStatus,
  type Priority,
  type DamageLevel,
} from "@/lib/constants";
import TaskActionForm from "@/components/tasks/TaskActionForm";
import AIAnalysisCard from "@/components/admin/AIAnalysisCard";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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

const priorityVariant: Record<string, "default" | "primary" | "warning" | "danger"> = {
  RENDAH: "default",
  SEDANG: "primary",
  TINGGI: "warning",
  KRITIS: "danger",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Detail Tugas #${id.slice(-6).toUpperCase()} – CirebonLapor`,
  };
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=/tasks/${id}`);
  }

  if (session.user.role !== "PETUGAS" && session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const report = await db.report.findUnique({
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
    },
  });

  if (!report) {
    notFound();
  }

  // Otorisasi: petugas hanya bisa melihat tugas miliknya
  if (session.user.role === "PETUGAS" && report.assignedTo !== session.user.id) {
    redirect("/unauthorized");
  }

  const kerusakanImages = report.images.filter((img) => img.imageType === "KERUSAKAN");
  const perbaikanImages = report.images.filter((img) => img.imageType === "BUKTI_PERBAIKAN");

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Back */}
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-slate-600">
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Daftar Tugas
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant[report.status] || "default"}>
              {REPORT_STATUS_LABELS[report.status as ReportStatus] || report.status}
            </Badge>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
              {report.facilityType.name}
            </span>
            <Badge variant={priorityVariant[report.priority] || "default"}>
              Prioritas: {PRIORITY_LABELS[report.priority as Priority] || report.priority}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {report.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-slate-400" />
              {new Date(report.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">
              #{report.id.slice(-6).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2 lg:space-y-8">
          {/* Foto Kerusakan */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-slate-100 bg-slate-50/60">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-600">
                Foto Kerusakan
              </CardTitle>
            </CardHeader>
            <div className="relative h-64 w-full bg-slate-100 sm:h-80 lg:h-96">
              {kerusakanImages.length > 0 ? (
                <img
                  src={kerusakanImages[0].imagePath}
                  alt="Foto Kerusakan"
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate-400">
                  <ImageOff className="h-8 w-8" />
                  <span className="text-sm">Tidak ada foto</span>
                </div>
              )}
            </div>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Deskripsi Kerusakan
                </h3>
                <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                  {report.description || "Tidak ada deskripsi."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Tingkat Kerusakan
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {DAMAGE_LEVEL_LABELS[report.damageLevel as DamageLevel] || report.damageLevel}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-100">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Prioritas
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {PRIORITY_LABELS[report.priority as Priority] || report.priority}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          <AIAnalysisCard aiAnalysis={report.aiAnalysis} showForRole="PETUGAS" />

          {/* Bukti Perbaikan */}
          {perbaikanImages.length > 0 && (
            <Card className="overflow-hidden border-green-200/70">
              <CardHeader className="border-b border-green-100 bg-green-50/60">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-green-800">
                    Bukti Perbaikan
                  </CardTitle>
                </div>
              </CardHeader>
              <div className="relative h-64 w-full bg-white p-4 sm:h-80 lg:h-96">
                <img
                  src={perbaikanImages[0].imagePath}
                  alt="Bukti Perbaikan"
                  className="h-full w-full rounded-xl object-contain"
                />
              </div>
            </Card>
          )}

          {/* Lokasi */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-600">
                <MapPin className="h-4 w-4 text-slate-400" />
                Lokasi Kejadian
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <p className="text-sm leading-relaxed text-slate-700 sm:text-base">{report.address}</p>
              {report.latitude && report.longitude && (
                <div className="h-64 w-full overflow-hidden rounded-xl border border-slate-200/80 sm:h-72">
                  <ReadOnlyMapDynamic position={[report.latitude, report.longitude]} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Aksi Petugas */}
          <TaskActionForm reportId={report.id} currentStatus={report.status} />

          {/* Informasi Pelapor */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-600">
                <User className="h-4 w-4 text-slate-400" />
                Informasi Pelapor
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700 ring-4 ring-blue-50">
                  {report.user.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{report.user.name}</p>
                  <p className="truncate text-xs text-slate-500">{report.user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Riwayat Status */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-600">
                <Clock className="h-4 w-4 text-slate-400" />
                Riwayat Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-6">
                {report.statusHistory.map((history, idx) => {
                  const isLatest = idx === 0;
                  return (
                    <div key={history.id} className="relative pl-7">
                      {idx !== report.statusHistory.length - 1 && (
                        <div className="absolute bottom-[-24px] left-[9px] top-6 w-px bg-slate-200" />
                      )}
                      <div
                        className={`absolute left-0 top-1.5 h-5 w-5 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-200 ${
                          isLatest ? "bg-blue-600" : "bg-slate-300"
                        }`}
                      />
                      <div className="space-y-1.5">
                        <p
                          className={`text-sm font-semibold ${
                            isLatest ? "text-slate-900" : "text-slate-600"
                          }`}
                        >
                          {REPORT_STATUS_LABELS[history.status as ReportStatus] || history.status}
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(history.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        {history.note && (
                          <p className="mt-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
                            {history.note}
                          </p>
                        )}
                        {history.updatedBy && (
                          <div className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
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
