import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Link from "next/link";
import { 
  FileText, Calendar, MapPin, AlertCircle, ChevronRight 
} from "lucide-react";
import { 
  REPORT_STATUS_LABELS, 
  PRIORITY_LABELS, 
  type ReportStatus, 
  type Priority 
} from "@/lib/constants";

export const metadata = {
  title: "Daftar Tugas – CirebonLapor",
  description: "Daftar tugas perbaikan fasilitas umum",
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
    orderBy: [
      { status: "asc" }, // DITUGASKAN will come before SEDANG_DIPERBAIKI before SELESAI due to alphabetical order of string if not careful, actually better order by createdAt
      { createdAt: "desc" }
    ],
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Daftar Tugas Perbaikan</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-2">
          Kelola tugas perbaikan fasilitas umum yang ditugaskan kepada Anda.
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4">
            <FileText className="w-8 h-8 text-slate-400" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-2">Belum ada tugas</h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Anda belum memiliki tugas perbaikan saat ini. Tugas akan muncul di sini setelah Admin menugaskannya kepada Anda.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition-all shadow-sm"
          >
            Kembali ke Dashboard
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6">
          {reports.map((report) => (
            <Link 
              key={report.id} 
              href={`/tasks/${report.id}`}
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all overflow-hidden group"
            >
              <div className="flex flex-col sm:flex-row">
                {/* Thumbnail */}
                <div className="relative w-full sm:w-48 h-48 sm:h-auto shrink-0 bg-slate-100">
                  {report.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
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
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                        #{report.id.slice(-6).toUpperCase()}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        {report.facilityType.name}
                      </span>
                      <span className={`text-xs flex items-center gap-1 ml-auto ${priorityColors[report.priority]}`}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        Prioritas: {PRIORITY_LABELS[report.priority as Priority] || report.priority}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {report.title}
                    </h3>

                    <div className="flex flex-col gap-1.5 mb-4">
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Calendar className="w-4 h-4 shrink-0" />
                        <span>Ditugaskan sejak: {new Date(report.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="line-clamp-1">{report.address}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColors[report.status] || "bg-slate-100 text-slate-600"}`}>
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
      )}
    </div>
  );
}
