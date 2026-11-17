"use client";
import { getErrorMessage } from "@/lib/ui-helpers";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Settings,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface WhatsAppLinkSectionProps {
  connected: boolean;
  maskedPhoneNumber: string | null;
  verifiedAt: string | null;
  registrationStatus: string | null;
  isLoading: boolean;
}

const STATUS_HINT: Record<string, string> = {
  PENDING: "Pengajuan nomor sedang menunggu persetujuan administrator.",
  APPROVED: "Nomor disetujui. Masukkan kode OTP yang dikirim melalui WhatsApp.",
  REJECTED: "Pengajuan nomor ditolak. Silakan ajukan nomor kembali.",
};

export default function WhatsAppLinkSection({
  connected,
  maskedPhoneNumber,
  verifiedAt,
  registrationStatus,
  isLoading,
}: WhatsAppLinkSectionProps) {
  const router = useRouter();
  const [action, setAction] = useState<"disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleDisconnect = async () => {
    if (!window.confirm("Putuskan koneksi WhatsApp dari akun ini?")) return;

    setAction("disconnect");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/whatsapp", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(getErrorMessage(json, "Gagal memutuskan koneksi WhatsApp."));
      }
      setNotice(getErrorMessage(json, "Koneksi WhatsApp berhasil diputuskan."));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memutuskan koneksi WhatsApp.");
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            connected ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
          }`}
        >
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Integrasi WhatsApp</h3>
          <p className="mt-1 text-sm text-slate-500">
            Hubungkan nomor WhatsApp untuk menerima notifikasi laporan secara real-time.
          </p>
          <div className="mt-3">
            {connected ? (
              <Badge variant="success" className="px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Terverifikasi
              </Badge>
            ) : (
              <Badge variant="outline" className="px-2.5 py-1">
                <AlertCircle className="h-3.5 w-3.5" />
                Belum Terhubung
              </Badge>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}

      {connected ? (
        <>
          <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600">
            <p>
              Nomor WhatsApp:{" "}
              <span className="font-mono text-slate-800">
                {maskedPhoneNumber ?? "••••••"}
              </span>
            </p>
            {verifiedAt && (
              <p>Terverifikasi sejak: {new Date(verifiedAt).toLocaleString("id-ID")}</p>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="secondary" className="w-full sm:w-auto">
              <Link href="/settings/whatsapp">
                <Settings className="h-4 w-4" />
                Kelola / Ganti Nomor
              </Link>
            </Button>
            <Button
              type="button"
              onClick={handleDisconnect}
              disabled={isLoading || action !== null}
              variant="danger"
              className="w-full sm:w-auto"
            >
              {action === "disconnect" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Putuskan Koneksi
            </Button>
          </div>
        </>
      ) : (
        <>
          {registrationStatus && STATUS_HINT[registrationStatus] && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {STATUS_HINT[registrationStatus]}
            </div>
          )}
          <Button asChild className="w-full sm:w-auto">
            <Link href="/settings/whatsapp">
              <MessageCircle className="h-4 w-4" />
              {registrationStatus === "APPROVED"
                ? "Verifikasi OTP"
                : registrationStatus === "PENDING"
                  ? "Lihat Status Pengajuan"
                  : "Daftarkan Nomor WhatsApp"}
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}
