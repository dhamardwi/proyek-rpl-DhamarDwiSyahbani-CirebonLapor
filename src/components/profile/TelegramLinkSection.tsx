"use client";

import { useState } from "react";
import {
  Send,
  Unlink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
  MessageCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

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
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            connected ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
          }`}
        >
          {connected ? <Send className="h-5 w-5" /> : <LinkIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Integrasi Telegram</h3>
          <p className="mt-1 text-sm text-slate-500">
            Hubungkan akun Telegram untuk menerima notifikasi laporan secara real-time.
          </p>
          <div className="mt-3">
            {connected ? (
              <Badge variant="success" className="px-2.5 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Terhubung
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
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert variant="success">
            <CheckCircle2 className="w-4 h-4" />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

      {connected ? (
        <>
          <Button
            type="button"
            onClick={handleDisconnect}
            disabled={isLoading || action !== null}
            variant="danger"
            className="w-full sm:w-auto"
          >
            {action === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
            Putuskan Koneksi
          </Button>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600 space-y-1.5">
            <p>
              Chat Telegram:{" "}
              <span className="font-mono text-slate-800">{chatId ? `••••${chatId.slice(-4)}` : "••••"}</span>
            </p>
            {username && (
              <p>
                Username Telegram: <span className="font-medium text-slate-800">@{username}</span>
              </p>
            )}
            {connectedAt && <p>Terhubung sejak: {new Date(connectedAt).toLocaleString("id-ID")}</p>}
          </div>
        </>
      ) : (
        <Button type="button" onClick={handleConnect} disabled={isLoading || action !== null} className="w-full sm:w-auto">
          {action === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
          Hubungkan Telegram
        </Button>
      )}

      {deepLink && !connected && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-semibold text-blue-900">
            <MessageCircle className="h-4 w-4" />
            Selesaikan penghubungan
          </h3>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-blue-900">
            <li>Buka tautan Telegram di bawah ini.</li>
            <li>Tekan tombol Start di bot.</li>
            <li>Kembali ke halaman ini; status akan diperbarui otomatis.</li>
          </ol>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Buka Telegram
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              disabled={action !== null}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Saya Sudah Menghubungkan
            </button>
          </div>

          {remainingSeconds !== null && (
            <p className="mt-3 text-xs text-blue-700">
              Tautan berlaku sekitar {Math.ceil(remainingSeconds / 60)} menit lagi dan hanya dapat digunakan satu kali.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
