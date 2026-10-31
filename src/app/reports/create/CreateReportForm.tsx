"use client";

import { useState, FormEvent, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, MapPin, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamic import map untuk menghindari error window is not defined (SSR issue)
const LocationPicker = dynamic(() => import("@/components/map/LocationPicker"), { ssr: false, loading: () => <div className="h-[300px] w-full bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-400">Memuat Peta...</div> });

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
        <p className="text-slate-500 mb-8">Terima kasih atas partisipasi Anda. Laporan akan segera diverifikasi oleh admin.</p>
        <p className="text-sm text-slate-400">Mengalihkan ke dashboard...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3" role="alert">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Row 1: Judul dan Kategori */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Judul Laporan *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Jalan berlubang di Jl. Merdeka"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Jenis Fasilitas *</label>
          <select
            required
            value={facilityTypeId}
            onChange={(e) => setFacilityTypeId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm bg-white"
          >
            <option value="" disabled>Pilih jenis fasilitas</option>
            {facilityTypes.map((ft) => (
              <option key={ft.id} value={ft.id}>{ft.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Deskripsi */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Deskripsi Kerusakan *</label>
        <textarea
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ceritakan detail kerusakan yang terjadi..."
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm resize-none"
        ></textarea>
      </div>

      {/* Row 3: Foto */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Foto Bukti Kerusakan * (Max: 5MB)</label>
        
        {imagePreview ? (
          <div className="relative rounded-xl overflow-hidden border border-slate-200 inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="Preview" className="h-48 w-auto object-cover" />
            <button
              type="button"
              onClick={() => { setImage(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
              className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-600 text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors text-xs font-medium"
            >
              Hapus Foto
            </button>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-48 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 hover:border-blue-400 transition-all flex flex-col items-center justify-center cursor-pointer text-slate-500 group"
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
          type="file" 
          accept="image/jpeg, image/png, image/jpg"
          className="hidden" 
          onChange={handleImageChange}
        />
      </div>

      {/* Row 4: Peta & Lokasi */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-medium text-slate-700">Titik Lokasi *</label>
          <button 
            type="button" 
            onClick={handleGetLocation}
            className="text-xs flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-medium bg-blue-50 px-3 py-1.5 rounded-lg"
          >
            <MapPin className="w-3.5 h-3.5" />
            Gunakan Lokasi Saya
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Geser atau klik peta untuk menentukan titik kerusakan.</p>
        
        <LocationPicker position={position} onChange={setPosition} />

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Alamat Lengkap / Patokan Lokasi *</label>
          <input
            type="text"
            required
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Contoh: Depan warung sate, jalan agak masuk ke dalam"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-2.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-100"
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
        </button>
      </div>
    </form>
  );
}
