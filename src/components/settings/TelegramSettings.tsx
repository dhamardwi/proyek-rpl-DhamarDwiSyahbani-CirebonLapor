"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Unlink,
} from "lucide-react";

export interface TelegramSettingsData {
  connected: boolean;
  maskedChatId?: string;
  telegramUsername?: string | null;
  connectedAt?: string;
  configured: boolean;
  webhookConfigured: boolean;
  usePolling?: boolean;
  appUrl: string;
  appUrlIsHttps: boolean;
  appUrlIsLocalhost: boolean;
  botUsername: string | null;
  tokenTtlMinutes: number;
}

interface TelegramSettingsProps {
  initialData: TelegramSettingsData;
  role: string;
}

const EVENTS_BY_ROLE: Record<string, string[]> = {
  MASYARAKAT: [
    "Laporan berhasil dibuat",
    "Laporan diverifikasi atau ditolak beserta catatan admin",
    "Petugas ditugaskan pada laporan Anda",
    "Status penanganan berubah",
    "Laporan selesai ditangani",
  ],
  ADMIN: [
    "Laporan baru masuk",
    "Laporan siap diperiksa atau ditugaskan",
    "Laporan selesai ditangani petugas",
  ],
  PETUGAS: [
    "Penugasan laporan baru",
    "Laporan terverifikasi yang siap ditugaskan",
    "Perubahan prioritas tugas",
  ],
};

function formatDate(value?: string): string | null {
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

export default function TelegramSettings({ initialData, role }: TelegramSettingsProps) {
  const [data, setData] = useState<TelegramSettingsData>(initialData);
  const [action, setAction] = useState<"connect" | "disconnect" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  const events = useMemo(() => EVENTS_BY_ROLE[role] ?? EVENTS_BY_ROLE.MASYARAKAT, [role]);

  const refreshStatus = useCallback(async (silent = false) => {
    if (!silent) setAction("refresh");
    try {
      const res = await fetch("/api/settings/telegram", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal mengambil status Telegram.");
      }
      setData(json.data as TelegramSettingsData);
      return json.data as TelegramSettingsData;
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : "Gagal mengambil status Telegram.");
      }
      return null;
    } finally {
      if (!silent) setAction(null);
    }
  }, []);

  useEffect(() => {
    if (!deepLink) return;

    const poll = setInterval(async () => {
      const latest = await refreshStatus(true);
      if (latest?.connected) {
        setDeepLink(null);
        setExpiresAt(null);
        setNotice("Telegram berhasil terhubung dengan akun Anda.");
      }
    }, 5000);

    return () => clearInterval(poll);
  }, [deepLink, refreshStatus]);

  useEffect(() => {
    if (!expiresAt) return;

    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);

      if (current >= expiresAt) {
        setDeepLink(null);
        setExpiresAt(null);
        setError("Tautan pengaitan sudah kedaluwarsa. Silakan buat tautan baru.");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  const handleConnect = async () => {
    setAction("connect");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/telegram", { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal membuat tautan Telegram.");
      }

      setDeepLink(json.data.deepLink);
      setExpiresAt(new Date(json.data.expiresAt).getTime());
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat tautan Telegram.");
    } finally {
      setAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Putuskan koneksi Telegram dari akun ini?")) return;

    setAction("disconnect");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/telegram", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal memutuskan koneksi Telegram.");
      }

      setData((prev) => ({
        ...prev,
        connected: false,
        maskedChatId: undefined,
        telegramUsername: null,
        connectedAt: undefined,
      }));
      setDeepLink(null);
      setExpiresAt(null);
      setNotice(json.message || "Koneksi Telegram berhasil diputuskan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memutuskan koneksi Telegram.");
    } finally {
      setAction(null);
    }
  };

  const remainingSeconds =
    expiresAt && now > 0 ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;
  const connectedAt = formatDate(data.connectedAt);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                data.connected ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
              }`}
            >
              <Send className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Notifikasi Telegram</h2>
              <p className="text-sm text-slate-500 mt-1">
                Hubungkan akun Telegram pribadi Anda untuk menerima pembaruan laporan.
              </p>
              <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium">
                {data.connected ? (
                  <span className="inline-flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4" />
                    Terhubung
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                    <AlertCircle className="w-4 h-4" />
                    Belum Terhubung
                  </span>
                )}
              </div>
            </div>
          </div>

          {data.connected ? (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={action !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 transition-colors"
            >
              {action === "disconnect" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Putuskan Koneksi
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={action !== null || !data.configured}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
            >
              {action === "connect" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Link className="w-4 h-4" />
              )}
              Hubungkan Telegram
            </button>
          )}
        </div>

        {data.connected && (
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
            <p>
              Chat Telegram:{" "}
              <span className="font-mono text-slate-800">{data.maskedChatId ?? "••••"}</span>
            </p>
            {data.telegramUsername && (
              <p>
                Username Telegram:{" "}
                <span className="font-medium text-slate-800">@{data.telegramUsername}</span>
              </p>
            )}
            {connectedAt && <p>Terhubung sejak: {connectedAt}</p>}
          </div>
        )}

        {!data.configured && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            Integrasi Telegram belum dikonfigurasi oleh administrator.
          </div>
        )}

        {data.configured && !data.usePolling && !data.webhookConfigured && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Webhook belum siap karena <code>TELEGRAM_WEBHOOK_SECRET</code> belum diatur.
              Bot tidak akan membalas pesan penautan sampai secret diisi dan webhook
              didaftarkan ulang.
            </span>
          </div>
        )}

        {!data.usePolling && data.webhookConfigured && !data.appUrlIsHttps && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <code>APP_URL</code> saat ini <span className="font-semibold">{data.appUrl}</span>.
              Telegram hanya dapat memanggil webhook melalui URL publik HTTPS
              {data.appUrlIsLocalhost
                ? " (localhost tidak dapat diakses Telegram)"
                : ""}
              . Gunakan tunnel atau URL deployment, lalu jalankan{" "}
              <code>npm run telegram:webhook</code>.
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {notice && (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            {notice}
          </div>
        )}
      </div>

      {deepLink && !data.connected && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
          <h3 className="font-semibold text-blue-900 flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Selesaikan penghubungan
          </h3>
          <ol className="mt-3 space-y-2 text-sm text-blue-900 list-decimal list-inside">
            <li>Buka tautan Telegram di bawah ini.</li>
            <li>Tekan tombol Start di bot.</li>
            <li>Kembali ke halaman ini; status akan diperbarui otomatis.</li>
          </ol>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Buka Telegram
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              type="button"
              onClick={() => refreshStatus()}
              disabled={action !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 transition-colors"
            >
              {action === "refresh" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Saya Sudah Menghubungkan
            </button>
          </div>

          {remainingSeconds !== null && (
            <p className="mt-3 text-xs text-blue-700">
              Tautan berlaku sekitar {Math.ceil(remainingSeconds / 60)} menit lagi dan hanya
              dapat digunakan satu kali.
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-400" />
          Notifikasi yang Anda terima
        </h3>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {events.map((event) => (
            <li key={event} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
              {event}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-500">
          Notifikasi Telegram mengikuti sistem notifikasi aplikasi. Notifikasi dalam aplikasi
          tetap aktif meskipun Telegram belum dihubungkan.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900">Cara menghubungkan</h3>
        <ol className="mt-4 space-y-2 text-sm text-slate-600 list-decimal list-inside">
          <li>Klik tombol Hubungkan Telegram.</li>
          <li>
            Buka tautan ke bot
            {data.botUsername ? (
              <>
                {" "}
                <span className="font-medium text-slate-800">@{data.botUsername}</span>
              </>
            ) : null}
            .
          </li>
          <li>Tekan Start. Sistem akan memverifikasi token yang berlaku 10 menit.</li>
          <li>Koneksi dapat diputuskan kapan saja dari halaman ini atau perintah /disconnect.</li>
        </ol>
        <p className="mt-4 text-xs text-slate-500">
          Jangan bagikan tautan pengaitan kepada siapa pun. Tautan tersebut hanya dapat dipakai
          sekali dan terikat pada akun Anda.
        </p>
      </div>
    </div>
  );
}
