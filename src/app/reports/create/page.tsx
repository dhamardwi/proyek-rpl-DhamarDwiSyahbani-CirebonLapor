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

  // Fetch facility types
  const facilityTypes = await db.facilityType.findMany({
    orderBy: { name: 'asc' }
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Buat Laporan Baru</h1>
        <p className="text-sm text-slate-500 mt-1">
          Laporkan fasilitas umum yang rusak agar dapat segera ditangani oleh petugas.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
        <CreateReportForm facilityTypes={facilityTypes} />
      </div>
    </div>
  );
}
