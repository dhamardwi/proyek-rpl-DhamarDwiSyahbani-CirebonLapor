"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { User, X, Loader2 } from "lucide-react";

interface ProfileAvatarProps {
  currentImage: string | null;
  onUpdate: (imageUrl: string | null) => void;
  isLoading: boolean;
}

export default function ProfileAvatar({
  currentImage,
  onUpdate,
  isLoading,
}: ProfileAvatarProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: session } = useSession();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      alert("Format file tidak valid. Gunakan JPG, JPEG, atau PNG.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("Ukuran file maksimal 2MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewImage(URL.createObjectURL(file));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !session?.user) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/profile/photo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setSelectedFile(null);
        setPreviewImage(null);
        onUpdate(data.data.profileImage);
      } else {
        alert(data.message || "Gagal mengunggah foto");
      }
    } catch {
      alert("Terjadi kesalahan server");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm("Apakah Anda yakin ingin menghapus foto profil?")
    )
      return;

    try {
      const res = await fetch("/api/profile/photo", {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        onUpdate(null);
      } else {
        alert(data.message || "Gagal menghapus foto");
      }
    } catch {
      alert("Terjadi kesalahan server");
    }
  };

  const imageUrl = previewImage || currentImage;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative group">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Foto profil"
              className="w-24 h-24 rounded-full object-cover border-2 border-slate-200"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center">
              <User className="w-12 h-12 text-slate-400" />
            </div>
          )}
          {selectedFile && (
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setPreviewImage(null);
              }}
              className="absolute top-0 right-0 bg-red-500 text-white p-1.5 rounded-full hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <form onSubmit={handleUpload} className="flex-1">
          <label
            className="block cursor-pointer w-full px-4 py-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-blue-700 text-sm font-medium text-center transition-colors"
          >
            Pilih Foto
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {isUploading && (
            <p className="mt-2 text-xs text-slate-500 text-center">
              Mengunggah...
            </p>
          )}
        </form>

        {currentImage && (
          <button
            onClick={handleDelete}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Hapus foto
          </button>
        )}
      </div>

      {isLoading || isUploading ? (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Memproses...</span>
        </div>
      ) : null}
    </div>
  );
}