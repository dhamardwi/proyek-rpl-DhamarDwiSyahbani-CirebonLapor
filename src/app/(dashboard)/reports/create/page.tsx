import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto w-full max-w-4xl space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Buat Laporan Baru
          </h1>
          <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
            Sampaikan informasi kerusakan fasilitas umum secara lengkap agar proses verifikasi dan
            penanganan dapat berjalan lebih cepat.
          </p>
        </div>
        <Button variant="secondary" size="sm" asChild className="w-full sm:w-auto">
          <Link href="/my-reports">
            <ArrowLeft className="h-4 w-4" />
            Laporan Saya
          </Link>
        </Button>
      </div>

      <CreateReportForm facilityTypes={facilityTypes} />
    </div>
  );
}
