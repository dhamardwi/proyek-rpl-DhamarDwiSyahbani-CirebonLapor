"use client";

import { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, MapPin, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Dynamic import map untuk menghindari error window is not defined (SSR issue)
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">
      Memuat Peta...
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
      <div className="py-12 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Laporan Terkirim!</h2>
        <p className="text-slate-500 mb-8">
          Terima kasih atas partisipasi Anda. Laporan akan segera diverifikasi oleh admin.
        </p>
        <p className="text-sm text-slate-400">Mengalihkan ke dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Row 1: Judul dan Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="title">Judul Laporan <span className="text-red-500">*</span></Label>
          <Input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Jalan berlubang di Jl. Merdeka"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="facilityTypeId">Jenis Fasilitas <span className="text-red-500">*</span></Label>
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

      {/* Row 2: Deskripsi */}
      <div className="space-y-2">
        <Label htmlFor="description">Deskripsi Kerusakan <span className="text-red-500">*</span></Label>
        <Textarea
          id="description"
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ceritakan detail kerusakan yang terjadi..."
        />
      </div>

      {/* Row 3: Foto */}
      <div className="space-y-2">
        <Label htmlFor="image">Foto Bukti Kerusakan <span className="text-red-500">*</span> (Max: 5MB)</Label>

        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 inline-block">
            <img src={imagePreview} alt="Preview" className="h-48 w-auto object-cover" />
            <button
              type="button"
              onClick={() => {
                setImage(null);
                setImagePreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors text-xs font-medium"
            >
              Hapus Foto
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-48 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-slate-100 hover:border-blue-400 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-500 group"
          >
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform">
              <ImageIcon className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">Klik untuk unggah foto</p>
            <p className="text-xs text-slate-400 mt-1">Hanya JPG/PNG, maksimal 5MB</p>
          </div>
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

      {/* Row 4: Peta & Lokasi */}
      <div className="space-y-3">
        <div className="flex items-center justify-between mb-1">
          <Label htmlFor="location">Titik Lokasi <span className="text-red-500">*</span></Label>
          <button
            type="button"
            onClick={handleGetLocation}
            className="text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-3 py-1.5 rounded-lg"
          >
            <MapPin className="w-3.5 h-3.5" />
            Gunakan Lokasi Saya
          </button>
        </div>
        <p className="text-[10px] text-slate-500">Geser atau klik peta untuk menentukan titik kerusakan.</p>

        <LocationPicker position={position} onChange={setPosition} />

        <div className="mt-3 space-y-2">
          <Label htmlFor="address">Alamat Lengkap / Patokan Lokasi <span className="text-red-500">*</span></Label>
          <Input
            id="address"
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Contoh: Depan warung sate, jalan agak masuk ke dalam"
          />
        </div>
      </div>

      <CardFooter className="pt-6 border-t border-slate-100">
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 shadow-sm shadow-blue-100 hover:shadow-blue-200"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Mengirim & Menganalisis dengan AI...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Kirim Laporan
            </>
          )}
        </Button>
      </CardFooter>
    </form>
  );
}
