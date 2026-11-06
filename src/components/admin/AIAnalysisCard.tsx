"use client";

import { Sparkles, AlertCircle, Wrench, Brain } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  RINGAN: "bg-blue-100 text-blue-700 border-blue-200",
  SEDANG: "bg-yellow-100 text-yellow-700 border-yellow-200",
  BERAT: "bg-orange-100 text-orange-700 border-orange-200",
  KRITIS: "bg-red-100 text-red-700 border-red-200",
};

const priorityColors: Record<string, string> = {
  RENDAH: "bg-slate-100 text-slate-600 border-slate-200",
  SEDANG: "bg-blue-100 text-blue-600 border-blue-200",
  TINGGI: "bg-orange-100 text-orange-600 border-orange-200",
  KRITIS: "bg-red-100 text-red-700 border-red-200",
};

export default function AIAnalysisCard({ aiAnalysis, showForRole = "ADMIN" }: AIAnalysisCardProps) {
  if (!aiAnalysis) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-3 flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-slate-400" />
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Analisis AI
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-slate-500 py-4">
          <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
            <AlertCircle className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600">Belum Dianalisis</p>
            <p className="text-xs text-slate-400">
              {showForRole === "ADMIN" 
                ? "AI belum menganalisis laporan ini. Anda dapat menilai secara manual." 
                : "Laporan Anda sedang menunggu proses verifikasi."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  let data: AIResult;
  try {
    data = JSON.parse(aiAnalysis);
  } catch {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardHeader className="pb-3 flex items-center gap-2">
          <Brain className="w-3.5 h-3.5" />
          <CardTitle className="text-xs font-semibold text-red-800 uppercase tracking-wider">
            Analisis AI - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">Format data analisis tidak valid.</p>
        </CardContent>
      </Card>
    );
  }

  const confidencePercent = Math.round(data.confidence * 100);
  const confidenceColor = confidencePercent >= 80 ? "text-green-600" : confidencePercent >= 60 ? "text-yellow-600" : "text-red-500";

  return (
    <Card className="border-blue-100 bg-blue-50/50">
      <CardHeader className="pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Rekomendasi AI
          </CardTitle>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className={`text-xs font-bold ${confidenceColor}`}>
            {confidencePercent}% yakin
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Confidence Bar */}
        <div className="space-y-2">
          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${confidencePercent}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 font-medium">
            Tingkat kepercayaan analisis: {confidencePercent}%
          </p>
        </div>

        {/* Grid Data */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Jenis Fasilitas
            </p>
            <p className="text-sm font-bold text-slate-800">{data.facility_type}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Jenis Kerusakan
            </p>
            <p className="text-sm font-bold text-slate-800">{data.damage_type}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Tingkat Kerusakan
            </p>
            <Badge variant="outline" className={damageLevelColors[data.damage_level] || "bg-slate-100 text-slate-600 border-slate-200"}
            >
              {data.damage_level}
            </Badge>
          </div>
          <div className="bg-white rounded-lg p-3 border border-slate-100">
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
              Prioritas
            </p>
            <Badge variant="outline" className={priorityColors[data.priority] || "bg-slate-100 text-slate-600 border-slate-200"}
            >
              {data.priority}
            </Badge>
          </div>
        </div>

        {/* Rekomendasi */}
        <div className="bg-white rounded-lg p-4 border border-slate-100">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2 flex items-center gap-1">
            <Wrench className="w-3 h-3" /> Rekomendasi Penanganan
          </p>
          <p className="text-sm text-slate-700 leading-relaxed">{data.recommendation}</p>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-slate-400 mt-2 italic text-center">
          ⚠️ Hasil analisis AI bersifat rekomendasi. Keputusan akhir tetap di tangan Administrator.
        </p>
      </CardContent>
    </Card>
  );
}
