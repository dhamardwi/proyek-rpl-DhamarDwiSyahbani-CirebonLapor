"use client";

import { Sparkles, AlertCircle, Wrench, Brain } from "lucide-react";

interface AIAnalysisCardProps {
  aiAnalysis: string | null; // JSON string dari database
  showForRole?: "ADMIN" | "MASYARAKAT" | "PETUGAS";
}

interface AIResult {
  facility_type: string;
  damage_type: string;
  damage_level: string;
  priority: string;
  recommendation: string;
  confidence: number;
}

const damageLevelColors: Record<string, string> = {
  RINGAN: "bg-blue-100 text-blue-700",
  SEDANG: "bg-yellow-100 text-yellow-700",
  BERAT: "bg-orange-100 text-orange-700",
  KRITIS: "bg-red-100 text-red-700",
};

const priorityColors: Record<string, string> = {
  RENDAH: "bg-slate-100 text-slate-600",
  SEDANG: "bg-blue-100 text-blue-600",
  TINGGI: "bg-orange-100 text-orange-600",
  KRITIS: "bg-red-100 text-red-700",
};

export default function AIAnalysisCard({ aiAnalysis, showForRole = "ADMIN" }: AIAnalysisCardProps) {
  if (!aiAnalysis) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-slate-400" />
          Analisis AI
        </h3>
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Belum Dianalisis</p>
            <p className="text-xs text-slate-400">
              {showForRole === "ADMIN" 
                ? "AI belum menganalisis laporan ini. Anda dapat menilai secara manual." 
                : "Laporan Anda sedang menunggu proses verifikasi."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  let data: AIResult;
  try {
    data = JSON.parse(aiAnalysis);
  } catch {
    return (
      <div className="bg-red-50 rounded-2xl border border-red-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-red-800 uppercase tracking-wider mb-2 flex items-center gap-2">
          <Brain className="w-4 h-4" />
          Analisis AI - Error
        </h3>
        <p className="text-sm text-red-600">Format data analisis tidak valid.</p>
      </div>
    );
  }

  const confidencePercent = Math.round(data.confidence * 100);
  const confidenceColor = confidencePercent >= 80 ? "text-green-600" : confidencePercent >= 60 ? "text-yellow-600" : "text-red-500";

  return (
    <div className="bg-gradient-to-br from-violet-50 to-blue-50 rounded-2xl border border-violet-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500" />
          Rekomendasi AI
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className={`text-xs font-bold ${confidenceColor}`}>
            {confidencePercent}% yakin
          </span>
        </div>
      </div>

      {/* Confidence Bar */}
      <div className="mb-5">
        <div className="h-1.5 bg-white rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>

      {/* Grid Data */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-white/70 backdrop-blur p-3 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Jenis Fasilitas</p>
          <p className="text-sm font-bold text-slate-800">{data.facility_type}</p>
        </div>
        <div className="bg-white/70 backdrop-blur p-3 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Jenis Kerusakan</p>
          <p className="text-sm font-bold text-slate-800">{data.damage_type}</p>
        </div>
        <div className="bg-white/70 backdrop-blur p-3 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Tingkat Kerusakan</p>
          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${damageLevelColors[data.damage_level] || "bg-slate-100 text-slate-600"}`}>
            {data.damage_level}
          </span>
        </div>
        <div className="bg-white/70 backdrop-blur p-3 rounded-xl">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Prioritas</p>
          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mt-0.5 ${priorityColors[data.priority] || "bg-slate-100 text-slate-600"}`}>
            {data.priority}
          </span>
        </div>
      </div>

      {/* Rekomendasi */}
      <div className="bg-white/70 backdrop-blur p-4 rounded-xl">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1">
          <Wrench className="w-3 h-3" /> Rekomendasi Penanganan
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">{data.recommendation}</p>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-slate-400 mt-4 italic text-center">
        ⚠️ Hasil analisis AI bersifat rekomendasi. Keputusan akhir tetap di tangan Administrator.
      </p>
    </div>
  );
}
