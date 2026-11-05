"use client";

import { useState } from "react";
import {
  Send,
  Unlink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

interface TelegramLinkSectionProps {
  connected: boolean;
  chatId: string | null;
  username: string | null;
  connectedAt: string | null;
  isLoading: boolean;
}

export default function TelegramLinkSection({
  connected,
  chatId,
  username,
  connectedAt,
  isLoading,
}: TelegramLinkSectionProps) {
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [action, setAction] = useState<"connect" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleConnect = async () => {
    setAction("connect");
    setError(null);
    setNotice(null);

    try {
      const res = await fetch("/api/settings/telegram", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal membuat tautan Telegram.");
      }

      setDeepLink(json.data.deepLink);
      setExpiresAt(new Date(json.data.expiresAt).getTime());
      setNow(Date.now());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal membuat tautan Telegram."
      );
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
      const res = await fetch("/api/settings/telegram", {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal memutuskan koneksi Telegram.");
      }

      setNotice(json.message || "Koneksi Telegram berhasil diputuskan.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Gagal memutuskan koneksi Telegram."
      );
    } finally {
      setAction(null);
    }
  };

  const remainingSeconds =
    expiresAt && now > 0 ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
            connected
              ? "bg-green-100 text-green-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {connected ? (
            <Send className="w-6 h-6" />
          ) : (
            <Link className="w-6 h-6" />
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Integrasi Telegram
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Hubungkan akun Telegram untuk menerima notifikasi laporan.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium">
            {connected ? (
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

      {connected ? (
        <>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isLoading || action !== null}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60 transition-colors"
          >
            {action === "disconnect" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlink className="w-4 h-4" />
            )}
            Putuskan Koneksi
          </button>

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
            <p>
              Chat Telegram:{" "}
              <span className="font-mono text-slate-800">
                {chatId ? `••••${chatId.slice(-4)}` : "••••"}
              </span>
            </p>
            {username && (
              <p>
                Username Telegram:{" "}
                <span className="font-medium text-slate-800">@{username}</span>
              </p>
            )}
            {connectedAt && (
              <p>
                Terhubung sejak: {new Date(connectedAt).toLocaleString("id-ID")}
              </p>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={handleConnect}
          disabled={isLoading || action !== null}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {action === "connect" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Link className="w-4 h-4" />
          )}
          Hubungkan Telegram
        </button>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
          {notice}
        </div>
      )}

      {deepLink && !connected && (
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
              onClick={() => {
                // Poll status by refreshing page or calling an endpoint
                window.location.reload();
              }}
              disabled={action !== null}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 transition-colors"
            >
                <RefreshCw className="w-4 h-4" />
                Saya Sudah Menghubungkan
            </button>
          </div>

          {remainingSeconds !== null && (
            <p className="mt-3 text-xs text-blue-700">
              Tautan berlaku sekitar {Math.ceil(remainingSeconds / 60)} menit
              lagi dan hanya dapat digunakan satu kali.
            </p>
          )}
        </div>
      )}
    </div>
  );
}