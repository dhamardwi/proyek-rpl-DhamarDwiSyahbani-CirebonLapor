import Link from "next/link";
import { AlertTriangle, Copy, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface DuplicateAnalysisItem {
  id: string;
  candidateReportId: string;
  candidateTitle: string;
  similarityScore: number;
  distanceMeters: number | null;
  isPotential: boolean;
  adminStatus: string;
  aiAnalysis: string | null;
}

interface DuplicateReportCardProps {
  analyses: DuplicateAnalysisItem[];
}

interface ParsedAnalysis {
  method?: string;
  reason?: string | null;
}

function parseAnalysis(value: string | null): ParsedAnalysis {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as ParsedAnalysis;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function formatDistance(distance: number | null): string {
  if (distance === null || !Number.isFinite(distance)) return "";
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toFixed(1)} km`;
}

export default function DuplicateReportCard({ analyses }: DuplicateReportCardProps) {
  if (!analyses || analyses.length === 0) return null;

  const potential = analyses.filter((analysis) => analysis.isPotential);
  if (potential.length === 0) return null;
  const shown = potential;
  const top = shown[0];
  const parsed = parseAnalysis(top.aiAnalysis);
  const percent = Math.round((top.similarityScore ?? 0) * 100);
  const distance = formatDistance(top.distanceMeters);

  return (
    <Card className="rounded-2xl border-amber-200 bg-amber-50/40 shadow-sm">
      <CardHeader className="flex items-center gap-2 border-b border-amber-100/70 pb-4">
        <Copy className="w-3.5 h-3.5 text-amber-600" />
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Kemungkinan Laporan Duplikat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-slate-700">
            Laporan ini mirip dengan laporan lain (skor {percent}%{distance ? `, ${distance}` : ""}).
          </span>
          <Badge variant="outline" className="text-xs">
            {parsed.method === "GEMINI" ? "Gemini" : "Pemeriksaan lokal"}
          </Badge>
          {top.adminStatus === "CONFIRMED" && (
            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
              Dikonfirmasi duplikat
            </Badge>
          )}
        </div>

        {parsed.reason && (
          <p className="text-sm text-slate-600 bg-white rounded-lg border border-amber-100 p-3">
            {parsed.reason}
          </p>
        )}

        <div className="space-y-2">
          {shown.map((analysis) => {
            return (
              <Link
                key={analysis.id}
                href={`/admin/reports/${analysis.candidateReportId}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm text-amber-700 hover:text-amber-800 hover:border-amber-200"
              >
                <span className="truncate">{analysis.candidateTitle}</span>
                <span className="inline-flex items-center gap-1.5 shrink-0 text-xs">
                  {Math.round(analysis.similarityScore * 100)}%
                  <ExternalLink className="w-3.5 h-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
