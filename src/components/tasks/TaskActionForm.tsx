"use client";
import { getErrorMessage } from "@/lib/ui-helpers";
/* eslint-disable @next/next/no-img-element -- preview gambar upload dengan dimensi dinamis; <Image> akan mengubah layout & tampilan */

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Wrench, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
        throw new Error(getErrorMessage(data, "Gagal memperbarui status"));
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
    <Card>
      <CardHeader className="pb-3 flex items-center gap-2">
        <Wrench className="w-3.5 h-3.5 text-slate-400" />
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Aksi Perbaikan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Status DITUGASKAN → Mulai Perbaikan */}
        {currentStatus === "DITUGASKAN" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Anda bisa memulai perbaikan dengan mengklik tombol di bawah ini. Opsional, tambahkan catatan awal.
            </p>
            <div className="space-y-2">
              <Label htmlFor="task-note">Catatan (opsional)</Label>
              <Textarea
                id="task-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Misalnya: Sudah survei lokasi, mulai dikerjakan besok pagi..."
              />
            </div>
            <Button
              type="button"
              disabled={isLoading}
              onClick={() => handleSubmit("SEDANG_DIPERBAIKI")}
              className="w-full py-3 shadow-sm shadow-orange-100 hover:shadow-orange-200"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Wrench className="w-4 h-4" />
              )}
              Mulai Perbaikan
            </Button>
          </div>
        )}

        {/* Status SEDANG_DIPERBAIKI → Selesaikan Perbaikan */}
        {currentStatus === "SEDANG_DIPERBAIKI" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Unggah foto bukti perbaikan dan tambahkan catatan penyelesaian untuk menyelesaikan tugas ini.
            </p>

            {/* Upload Foto Bukti */}
            <div className="space-y-2">
              <Label htmlFor="task-image">Foto Bukti Perbaikan <span className="text-red-500">*</span></Label>

              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-slate-200 inline-block">
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
                  className="w-full h-40 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-green-400 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-500 group"
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
                id="task-image"
                type="file"
                accept="image/jpeg, image/png, image/jpg"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {/* Catatan Penyelesaian */}
            <div className="space-y-2">
              <Label htmlFor="task-completion-note">Catatan Penyelesaian (opsional)</Label>
              <Textarea
                id="task-completion-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Misalnya: Jalan sudah ditambal dan dirapikan, perlu waktu 2 hari untuk mengeras sempurna..."
              />
            </div>

            <Button
              type="button"
              disabled={isLoading}
              onClick={() => handleSubmit("SELESAI")}
              className="w-full py-3 shadow-sm shadow-green-100 hover:shadow-green-200"
            >
              {isLoading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Selesaikan Perbaikan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
