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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="pb-3 flex items-start gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            connected
              ? "bg-green-100 text-green-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {connected ? (
            <Send className="w-5 h-5" />
          ) : (
            <LinkIcon className="w-5 h-5" />
          )}
        </div>
        <div>
          <CardTitle className="text-sm font-semibold text-slate-900">
            Integrasi Telegram
          </CardTitle>
          <p className="text-[10px] text-slate-500 mt-1">
            Hubungkan akun Telegram untuk menerima notifikasi laporan.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium">
            {connected ? (
              <Badge variant="success" className="px-2.5 py-1">
                <CheckCircle2 className="w-3 h-3" />
                Terhubung
              </Badge>
            ) : (
              <Badge variant="outline" className="px-2.5 py-1">
                <AlertCircle className="w-3 h-3" />
                Belum Terhubung
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
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
              className="w-full"
            >
              {action === "disconnect" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Unlink className="w-4 h-4" />
              )}
              Putuskan Koneksi
            </Button>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600 space-y-1">
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
          <Button
            type="button"
            onClick={handleConnect}
            disabled={isLoading || action !== null}
            className="w-full"
          >
            {action === "connect" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LinkIcon className="w-4 h-4" />
            )}
            Hubungkan Telegram
          </Button>
        )}

        {deepLink && !connected && (
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-4">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
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
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Buka Telegram
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                disabled={action !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Saya Sudah Menghubungkan
              </button>
            </div>

            {remainingSeconds !== null && (
              <p className="mt-3 text-[10px] text-blue-700">
                Tautan berlaku sekitar {Math.ceil(remainingSeconds / 60)} menit
                lagi dan hanya dapat digunakan satu kali.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
