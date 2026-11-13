"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  REPORT_STATUS_LABELS,
  PRIORITY_LABELS,
  DAMAGE_LEVEL_LABELS,
} from "@/lib/constants";
import { Filter, Loader2, RefreshCw } from "lucide-react";

// Perbaikan icon leaflet di Next.js
const customIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface FacilityType {
  id: string;
  name: string;
}

interface ReportData {
  id: string;
  title: string;
  status: string;
  priority: string;
  damageLevel: string;
  latitude: number;
  longitude: number;
  facilityType: { name: string };
}

interface ReportsMapClientProps {
  facilityTypes: FacilityType[];
}

export default function ReportsMapClient({ facilityTypes }: ReportsMapClientProps) {
  const [reports, setReports] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter states
  const [filterFacility, setFilterFacility] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterDamageLevel, setFilterDamageLevel] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadReports() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (filterFacility) params.append("facilityTypeId", filterFacility);
        if (filterStatus) params.append("status", filterStatus);
        if (filterPriority) params.append("priority", filterPriority);
        if (filterDamageLevel) params.append("damageLevel", filterDamageLevel);

        const res = await fetch(`/api/reports/map?${params.toString()}`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setReports(json.data);
        }
      } catch (error) {
        console.error("Gagal mengambil data peta:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    loadReports();
    return () => {
      cancelled = true;
    };
  }, [filterFacility, filterStatus, filterPriority, filterDamageLevel, refreshTick]);

  // Default Cirebon center
  const defaultCenter: [number, number] = [-6.7320, 108.5523];

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
      <div className="relative z-10 shrink-0 border-b border-slate-200/70 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Peta Sebaran Laporan</h1>
              <p className="text-sm text-slate-500">Lihat distribusi laporan kerusakan fasilitas umum berdasarkan lokasi dan status.</p>
            </div>
            <button
              onClick={() => setRefreshTick((t) => t + 1)}
              disabled={isLoading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Muat Ulang
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3 sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="h-4 w-4 text-slate-400" /> Filter Peta
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={filterFacility}
                onChange={(e) => setFilterFacility(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Semua Fasilitas</option>
                {facilityTypes.map(ft => (
                  <option key={ft.id} value={ft.id}>{ft.name}</option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Semua Status</option>
                {Object.entries(REPORT_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>

              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Semua Prioritas</option>
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>

              <select
                value={filterDamageLevel}
                onChange={(e) => setFilterDamageLevel(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Semua Tingkat Kerusakan</option>
                {Object.entries(DAMAGE_LEVEL_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-0 flex-1 bg-slate-100">
        <MapContainer
          center={defaultCenter}
          zoom={13}
          scrollWheelZoom={true}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {reports.map((report) => (
            <Marker
              key={report.id}
              position={[report.latitude, report.longitude]}
              icon={customIcon}
            >
              <Popup className="rounded-xl">
                <div className="w-64 p-1">
                  <span className="mb-2 inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                    {report.facilityType.name}
                  </span>
                  <h3 className="mb-3 line-clamp-2 text-sm font-semibold leading-snug text-slate-900">
                    {report.title}
                  </h3>
                  <div className="space-y-1.5 border-t border-slate-100 pt-3 text-[11px]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Status</span>
                      <span className="font-medium text-slate-700">{REPORT_STATUS_LABELS[report.status as keyof typeof REPORT_STATUS_LABELS] || report.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Prioritas</span>
                      <span className="font-medium text-slate-700">{PRIORITY_LABELS[report.priority as keyof typeof PRIORITY_LABELS] || report.priority}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">Kerusakan</span>
                      <span className="font-medium text-slate-700">{DAMAGE_LEVEL_LABELS[report.damageLevel as keyof typeof DAMAGE_LEVEL_LABELS] || report.damageLevel}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        <div className="absolute bottom-4 right-4 z-[1000] rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 shadow-lg backdrop-blur sm:bottom-6 sm:right-6">
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-blue-600">{reports.length}</span> laporan ditampilkan
          </p>
        </div>
      </div>
    </div>
  );
}

