"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface WhatsappRegistrationView {
  id: string;
  maskedPhoneNumber: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  otpSentAt: string | null;
  otpSendError: string | null;
  otpExpiresAt: string | null;
  otpAttemptsRemaining: number | null;
}

export interface WhatsappSettingsData {
  connected: boolean;
  maskedPhoneNumber?: string;
  verifiedAt?: string;
  configured: boolean;
  registration: WhatsappRegistrationView | null;
}

interface WhatsappSettingsProps {
  initialData: WhatsappSettingsData;
}

const MASYARAKAT_EVENTS: string[] = [
  "Laporan berhasil dibuat",
  "Laporan diverifikasi atau ditolak beserta catatan admin",
  "Petugas ditugaskan pada laporan Anda",
  "Status penanganan berubah",
  "Laporan selesai ditangani",
];

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WhatsAppSettings({ initialData }: WhatsappSettingsProps) {
  const [data, setData] = useState<WhatsappSettingsData>(initialData);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [action, setAction] = useState<
    "submit" | "verify" | "resend" | "disconnect" | "refresh" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const events = useMemo(() => MASYARAKAT_EVENTS, []);
  const registration = data.registration;
  const isApproved = registration?.status === "APPROVED";
  const isPending = registration?.status === "PENDING";
  const isRejected = registration?.status === "REJECTED";

  const refreshStatus = useCallback(async () => {
    setAction("refresh");
    try {
      const res = await fetch("/api/settings/whatsapp", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal mengambil status WhatsApp.");
      }
      setData(json.data as WhatsappSettingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil status WhatsApp.");
    } finally {
      setAction(null);
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAction("submit");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal mengirim pengajuan WhatsApp.");
      }

      setPhoneNumber("");
      setShowForm(false);
      setNotice(json.message || "Pengajuan nomor WhatsApp berhasil dikirim.");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim pengajuan WhatsApp.");
    } finally {
      setAction(null);
    }
  };

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault();
    setAction("verify");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/whatsapp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Kode OTP tidak valid.");
      }

      setOtp("");
      setNotice(json.message || "Nomor WhatsApp berhasil diverifikasi.");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kode OTP tidak valid.");
    } finally {
      setAction(null);
    }
  };

  const handleResend = async () => {
    setAction("resend");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/whatsapp/resend", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal mengirim ulang OTP.");
      }
      setNotice(json.message || "Kode OTP baru telah dikirim.");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengirim ulang OTP.");
    } finally {
      setAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Putuskan koneksi WhatsApp dari akun ini?")) return;

    setAction("disconnect");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/whatsapp", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal memutuskan koneksi WhatsApp.");
      }
      setNotice(json.message || "Koneksi WhatsApp berhasil diputuskan.");
      await refreshStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memutuskan koneksi WhatsApp.");
    } finally {
      setAction(null);
    }
  };

  const verifiedAt = formatDate(data.verifiedAt);
  const reviewedAt = formatDate(registration?.reviewedAt);
  const otpExpiresAt = formatDate(registration?.otpExpiresAt);
  const showPhoneForm = !data.connected && !isPending && !isApproved;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                data.connected ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Notifikasi WhatsApp</h2>
              <p className="mt-1 text-sm text-slate-500">
                Hubungkan nomor WhatsApp pribadi Anda untuk menerima pembaruan laporan.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium">
                {data.connected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-green-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Aktif &amp; Terverifikasi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-600">
                    <AlertCircle className="h-4 w-4" />
                    Belum Terhubung
                  </span>
                )}
              </div>
            </div>
          </div>

          {data.connected && (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={action !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
            >
              {action === "disconnect" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Unlink className="h-4 w-4" />
              )}
              Putuskan Koneksi
            </button>
          )}
        </div>

        {data.connected && (
          <div className="mt-5 space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            <p>
              Nomor WhatsApp:{" "}
              <span className="font-mono font-medium text-slate-800">
                {data.maskedPhoneNumber ?? "••••••"}
              </span>
            </p>
            {verifiedAt && <p>Terverifikasi sejak: {verifiedAt}</p>}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowForm((value) => !value)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                <Smartphone className="h-4 w-4" />
                {showForm ? "Tutup form perubahan nomor" : "Ganti Nomor WhatsApp"}
              </button>
            </div>
          </div>
        )}

        {!data.configured && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Integrasi WhatsApp (Fonnte) belum dikonfigurasi oleh administrator.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {notice}
          </div>
        )}
      </div>

      {isPending && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm sm:p-6">
          <h3 className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertCircle className="h-5 w-5" />
            Menunggu persetujuan administrator
          </h3>
          <p className="mt-2 text-sm text-amber-900">
            Nomor <span className="font-mono font-medium">{registration?.maskedPhoneNumber}</span>{" "}
            sedang diperiksa. Anda akan menerima kode OTP melalui WhatsApp setelah disetujui.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={refreshStatus}
              disabled={action !== null}
            >
              {action === "refresh" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Perbarui Status
            </Button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="text-sm font-semibold text-amber-800 underline-offset-2 hover:underline"
            >
              Ajukan nomor lain
            </button>
          </div>
        </div>
      )}

      {isRejected && (
        <div className="rounded-2xl border border-red-200 bg-red-50/70 p-5 shadow-sm sm:p-6">
          <h3 className="flex items-center gap-2 font-semibold text-red-900">
            <AlertCircle className="h-5 w-5" />
            Pengajuan ditolak
          </h3>
          <p className="mt-2 text-sm text-red-900">
            {registration?.rejectionReason || "Pengajuan nomor WhatsApp belum dapat diterima."}
          </p>
          {reviewedAt && <p className="mt-1 text-xs text-red-700">Ditinjau: {reviewedAt}</p>}
          <p className="mt-3 text-sm text-red-900">
            Anda dapat mengajukan nomor kembali menggunakan form di bawah.
          </p>
        </div>
      )}

      {(showPhoneForm || showForm) && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"
        >
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <Smartphone className="h-5 w-5 text-slate-400" />
            {data.connected ? "Ajukan Nomor WhatsApp Baru" : "Daftarkan Nomor WhatsApp"}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Masukkan nomor aktif yang dapat menerima pesan WhatsApp. Nomor akan melalui
            persetujuan administrator dan verifikasi OTP.
            {data.connected
              ? " Nomor lama tetap aktif sampai nomor baru berhasil diverifikasi."
              : ""}
          </p>

          <div className="mt-4 max-w-md space-y-2">
            <Label htmlFor="whatsapp-phone">Nomor WhatsApp</Label>
            <Input
              id="whatsapp-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="081234567890"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={action !== null || !data.configured}
              required
            />
            <p className="text-xs text-slate-500">
              Format Indonesia (08xx) atau internasional (62xx). Nomor akan dinormalisasi otomatis.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="submit" disabled={action !== null || !data.configured}>
              {action === "submit" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Kirim Pengajuan
            </Button>
            {data.connected && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
                disabled={action !== null}
              >
                Batal
              </Button>
            )}
          </div>
        </form>
      )}

      {isApproved && (
        <form
          onSubmit={handleVerify}
          className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-sm sm:p-6"
        >
          <h3 className="flex items-center gap-2 font-semibold text-blue-900">
            <ShieldCheck className="h-5 w-5" />
            Verifikasi Kode OTP
          </h3>
          <p className="mt-2 text-sm text-blue-900">
            Administrator telah menyetujui nomor{" "}
            <span className="font-mono font-medium">{registration?.maskedPhoneNumber}</span>.
            Masukkan kode 6 digit yang dikirim melalui WhatsApp.
          </p>

          {registration?.otpSendError && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Kode OTP gagal dikirim ({registration.otpSendError}). Gunakan tombol kirim ulang.
            </div>
          )}
          {otpExpiresAt && (
            <p className="mt-2 text-xs text-blue-700">Kode berlaku sampai: {otpExpiresAt}</p>
          )}
          {registration?.otpAttemptsRemaining !== null &&
            registration?.otpAttemptsRemaining !== undefined && (
              <p className="mt-1 text-xs text-blue-700">
                Sisa percobaan: {registration.otpAttemptsRemaining}
              </p>
            )}

          <div className="mt-4 max-w-xs space-y-2">
            <Label htmlFor="whatsapp-otp">Kode OTP</Label>
            <Input
              id="whatsapp-otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              disabled={action !== null}
              required
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Button type="submit" disabled={action !== null || otp.length !== 6}>
              {action === "verify" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Verifikasi
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleResend}
              disabled={action !== null}
            >
              {action === "resend" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Kirim Ulang OTP
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="flex items-center gap-2 font-semibold text-slate-900">
          <ShieldCheck className="h-5 w-5 text-slate-400" />
          Notifikasi yang Anda terima
        </h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {events.map((event) => (
            <li key={event} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
              {event}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Notifikasi WhatsApp mengikuti sistem notifikasi aplikasi. Notifikasi dalam aplikasi
          tetap aktif meskipun WhatsApp belum dihubungkan.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="font-semibold text-slate-900">Cara menghubungkan</h3>
        <ol className="mt-4 list-inside list-decimal space-y-2 text-sm text-slate-600">
          <li>Masukkan nomor WhatsApp lalu kirim pengajuan.</li>
          <li>Tunggu administrator menyetujui nomor Anda.</li>
          <li>Setelah disetujui, kode OTP dikirim melalui WhatsApp.</li>
          <li>Masukkan kode OTP pada form verifikasi. Nomor langsung aktif setelah berhasil.</li>
          <li>
            Untuk mengganti nomor, ajukan nomor baru. Nomor lama tetap aktif sampai nomor baru
            terverifikasi.
          </li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Jangan bagikan kode OTP kepada siapa pun. Kode hanya dapat digunakan satu kali dan
          memiliki masa berlaku terbatas.
        </p>
      </div>
    </div>
  );
}
