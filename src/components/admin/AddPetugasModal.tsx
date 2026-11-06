"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";

export default function AddPetugasModal() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, role: "PETUGAS" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal menambah petugas");

      setIsOpen(false);
      setFormData({ name: "", email: "", password: "" });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal menambah petugas");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        <Plus className="w-3.5 h-3.5" /> Tambah Petugas
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-900">
                Tambah Petugas Baru
              </CardTitle>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <CardContent className="p-6 space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modal-petugas-name">Nama Lengkap</Label>
                  <Input
                    id="modal-petugas-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Budi Santoso"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="modal-petugas-email">Email</Label>
                  <Input
                    id="modal-petugas-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    placeholder="budi@cirebonlapor.id"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="modal-petugas-password">Password</Label>
                  <Input
                    id="modal-petugas-password"
                    type="password"
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    placeholder="Minimal 6 karakter"
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <Button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    variant="outline"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-auto"
                  >
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Simpan Petugas
                  </Button>
                </div>
              </form>
            </CardContent>
          </div>
        </div>
      )}
    </>
  );
}
