import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import ReadOnlyMapDynamic from "@/components/map/ReadOnlyMapDynamic";
import { 
  ArrowLeft, MapPin, Calendar, Clock, User, 
  AlertCircle, ShieldCheck, CheckCircle2
} from "lucide-react";
import { 
  REPORT_STATUS_LABELS, 
  PRIORITY_LABELS, 
  type ReportStatus, 
  type Priority 
} from "@/lib/constants";

const statusColors: Record<string, string> = {
  MENUNGGU_VERIFIKASI: "bg-yellow-100 text-yellow-700",
  DIPROSES_AI: "bg-blue-100 text-blue-700",
  DITERIMA: "bg-teal-100 text-teal-700",
  DITOLAK: "bg-red-100 text-red-700",
  DITUGASKAN: "bg-indigo-100 text-indigo-700",
  SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700",
  SELESAI: "bg-green-100 text-green-700",
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return {
    title: `Detail Laporan #${id.slice(-6).toUpperCase()} – CirebonLapor`
  };
}

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=/my-reports/${id}`);
  }

  const report = await db.report.findUnique({
    where: { id },
    include: {
      facilityType: true,
      images: true,
      assignee: {
        select: { name: true, role: true }
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        include: {
          updatedBy: { select: { name: true, role: true } }
        }
      }
    }
  });

  if (!report) {
    notFound();
  }

  // Authorization: Only the creator can see their report (or an admin)
  if (report.userId !== session.user.id && session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  const kerusakanImage = report.images.find(img => img.imageType === "KERUSAKAN");
  const perbaikanImage = report.images.find(img => img.imageType === "BUKTI_PERBAIKAN");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <Link 
        href="/my-reports"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Laporan Saya
      </Link>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusColors[report.status] || "bg-slate-100 text-slate-700"}`}>
              {REPORT_STATUS_LABELS[report.status as ReportStatus] || report.status}
            </span>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
              {report.facilityType.name}
            </span>
            {report.priority !== "RENDAH" && (
              <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Prioritas: {PRIORITY_LABELS[report.priority as Priority] || report.priority}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            {report.title}
          </h1>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {new Date(report.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
              #{report.id.slice(-6).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content (Left) */}
        <div className="lg:col-span-2 space-y-8">
          {/* Photos */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {kerusakanImage ? (
              <div className="relative w-full h-64 sm:h-96 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={kerusakanImage.imagePath} 
                  alt="Foto Kerusakan"
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-full h-48 bg-slate-50 flex items-center justify-center text-slate-400">
                Tidak ada foto
              </div>
            )}
            
            <div className="p-6">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">Deskripsi Laporan</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {report.description || "Tidak ada deskripsi."}
              </p>
            </div>
          </div>

          {/* Bukti Perbaikan (jika ada) */}
          {perbaikanImage && (
            <div className="bg-green-50 rounded-2xl border border-green-100 overflow-hidden shadow-sm">
              <div className="p-4 bg-green-100/50 border-b border-green-100 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <h3 className="font-semibold text-green-900">Bukti Perbaikan Selesai</h3>
              </div>
              <div className="relative w-full h-64 sm:h-96 bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={perbaikanImage.imagePath} 
                  alt="Bukti Perbaikan"
                  className="w-full h-full object-contain rounded-lg"
                />
              </div>
            </div>
          )}

          {/* Location */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              Lokasi Kejadian
            </h3>
            <p className="text-slate-700 mb-4">{report.address}</p>
            
            {report.latitude && report.longitude && (
              <ReadOnlyMapDynamic position={[report.latitude, report.longitude]} />
            )}
          </div>
        </div>

        {/* Sidebar (Right) */}
        <div className="space-y-6">
          {/* Assignee Card */}
          {report.assignee && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-400" />
                Petugas Penanggung Jawab
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-lg">
                  {report.assignee.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-slate-900">{report.assignee.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{report.assignee.role.toLowerCase()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline / Status History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              Riwayat Status
            </h3>

            <div className="space-y-6">
              {report.statusHistory.map((history, idx) => {
                const isLatest = idx === 0;
                return (
                  <div key={history.id} className="relative pl-6">
                    {/* Line connecting dots */}
                    {idx !== report.statusHistory.length - 1 && (
                      <div className="absolute left-[9px] top-6 bottom-[-24px] w-0.5 bg-slate-100" />
                    )}
                    
                    {/* Dot */}
                    <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white ${isLatest ? "bg-blue-500" : "bg-slate-300"}`} />
                    
                    {/* Content */}
                    <div>
                      <p className={`text-sm font-semibold ${isLatest ? "text-slate-900" : "text-slate-600"}`}>
                        {REPORT_STATUS_LABELS[history.status as ReportStatus] || history.status}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(history.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {history.note && (
                        <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                          {history.note}
                        </p>
                      )}
                      
                      {history.updatedBy && (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Diupdate oleh {history.updatedBy.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
