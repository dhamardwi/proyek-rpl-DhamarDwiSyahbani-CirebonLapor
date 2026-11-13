"use client";

import { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Dynamic import map untuk menghindari error window is not defined (SSR issue)
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-full items-center justify-center rounded-xl border border-slate-200/80 bg-slate-100 text-sm text-slate-400 animate-pulse">
      Memuat peta...
    </div>
  ),
});

interface FacilityType {
  id: string;
  name: string;
}

export default function CreateReportForm({ facilityTypes }: { facilityTypes: FacilityType[] }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [facilityTypeId, setFacilityTypeId] = useState("");
  const [address, setAddress] = useState("");
  const [position, setPosition] = useState<[number, number] | null>(null);

  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError("Browser Anda tidak mendukung geolokasi");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        setError(null);
      },
      () => {
        setError("Gagal mendapatkan lokasi. Izinkan akses lokasi di browser Anda.");
      }
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (!image) {
        throw new Error("Mohon unggah foto kerusakan");
      }

      if (!position) {
        throw new Error("Mohon tentukan lokasi di peta");
      }

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("facilityTypeId", facilityTypeId);
      formData.append("address", address);
      formData.append("latitude", position[0].toString());
      formData.append("longitude", position[1].toString());
      formData.append("image", image);

      const res = await fetch("/api/reports", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Gagal mengirim laporan");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan yang tidak terduga.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-green-200/70">
        <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 ring-8 ring-green-50">
            <CheckCircle2 className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Laporan Terkirim!</h2>
          <p className="mt-2 max-w-md text-sm text-slate-500 sm:text-base">
            Terima kasih atas partisipasi Anda. Laporan akan segera diverifikasi oleh admin.
          </p>
          <p className="mt-6 text-xs font-medium uppercase tracking-wider text-slate-400">
            Mengalihkan ke dashboard...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Informasi Laporan */}
      <Card>
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Informasi Laporan</CardTitle>
              <CardDescription>Isi detail utama mengenai kerusakan yang ditemukan.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="title">
                Judul Laporan <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Jalan berlubang di Jl. Merdeka"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="facilityTypeId">
                Jenis Fasilitas <span className="text-red-500">*</span>
              </Label>
              <Select
                id="facilityTypeId"
                required
                value={facilityTypeId}
                onChange={(e) => setFacilityTypeId(e.target.value)}
              >
                <option value="" disabled>
                  Pilih jenis fasilitas
                </option>
                {facilityTypes.map((ft) => (
                  <option key={ft.id} value={ft.id}>
                    {ft.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              Deskripsi Kerusakan <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan kondisi kerusakan, tingkat keparahan, dan informasi penting lainnya..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Foto */}
      <Card>
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
              <ImageIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg">Foto Bukti Kerusakan</CardTitle>
              <CardDescription>Unggah foto yang jelas untuk membantu proses verifikasi.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            <Label htmlFor="image">
              Foto <span className="text-red-500">*</span>{" "}
              <span className="font-normal text-slate-400">(JPG/PNG, maks. 5MB)</span>
            </Label>

            {imagePreview ? (
              <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50">
                <img src={imagePreview} alt="Preview" className="h-56 w-full object-cover sm:h-72" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end bg-gradient-to-t from-slate-900/60 to-transparent p-3">
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setImage(null);
                      setImagePreview(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Foto
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-56 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 text-slate-500 transition-all hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 sm:h-64"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/70">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-slate-700">Klik untuk unggah foto</p>
                <p className="mt-1 text-xs text-slate-500">atau seret dan lepas file di sini</p>
              </button>
            )}
            <input
              ref={fileInputRef}
              id="image"
              type="file"
              accept="image/jpeg, image/png, image/jpg"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lokasi */}
      <Card>
        <CardHeader className="border-b border-slate-100">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg">Lokasi Kejadian</CardTitle>
                <CardDescription>Tentukan titik lokasi kerusakan pada peta dan alamatnya.</CardDescription>
              </div>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={handleGetLocation}>
              <MapPin className="h-4 w-4" />
              Gunakan Lokasi Saya
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label>
              Titik Lokasi <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-slate-500">Klik atau geser penanda pada peta untuk menentukan titik kerusakan.</p>
            <div className="overflow-hidden rounded-xl border border-slate-200/80">
              <LocationPicker position={position} onChange={setPosition} />
            </div>
            {position && (
              <p className="text-xs text-slate-500">
                Koordinat: <span className="font-mono text-slate-700">{position[0].toFixed(6)}, {position[1].toFixed(6)}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">
              Alamat Lengkap / Patokan Lokasi <span className="text-red-500">*</span>
            </Label>
            <Input
              id="address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Contoh: Depan warung sate, Jl. Merdeka No. 10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200/80 pt-2 sm:flex-row sm:items-center sm:justify-end">
        <p className="text-xs text-slate-500 sm:mr-auto">
          Pastikan data yang Anda kirim sudah benar sebelum mengirim laporan.
        </p>
        <Button type="submit" disabled={isLoading} size="lg" className="w-full sm:w-auto">
          {isLoading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Mengirim laporan...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Kirim Laporan
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
