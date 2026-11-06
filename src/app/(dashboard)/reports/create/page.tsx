import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CreateReportForm from "./CreateReportForm";

export const metadata = {
  title: "Buat Laporan Baru – CirebonLapor",
  description: "Laporkan kerusakan fasilitas umum di desa Anda",
};

export default async function CreateReportPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login?callbackUrl=/reports/create");
  }

  const facilityTypes = await db.facilityType.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-8">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Buat Laporan Baru</h1>
            <p className="text-sm text-slate-500 mt-1">
              Laporkan fasilitas umum yang rusak agar dapat segera ditangani oleh petugas.
            </p>
          </div>
          <a
            href="/my-reports"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
          >
            <span className="w-3.5 h-3.5 text-slate-400">←</span> Lihat Laporan Saya
          </a>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <CreateReportForm facilityTypes={facilityTypes} />
      </div>
    </div>
  );
}
