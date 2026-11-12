"use client";

import { useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Server,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AiProvider, AiProviderStatus } from "@/lib/ai/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AISettingsProps {
  initialProviders: AiProviderStatus[];
}

interface ProviderForm {
  apiKey: string;
  clearApiKey: boolean;
  baseUrl: string;
  model: string;
  isActive: boolean;
}

interface TestFeedback {
  ok: boolean;
  message: string;
  latencyMs?: number;
  reply?: string;
}

function buildForms(providers: AiProviderStatus[]): Record<AiProvider, ProviderForm> {
  const entries = providers.map((provider) => [
    provider.provider,
    {
      apiKey: "",
      clearApiKey: false,
      baseUrl: provider.baseUrl,
      model: provider.model,
      isActive: provider.isActive,
    },
  ]);
  return Object.fromEntries(entries) as Record<AiProvider, ProviderForm>;
}

function sourceLabel(status: AiProviderStatus): string {
  if (status.apiKeySource === "database") return "Tersimpan di database";
  if (status.apiKeySource === "environment") return "Dari environment variable";
  return "Belum ada API key";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PROVIDER_ICONS: Record<AiProvider, React.ElementType> = {
  NVIDIA: Bot,
  GEMINI: Sparkles,
};

export default function AISettings({ initialProviders }: AISettingsProps) {
  const [providers, setProviders] = useState<AiProviderStatus[]>(initialProviders);
  const [forms, setForms] = useState<Record<AiProvider, ProviderForm>>(
    buildForms(initialProviders)
  );
  const [models, setModels] = useState<Record<AiProvider, string[]>>({
    NVIDIA: [],
    GEMINI: [],
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tests, setTests] = useState<Partial<Record<AiProvider, TestFeedback>>>({});

  const patchForm = (provider: AiProvider, patch: Partial<ProviderForm>) => {
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));
  };

  const clearFeedback = () => {
    setError(null);
    setNotice(null);
  };

  const handleSave = async (provider: AiProvider) => {
    clearFeedback();
    setBusy(`${provider}:save`);
    const form = forms[provider];

    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: form.apiKey.trim() || undefined,
          clearApiKey: form.clearApiKey,
          baseUrl: form.baseUrl,
          model: form.model,
          isActive: form.isActive,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal menyimpan konfigurasi.");
      }

      const saved = json.data as AiProviderStatus;
      setProviders((prev) =>
        prev.map((item) => (item.provider === provider ? saved : item))
      );
      setForms((prev) => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          apiKey: "",
          clearApiKey: false,
          baseUrl: saved.baseUrl,
          model: saved.model,
          isActive: saved.isActive,
        },
      }));
      setNotice(json.message || "Konfigurasi berhasil disimpan.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan konfigurasi.");
    } finally {
      setBusy(null);
    }
  };

  const handleLoadModels = async (provider: AiProvider) => {
    clearFeedback();
    setBusy(`${provider}:models`);
    const form = forms[provider];

    try {
      const res = await fetch("/api/settings/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: form.apiKey.trim() || undefined,
          baseUrl: form.baseUrl,
        }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.message || "Gagal memuat daftar model.");
      }

      const list = (json.data?.models ?? []) as string[];
      setModels((prev) => ({ ...prev, [provider]: list }));

      const current = forms[provider].model;
      if (!current || !list.includes(current)) {
        patchForm(provider, { model: list[0] ?? current });
      }
      setNotice(json.message || "Daftar model berhasil dimuat.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar model.");
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async (provider: AiProvider) => {
    clearFeedback();
    setBusy(`${provider}:test`);
    const form = forms[provider];

    try {
      const res = await fetch("/api/settings/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: form.apiKey.trim() || undefined,
          baseUrl: form.baseUrl,
          model: form.model,
        }),
      });
      const json = await res.json();
      const data = json.data as
        | { ok: boolean; message: string; latencyMs?: number; reply?: string }
        | undefined;

      setTests((prev) => ({
        ...prev,
        [provider]: {
          ok: Boolean(json.success && data?.ok),
          message: json.message || "Uji koneksi selesai.",
          latencyMs: data?.latencyMs,
          reply: data?.reply,
        },
      }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [provider]: {
          ok: false,
          message: err instanceof Error ? err.message : "Gagal menguji koneksi.",
        },
      }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
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

      {providers.map((status) => {
        const provider = status.provider;
        const form = forms[provider];
        const Icon = PROVIDER_ICONS[provider];
        const listId = `model-options-${provider}`;
        const modelOptions = models[provider];
        const test = tests[provider];

        return (
          <Card key={provider}>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900">
                      {status.label}
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">{status.purpose}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      {status.available ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Aktif &amp; siap dipakai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Belum siap
                        </span>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {sourceLabel(status)}
                      </Badge>
                      {!status.isActive && (
                        <Badge variant="outline" className="text-xs text-slate-500">
                          Dinonaktifkan
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      patchForm(provider, { isActive: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  Aktifkan provider
                </label>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor={`${provider}-api-key`} className="flex items-center gap-2">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    API Key
                  </Label>
                  <Input
                    id={`${provider}-api-key`}
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      status.hasApiKey
                        ? "•••••••• (kosongkan untuk mempertahankan)"
                        : "Masukkan API key"
                    }
                    value={form.apiKey}
                    onChange={(event) =>
                      patchForm(provider, {
                        apiKey: event.target.value,
                        clearApiKey: false,
                      })
                    }
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-slate-500">
                      {status.hasApiKey
                        ? `Key ${status.apiKeySource === "environment" ? "dari env" : "tersimpan"} — tidak pernah ditampilkan.`
                        : "Belum ada key tersimpan."}
                    </p>
                    {status.hasApiKey && status.apiKeySource === "database" && (
                      <label className="inline-flex items-center gap-1.5 text-xs text-red-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.clearApiKey}
                          onChange={(event) =>
                            patchForm(provider, {
                              clearApiKey: event.target.checked,
                              apiKey: "",
                            })
                          }
                          className="h-3.5 w-3.5 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        Hapus key
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor={`${provider}-base-url`} className="flex items-center gap-2">
                    <Server className="w-3.5 h-3.5 text-slate-400" />
                    Base URL
                  </Label>
                  <Input
                    id={`${provider}-base-url`}
                    type="url"
                    placeholder={status.defaults.baseUrl}
                    value={form.baseUrl}
                    onChange={(event) =>
                      patchForm(provider, { baseUrl: event.target.value })
                    }
                  />
                  <p className="mt-2 text-xs text-slate-500 break-all">
                    Default: <span className="font-mono">{status.defaults.baseUrl}</span>
                  </p>
                </div>

                <div className="lg:col-span-2">
                  <Label htmlFor={`${provider}-model`} className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                    Model
                  </Label>
                  <Input
                    id={`${provider}-model`}
                    type="text"
                    list={listId}
                    placeholder={status.defaults.model}
                    value={form.model}
                    onChange={(event) =>
                      patchForm(provider, { model: event.target.value })
                    }
                  />
                  <datalist id={listId}>
                    {modelOptions.map((model) => (
                      <option key={model} value={model} />
                    ))}
                  </datalist>
                  <p className="mt-2 text-xs text-slate-500">
                    {provider === "NVIDIA"
                      ? "Katalog NVIDIA memuat banyak model; tidak semuanya dapat diakses API key ini. Muat daftar, pilih model chat, lalu Uji Koneksi sebelum dipakai."
                      : "Gunakan model teks yang mendukung generateContent dan input gambar (default: gemini-3.6-flash). Daftar model diambil langsung dari API Gemini; model 2.5 lama sudah dibatasi untuk key baru. Jika model sedang sibuk (HTTP 503), aplikasi otomatis mencoba model cadangan."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button
                  type="button"
                  onClick={() => handleSave(provider)}
                  disabled={busy !== null}
                >
                  {busy === `${provider}:save` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleLoadModels(provider)}
                  disabled={busy !== null}
                >
                  {busy === `${provider}:models` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Muat Daftar Model
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleTest(provider)}
                  disabled={busy !== null}
                >
                  {busy === `${provider}:test` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  Uji Koneksi
                </Button>
                {modelOptions.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {modelOptions.length} kandidat model — uji dulu sebelum dipakai
                  </span>
                )}
              </div>

              {test && (
                <div
                  className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${
                    test.ok
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {test.ok ? (
                    <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p>{test.message}</p>
                    {typeof test.latencyMs === "number" && test.latencyMs > 0 && (
                      <p className="text-xs mt-1 opacity-80">
                        Latensi: {test.latencyMs} ms
                      </p>
                    )}
                    {test.reply && (
                      <p className="text-xs mt-1 opacity-80">
                        Respons: &ldquo;{test.reply}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-slate-500 pt-2 border-t border-slate-100">
                <span className="inline-flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  Terakhir diubah: {formatDate(status.updatedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5" />
                  Model aktif: <span className="font-mono">{status.model}</span>
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-slate-400" />
          Catatan keamanan
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>API key disimpan terenkripsi (AES-256-GCM) dan tidak pernah dikirim ke browser.</li>
          <li>Perubahan konfigurasi langsung dipakai backend tanpa perlu mengubah kode atau restart.</li>
          <li>
            Bila provider gagal atau timeout, chatbot memakai jawaban lokal dan laporan tetap
            dapat dikirim serta diperiksa dengan metode duplikat lokal.
          </li>
          <li>Kosongkan kolom API key saat menyimpan untuk mempertahankan key yang sudah ada.</li>
        </ul>
      </div>
    </div>
  );
}
