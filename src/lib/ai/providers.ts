/**
 * Integrasi HTTP ke provider AI: daftar model & uji koneksi.
 *
 * Semua fungsi di sini hanya dipanggil dari server. API key tidak boleh
 * bocor ke response error/log — gunakan `sanitizeProviderError`.
 */

import { AI_PROVIDERS, type AiProvider } from "./config";
import {
  generateGeminiContent,
  summarizeGeminiError,
} from "./gemini";

const DEFAULT_TIMEOUT_MS = 20_000;
const CHAT_TIMEOUT_MS = 45_000;

export interface ProviderCredentials {
  apiKey: string;
  baseUrl: string;
  model?: string;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
  reply?: string;
}

interface FetchResult {
  ok: boolean;
  status: number;
  text: string;
  json: unknown;
}

function sanitizeProviderError(text: string, apiKey: string): string {
  const withoutKey = apiKey ? text.split(apiKey).join("***") : text;
  return withoutKey.replace(/\s+/g, " ").trim().slice(0, 400);
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, text, json };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Filter katalog model
// ---------------------------------------------------------------------------

/**
 * Pola nama model yang BUKAN untuk Chat Completions (embedding, rerank,
 * visi-murni, speech, OCR, biologi, deteksi, dsb). Daftar ini bersifat
 * best-effort karena katalog NVIDIA tidak menyertakan kapabilitas eksplisit.
 */
const NON_CHAT_MODEL_PATTERNS: RegExp[] = [
  /embed/i,
  /rerank/i,
  /\bbge\b/i,
  /\be5-/i,
  /arctic-embed/i,
  /nv-embed/i,
  /\bclip\b/i,
  /nvclip/i,
  /deplot/i,
  /kosmos/i,
  /fuyu/i,
  /\bvila\b/i,
  /\bneva\b/i,
  /\blayout\b/i,
  /\bparse\b/i,
  /\bocr\b/i,
  /\basr\b/i,
  /\btts\b/i,
  /whisper/i,
  /\briva\b/i,
  /safety/i,
  /\bguard\b/i,
  /nemoguard/i,
  /reward/i,
  /diffusion/i,
  /sdxl/i,
  /\bflux\b/i,
  /imagegen/i,
  /optical/i,
  /geneformer/i,
  /\besm\b/i,
  /protein/i,
  /\bmol\b/i,
  /chem/i,
  /weather/i,
  /forecast/i,
  /segformer/i,
  /\bsam\b/i,
  /\bdetr\b/i,
  /yolo/i,
  /grounding/i,
  /\bbev\b/i,
  /depth/i,
  /\btrack/i,
  /streampetr/i,
  /sparse4d/i,
  /centerpoint/i,
  /bevformer/i,
  /nuscenes/i,
];

export function isLikelyChatModel(id: string): boolean {
  const name = id.trim();
  if (!name) return false;
  if (/(^|[/_-])vision($|[/_-])/i.test(name)) return false;
  return !NON_CHAT_MODEL_PATTERNS.some((pattern) => pattern.test(name));
}

export function filterNvidiaChatModels(ids: string[]): string[] {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  return unique.filter(isLikelyChatModel).sort((a, b) => a.localeCompare(b));
}

interface GeminiModelEntry {
  name?: string;
  supportedGenerationMethods?: string[];
  outputModalities?: string[];
}

/**
 * Model Gemini yang bisa `generateContent` tetapi bukan penghasil teks
 * (gambar/audio/TTS/live/embedding) tidak cocok untuk analisis foto maupun
 * konfirmasi duplikat. Model seperti ini disembunyikan dari daftar kandidat.
 */
const NON_TEXT_GEMINI_PATTERNS: RegExp[] = [
  /-tts\b/i,
  /-image\b/i,
  /-audio\b/i,
  /-live\b/i,
  /-native-audio\b/i,
  /embedding/i,
  /^imagen/i,
  /^veo/i,
  /^lyria/i,
  /^aqa/i,
];

function isTextOutputGeminiModel(model: GeminiModelEntry): boolean {
  const name = (model.name ?? "").replace(/^models\//, "");
  if (!name) return false;
  if (NON_TEXT_GEMINI_PATTERNS.some((pattern) => pattern.test(name))) return false;
  if (
    Array.isArray(model.outputModalities) &&
    model.outputModalities.length > 0 &&
    !model.outputModalities.includes("TEXT")
  ) {
    return false;
  }
  return true;
}

function geminiVersionScore(name: string): number {
  const match = name.match(/^gemini-(\d+)(?:\.(\d+))?/i);
  if (!match) return 0;
  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : 0;
  return major * 100 + minor;
}

export function filterGeminiModels(models: GeminiModelEntry[]): string[] {
  const names = models
    .filter((model) => {
      const methods = model.supportedGenerationMethods ?? [];
      return methods.includes("generateContent") && isTextOutputGeminiModel(model);
    })
    .map((model) => (model.name ?? "").replace(/^models\//, "").trim())
    .filter(Boolean);

  const defaultModel = AI_PROVIDERS.GEMINI.model;

  return Array.from(new Set(names)).sort((a, b) => {
    // Model bawaan selalu di urutan pertama agar UI tidak memilih model lama
    // secara otomatis saat daftar dimuat.
    if (a === defaultModel) return -1;
    if (b === defaultModel) return 1;

    const versionDiff = geminiVersionScore(b) - geminiVersionScore(a);
    if (versionDiff !== 0) return versionDiff;

    // Versi stabil didahulukan dari preview pada generasi yang sama.
    const aPreview = /preview|exp\b/i.test(a) ? 1 : 0;
    const bPreview = /preview|exp\b/i.test(b) ? 1 : 0;
    if (aPreview !== bPreview) return aPreview - bPreview;

    return a.localeCompare(b);
  });
}

// ---------------------------------------------------------------------------
// Daftar model
// ---------------------------------------------------------------------------

function nvidiaHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function listNvidiaModels(credentials: ProviderCredentials): Promise<string[]> {
  if (!credentials.apiKey) {
    throw new Error("API key NVIDIA belum diisi.");
  }

  const url = `${credentials.baseUrl.replace(/\/+$/, "")}/models`;
  let result: FetchResult;
  try {
    result = await fetchJson(url, {
      method: "GET",
      headers: nvidiaHeaders(credentials.apiKey),
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "permintaan timeout"
        : error instanceof Error
          ? error.message
          : "gagal terhubung";
    throw new Error(`Gagal mengambil daftar model NVIDIA (${reason}).`);
  }

  if (!result.ok) {
    throw new Error(
      `NVIDIA menolak permintaan daftar model (HTTP ${result.status}): ` +
        sanitizeProviderError(result.text, credentials.apiKey)
    );
  }

  const payload = result.json as { data?: Array<{ id?: string }> } | null;
  const ids = (payload?.data ?? [])
    .map((item) => item?.id ?? "")
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) {
    throw new Error("Daftar model NVIDIA kosong. Isi model secara manual.");
  }

  return filterNvidiaChatModels(ids);
}

export async function listGeminiModels(credentials: ProviderCredentials): Promise<string[]> {
  if (!credentials.apiKey) {
    throw new Error("API key Gemini belum diisi.");
  }

  const url = `${credentials.baseUrl.replace(/\/+$/, "")}/models?pageSize=1000`;
  let result: FetchResult;
  try {
    result = await fetchJson(url, {
      method: "GET",
      headers: {
        "x-goog-api-key": credentials.apiKey,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "permintaan timeout"
        : error instanceof Error
          ? error.message
          : "gagal terhubung";
    throw new Error(`Gagal mengambil daftar model Gemini (${reason}).`);
  }

  if (!result.ok) {
    throw new Error(
      `Gemini menolak permintaan daftar model (HTTP ${result.status}): ` +
        sanitizeProviderError(result.text, credentials.apiKey)
    );
  }

  const payload = result.json as { models?: GeminiModelEntry[] } | null;
  const models = filterGeminiModels(payload?.models ?? []);

  if (models.length === 0) {
    throw new Error(
      "Tidak ada model Gemini yang mendukung generateContent untuk API key ini."
    );
  }

  return models;
}

export async function listProviderModels(
  provider: AiProvider,
  credentials: ProviderCredentials
): Promise<string[]> {
  return provider === "NVIDIA"
    ? listNvidiaModels(credentials)
    : listGeminiModels(credentials);
}

// ---------------------------------------------------------------------------
// Uji koneksi
// ---------------------------------------------------------------------------

function isReasoningModel(model: string): boolean {
  return /gpt-oss|reasoning|deepseek-r1|o1|o3/i.test(model);
}

async function testNvidia(credentials: ProviderCredentials): Promise<ProviderTestResult> {
  const model = credentials.model || AI_PROVIDERS.NVIDIA.model;
  const started = Date.now();

  const payload: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "user",
        content: "Balas dengan satu kata: OK",
      },
    ],
    temperature: 0,
    max_tokens: 32,
  };
  if (isReasoningModel(model)) payload.reasoning_effort = "low";

  let result: FetchResult;
  try {
    result = await fetchJson(
      `${credentials.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: nvidiaHeaders(credentials.apiKey),
        body: JSON.stringify(payload),
      },
      CHAT_TIMEOUT_MS
    );
  } catch (error) {
    const latencyMs = Date.now() - started;
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "permintaan timeout"
        : error instanceof Error
          ? error.message
          : "gagal terhubung";
    return {
      ok: false,
      latencyMs,
      message: `Koneksi NVIDIA gagal (${reason}). Periksa jaringan/Base URL.`,
    };
  }

  const latencyMs = Date.now() - started;

  if (!result.ok) {
    return {
      ok: false,
      latencyMs,
      message:
        `Model "${model}" gagal digunakan (HTTP ${result.status}): ` +
        sanitizeProviderError(result.text, credentials.apiKey),
    };
  }

  const data = result.json as {
    choices?: Array<{ message?: { content?: string; reasoning_content?: string } }>;
  } | null;
  const reply =
    data?.choices?.[0]?.message?.content?.trim() ||
    data?.choices?.[0]?.message?.reasoning_content?.trim() ||
    "";

  if (!reply) {
    return {
      ok: false,
      latencyMs,
      message: `Model "${model}" terhubung tetapi tidak mengembalikan teks jawaban.`,
    };
  }

  return {
    ok: true,
    latencyMs,
    reply: reply.slice(0, 200),
    message: `Koneksi NVIDIA berhasil. Model "${model}" merespons.`,
  };
}

async function testGemini(credentials: ProviderCredentials): Promise<ProviderTestResult> {
  const model = credentials.model || AI_PROVIDERS.GEMINI.model;
  const started = Date.now();

  // maxOutputTokens cukup besar karena model 3.x tetap memakai token untuk
  // proses berpikir. Model yang tidak tersedia otomatis dicoba ke default.
  const result = await generateGeminiContent({
    apiKey: credentials.apiKey,
    baseUrl: credentials.baseUrl,
    model,
    contents: [
      {
        role: "user",
        parts: [{ text: "Balas dengan satu kata: OK" }],
      },
    ],
    maxOutputTokens: 512,
    timeoutMs: CHAT_TIMEOUT_MS,
  });

  const latencyMs = Date.now() - started;

  if (result.status === 0) {
    return {
      ok: false,
      latencyMs,
      message: `Koneksi Gemini gagal (${result.raw}). Periksa jaringan/Base URL.`,
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      latencyMs,
      message:
        `Model "${result.usedModel}" gagal digunakan (HTTP ${result.status}): ` +
        summarizeGeminiError(result.raw, credentials.apiKey, result.status),
    };
  }

  const data = result.json as {
    promptFeedback?: { blockReason?: string };
  } | null;

  if (data?.promptFeedback?.blockReason) {
    return {
      ok: false,
      latencyMs,
      message: `Permintaan diblokir oleh filter Gemini (${data.promptFeedback.blockReason}).`,
    };
  }

  if (!result.text) {
    const finish = result.finishReason ? ` (finishReason: ${result.finishReason})` : "";
    return {
      ok: false,
      latencyMs,
      message:
        `Model "${result.usedModel}" terhubung tetapi tidak mengembalikan teks${finish}. ` +
        "Coba model lain atau perbesar maxOutputTokens.",
    };
  }

  const fallbackNote = result.fallbackFrom
    ? ` Model "${result.fallbackFrom}" tidak tersedia atau sedang sibuk; permintaan dialihkan otomatis ke "${result.usedModel}". Simpan model pengganti agar tidak ada fallback berulang.`
    : "";

  return {
    ok: true,
    latencyMs,
    reply: result.text.slice(0, 200),
    message: `Koneksi Gemini berhasil. Model "${result.usedModel}" merespons.${fallbackNote}`,
  };
}

export async function testProviderConnection(
  provider: AiProvider,
  credentials: ProviderCredentials
): Promise<ProviderTestResult> {
  if (!credentials.apiKey) {
    return {
      ok: false,
      latencyMs: 0,
      message: "API key belum diisi. Simpan API key terlebih dahulu.",
    };
  }
  return provider === "NVIDIA"
    ? testNvidia(credentials)
    : testGemini(credentials);
}
