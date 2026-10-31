"use client";

import dynamic from "next/dynamic";

const ReportsMapClient = dynamic(() => import("./ReportsMapClient"), {
  ssr: false,
  loading: () => (
    <div className="flex-1 h-[calc(100vh-64px)] w-full bg-slate-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Memuat Peta Laporan...</p>
      </div>
    </div>
  ),
});

interface FacilityType {
  id: string;
  name: string;
}

export default function ReportsMapDynamic({ facilityTypes }: { facilityTypes: FacilityType[] }) {
  return <ReportsMapClient facilityTypes={facilityTypes} />;
}
