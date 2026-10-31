"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Wrench, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";

interface TaskActionFormProps {
  reportId: string;
  currentStatus: string;
}

export default function TaskActionForm({ reportId, currentStatus }: TaskActionFormProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setError("Format file harus JPG atau PNG");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran maksimal file adalah 5MB");
      return;
    }

    setError(null);
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (newStatus: string) => {
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      if (newStatus === "SELESAI" && !image) {
        throw new Error("Foto bukti perbaikan wajib diunggah untuk menyelesaikan tugas");
      }

      const formData = new FormData();
      formData.append("status", newStatus);
      if (note) formData.append("note", note);
      if (image) formData.append("image", image);

      const res = await fetch(`/api/tasks/${reportId}/status`, {
        method: "PATCH",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal memperbarui status");
      }

      setSuccess(data.message);
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui status");
    } finally {
      setIsLoading(false);
    }
  };

  // Jika sudah SELESAI, tidak perlu menampilkan form aksi
  if (currentStatus === "SELESAI" || currentStatus === "DITOLAK") {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-slate-400" />
        Aksi Perbaikan
      </h3>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-4" role="alert">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-4">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {success}
        </div>
      )}

      {/* Status DITUGASKAN → Mulai Perbaikan */}
      {currentStatus === "DITUGASKAN" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Anda bisa memulai perbaikan dengan mengklik tombol di bawah ini. Opsional, tambahkan catatan awal.
          </p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Catatan (opsional)</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Misalnya: Sudah survei lokasi, mulai dikerjakan besok pagi..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm resize-none"
            />
          </div>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleSubmit("SEDANG_DIPERBAIKI")}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Wrench className="w-4 h-4" />
            )}
            Mulai Perbaikan
          </button>
        </div>
      )}

      {/* Status SEDANG_DIPERBAIKI → Selesaikan Perbaikan */}
      {currentStatus === "SEDANG_DIPERBAIKI" && (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Unggah foto bukti perbaikan dan tambahkan catatan penyelesaian untuk menyelesaikan tugas ini.
          </p>

          {/* Upload Foto Bukti */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Foto Bukti Perbaikan *
            </label>

            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Preview Bukti" className="h-48 w-auto object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setImagePreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors text-xs font-medium"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-green-400 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-500 group"
              >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-2 shadow-sm group-hover:scale-110 transition-transform">
                  <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-green-500" />
                </div>
                <p className="text-sm font-medium text-slate-700">Klik untuk unggah bukti</p>
                <p className="text-xs text-slate-400 mt-1">JPG/PNG, maks 5MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg, image/png, image/jpg"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          {/* Catatan Penyelesaian */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Catatan Penyelesaian (opsional)</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Misalnya: Jalan sudah ditambal dan dirapikan, perlu waktu 2 hari untuk mengeras sempurna..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm resize-none"
            />
          </div>

          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleSubmit("SELESAI")}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Selesaikan Perbaikan
          </button>
        </div>
      )}
    </div>
  );
}
