"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, UserPlus, AlertTriangle } from "lucide-react";

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

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">
        Aksi Administrator
      </h3>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 border border-green-200">
          {success}
        </div>
      )}

      {/* Action Buttons — termasuk override manual atas keputusan otomatis AI */}
      <div className="flex flex-wrap gap-2 mb-6">
        {["MENUNGGU_VERIFIKASI", "DIPROSES_AI", "DITOLAK"].includes(currentStatus) && (
          <button
            onClick={() => setAction("VERIFY")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${action === "VERIFY" ? "bg-teal-600 text-white" : "bg-teal-50 text-teal-700 hover:bg-teal-100"}`}
          >
            <CheckCircle2 className="w-4 h-4" /> Verifikasi Laporan
          </button>
        )}
        {["MENUNGGU_VERIFIKASI", "DIPROSES_AI", "DITERIMA"].includes(currentStatus) && (
          <button
            onClick={() => setAction("REJECT")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${action === "REJECT" ? "bg-red-600 text-white" : "bg-red-50 text-red-700 hover:bg-red-100"}`}
          >
            <XCircle className="w-4 h-4" /> Tolak Laporan
          </button>
        )}
        
        {currentStatus === "DITERIMA" && (
          <button
            onClick={() => setAction("ASSIGN")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${action === "ASSIGN" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}
          >
            <UserPlus className="w-4 h-4" /> Tugaskan Petugas
          </button>
        )}

        {(currentStatus !== "SELESAI" && currentStatus !== "DITOLAK") && (
          <button
            onClick={() => setAction("PRIORITY")}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${action === "PRIORITY" ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-700 hover:bg-orange-100"}`}
          >
            <AlertTriangle className="w-4 h-4" /> Set Prioritas
          </button>
        )}
      </div>

      {/* Dynamic Forms based on selected action */}
      {action && (
        <form onSubmit={handleSubmit} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          
          {(action === "VERIFY" || action === "REJECT") && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Catatan / Alasan {action === "REJECT" && <span className="text-red-500">*</span>}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required={action === "REJECT"}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                rows={3}
                placeholder={action === "REJECT" ? "Berikan alasan mengapa laporan ditolak..." : "Catatan verifikasi (opsional)..."}
              />
            </div>
          )}

          {action === "ASSIGN" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Pilih Petugas Lapangan *</label>
              <select
                value={selectedPetugas}
                onChange={(e) => setSelectedPetugas(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-100 outline-none bg-white"
              >
                <option value="" disabled>-- Pilih Petugas --</option>
                {petugasList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          {action === "PRIORITY" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tingkat Prioritas *</label>
              <select
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
                required
                className="w-full p-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-100 outline-none bg-white"
              >
                <option value="RENDAH">RENDAH</option>
                <option value="SEDANG">SEDANG</option>
                <option value="TINGGI">TINGGI</option>
                <option value="KRITIS">KRITIS</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAction(null)}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2"
            >
              {isLoading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Simpan Perubahan
            </button>
          </div>
        </form>
      )}
      
      {!action && ["DITUGASKAN", "SEDANG_DIPERBAIKI", "SELESAI"].includes(currentStatus) && (
        <p className="text-sm text-slate-500 italic">
          Tidak ada aksi utama yang tersedia untuk status ini selain mengubah prioritas.
        </p>
      )}
    </div>
  );
}
