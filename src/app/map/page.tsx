import db from "@/lib/db";
import ReportsMapDynamic from "@/components/map/ReportsMapDynamic";

export const metadata = {
  title: "Peta Kerusakan Fasilitas – CirebonLapor",
  description: "Lihat sebaran laporan kerusakan fasilitas umum pada peta.",
};

export default async function MapPage() {
  // Fetch facility types untuk filter
  const facilityTypes = await db.facilityType.findMany({
    orderBy: { name: "asc" },
  });

  return <ReportsMapDynamic facilityTypes={facilityTypes} />;
}
