"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, UserPlus, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AdminReportActionFormProps {
  reportId: string;
  currentStatus: string;
  currentPriority: string;
  currentAssigneeId: string | null;
  petugasList: { id: string; name: string }[];
}

export default function AdminReportActionForm({
  reportId,
  currentStatus,
  currentPriority,
  currentAssigneeId,
  petugasList
}: AdminReportActionFormProps) {
  const router = useRouter();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // States for actions
  const [action, setAction] = useState<"VERIFY" | "REJECT" | "ASSIGN" | "PRIORITY" | null>(null);
  const [note, setNote] = useState("");
  const [selectedPetugas, setSelectedPetugas] = useState(currentAssigneeId || "");
  const [selectedPriority, setSelectedPriority] = useState(currentPriority);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (action === "REJECT" && !note) {
        throw new Error("Alasan penolakan wajib diisi");
      }
      if (action === "ASSIGN" && !selectedPetugas) {
        throw new Error("Pilih petugas yang akan ditugaskan");
      }

      const payload: { action: string; note?: string; assigneeId?: string; priority?: string } = { action };
      
      if (action === "REJECT" || action === "VERIFY") {
        payload.note = note;
      } else if (action === "ASSIGN") {
        payload.assigneeId = selectedPetugas;
      } else if (action === "PRIORITY") {
        payload.priority = selectedPriority;
      }

      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal memproses aksi");

      setSuccess(data.message);
      setAction(null);
      setNote("");
      
      setTimeout(() => {
        router.refresh();
        setSuccess(null);
      }, 1500);
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memproses aksi");
    } finally {
      setIsLoading(false);
    }
  };

  const actionButtons: { label: string; icon: React.ElementType; condition: boolean; variant: "default" | "danger"; action: "VERIFY" | "REJECT" | "ASSIGN" | "PRIORITY" }[] = [
    {
      label: "Verifikasi Laporan",
      icon: CheckCircle2,
      condition: ["MENUNGGU_VERIFIKASI", "DIPROSES_AI", "DITOLAK"].includes(currentStatus),
      variant: "default",
      action: "VERIFY",
    },
    {
      label: "Tolak Laporan",
      icon: XCircle,
      condition: ["MENUNGGU_VERIFIKASI", "DIPROSES_AI", "DITERIMA"].includes(currentStatus),
      variant: "danger",
      action: "REJECT",
    },
    {
      label: "Tugaskan Petugas",
      icon: UserPlus,
      condition: currentStatus === "DITERIMA",
      variant: "default",
      action: "ASSIGN",
    },
    {
      label: "Set Prioritas",
      icon: AlertTriangle,
      condition: currentStatus !== "SELESAI" && currentStatus !== "DITOLAK",
      variant: "default",
      action: "PRIORITY",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Aksi Administrator
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert variant="success">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {actionButtons.map((btn) => {
            if (!btn.condition) return null;
            const isActive = action === btn.action;
            return (
              <Button
                key={btn.label}
                onClick={() => setAction(btn.action)}
                variant={isActive ? btn.variant : "outline"}
                className={isActive
                  ? btn.variant === "danger"
                    ? "bg-red-600 text-white"
                    : btn.variant === "default"
                      ? "bg-blue-600 text-white"
                      : ""
                  : "text-slate-600 hover:bg-slate-50"
                }
                size="sm"
              >
                <btn.icon className="w-3.5 h-3.5" />
                {btn.label}
              </Button>
            );
          })}
        </div>

        {/* Dynamic Forms based on selected action */}
        {action && (
          <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
            
            {(action === "VERIFY" || action === "REJECT") && (
              <div className="space-y-2">
                <Label htmlFor="action-note">
                  Catatan / Alasan {action === "REJECT" && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  id="action-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  required={action === "REJECT"}
                  rows={3}
                  placeholder={action === "REJECT" ? "Berikan alasan mengapa laporan ditolak..." : "Catatan verifikasi (opsional)..."}
                />
              </div>
            )}

            {action === "ASSIGN" && (
              <div className="space-y-2">
                <Label htmlFor="assign-petugas">Pilih Petugas Lapangan <span className="text-red-500">*</span></Label>
                <Select
                  id="assign-petugas"
                  value={selectedPetugas}
                  onChange={(e) => setSelectedPetugas(e.target.value)}
                  required
                >
                  <option value="" disabled>-- Pilih Petugas --</option>
                  {petugasList.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
            )}

            {action === "PRIORITY" && (
              <div className="space-y-2">
                <Label htmlFor="assign-priority">Tingkat Prioritas <span className="text-red-500">*</span></Label>
                <Select
                  id="assign-priority"
                  value={selectedPriority}
                  onChange={(e) => setSelectedPriority(e.target.value)}
                  required
                >
                  <option value="RENDAH">Rendah</option>
                  <option value="SEDANG">Sedang</option>
                  <option value="TINGGI">Tinggi</option>
                  <option value="KRITIS">Kritis</option>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setAction(null)}
                variant="outline"
                size="sm"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="w-auto"
              >
                {isLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Simpan Perubahan
              </Button>
            </div>
          </form>
        )}
        
        {!action && ["DITUGASKAN", "SEDANG_DIPERBAIKI", "SELESAI"].includes(currentStatus) && (
          <p className="text-xs text-slate-500 italic">
            Tidak ada aksi utama yang tersedia untuk status ini selain mengubah prioritas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
