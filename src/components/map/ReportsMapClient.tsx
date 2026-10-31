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
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
      
      {/* Filter Sidebar / Topbar */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 shadow-sm z-10 relative">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                Peta Kerusakan Fasilitas
              </h1>
              <p className="text-sm text-slate-500 mt-1">Lihat sebaran laporan kerusakan dari masyarakat.</p>
            </div>
            
            <button 
              onClick={() => setRefreshTick((t) => t + 1)}
              disabled={isLoading}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Segarkan Peta
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-700">
            <Filter className="w-4 h-4" /> Filter Peta:
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <select
              value={filterFacility}
              onChange={(e) => setFilterFacility(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="">Semua Fasilitas</option>
              {facilityTypes.map(ft => (
                <option key={ft.id} value={ft.id}>{ft.name}</option>
              ))}
            </select>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="">Semua Status</option>
              {Object.entries(REPORT_STATUS_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="">Semua Prioritas</option>
              {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            
            <select
              value={filterDamageLevel}
              onChange={(e) => setFilterDamageLevel(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
            >
              <option value="">Semua Tingkat Kerusakan</option>
              {Object.entries(DAMAGE_LEVEL_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 bg-slate-100 relative z-0">
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
              <Popup className="rounded-xl overflow-hidden shadow-xl border-0 p-0 m-0">
                <div className="p-4 w-64">
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700 mb-2">
                    {report.facilityType.name}
                  </span>
                  
                  <h3 className="text-sm font-bold text-slate-900 mb-3 leading-tight line-clamp-2">
                    {report.title}
                  </h3>
                  
                  <div className="space-y-1.5 border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">Status</span>
                      <span className="text-[11px] font-semibold text-slate-700">{REPORT_STATUS_LABELS[report.status as keyof typeof REPORT_STATUS_LABELS] || report.status}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">Prioritas</span>
                      <span className="text-[11px] font-semibold text-slate-700">{PRIORITY_LABELS[report.priority as keyof typeof PRIORITY_LABELS] || report.priority}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-500">Tingkat Kerusakan</span>
                      <span className="text-[11px] font-semibold text-slate-700">{DAMAGE_LEVEL_LABELS[report.damageLevel as keyof typeof DAMAGE_LEVEL_LABELS] || report.damageLevel}</span>
                    </div>
                  </div>

                  
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Laporan Count overlay */}
        <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur px-4 py-2 rounded-xl shadow-lg border border-slate-200 z-[1000]">
          <p className="text-sm font-medium text-slate-700">
            Menampilkan <span className="font-bold text-blue-600">{reports.length}</span> laporan
          </p>
        </div>
      </div>

    </div>
  );
}

