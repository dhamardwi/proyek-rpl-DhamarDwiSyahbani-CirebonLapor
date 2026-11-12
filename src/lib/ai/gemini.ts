/**
 * Helper terpusat untuk memanggil Gemini `generateContent`.
 *
 * Catatan penting (Gemini 3.x):
 * - Parameter sampling lama (`temperature`, `topP`, `topK`) sudah tidak dipakai
 *   dan dapat ditolak oleh model generasi baru. Karena itu helper ini tidak
 *   pernah mengirimkannya.
 * - Model 3.x memakai `thinkingConfig.thinkingLevel`; model 2.5 memakai
 *   `thinkingBudget`. Tanpa konfigurasi ini, jatah `maxOutputTokens` bisa
 *   habis untuk proses berpikir sehingga respons teks kosong.
 * - Bila model tersimpan sudah tidak tersedia (HTTP 404) atau sedang sibuk
 *   (HTTP 429/5xx), permintaan dicoba ke model cadangan agar fitur tetap
 *   berjalan. Batas waktu `timeoutMs` berlaku untuk seluruh percobaan.
 *
 * API key hanya dikirim lewat header dan tidak pernah masuk ke body/response.
 */

export const GEMINI_DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Urutan model cadangan saat model utama tidak tersedia/kelebihan beban.
 * `gemini-3.6-flash` dipakai sebagai default karena stabil dan mendukung
 * input gambar; 3.8 Flash bisa sedang high-demand (HTTP 503).
 */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
  "gemini-2.5-flash",
];

export interface GeminiGenerateInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  contents: unknown;
  maxOutputTokens: number;
  /** Minta Gemini mengembalikan JSON murni. */
  json?: boolean;
  /** Batas waktu total untuk semua percobaan model (bukan per model). */
  timeoutMs?: number;
  /**
   * Daftar model cadangan. Default: `GEMINI_FALLBACK_MODELS`.
   * Set `[]` untuk menonaktifkan fallback.
   */
  fallbackModels?: string[] | null;
}

export interface GeminiGenerateResult {
  ok: boolean;
  status: number;
  /** Teks jawaban yang sudah diekstrak (tanpa bagian "thought"). */
  text: string;
  /** Body respons mentah (sudah dipotong), untuk pesan diagnostik. */
  raw: string;
  /** JSON respons yang sudah diparse, bila valid. */
  json: unknown;
  usedModel: string;
  /** Terisi bila permintaan dialihkan ke model cadangan. */
  fallbackFrom: string | null;
  finishReason: string | null;
}

interface GeminiPart {
  text?: string;
  thought?: boolean;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; code?: number };
}

function normalizeModelName(model: string): string {
  return model.trim().replace(/^models\//, "");
}

export function buildGeminiUrl(baseUrl: string, model: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  return `${base}/models/${encodeURIComponent(normalizeModelName(model))}:generateContent`;
}

/** Konfigurasi berpikir yang sesuai dengan generasi model. */
export function geminiThinkingConfig(
  model: string
): Record<string, unknown> | null {
  const name = normalizeModelName(model).toLowerCase();
  const version = name.match(/^gemini-(\d+)/);
  if (version && Number(version[1]) >= 3) {
    return { thinkingLevel: "LOW" };
  }
  if (/^gemini-2\.5-flash/.test(name)) {
    return { thinkingBudget: 0 };
  }
  return null;
}

export function buildGeminiGenerationConfig(input: {
  model: string;
  maxOutputTokens: number;
  json?: boolean;
}): Record<string, unknown> {
  const config: Record<string, unknown> = {
    maxOutputTokens: Math.max(64, Math.trunc(input.maxOutputTokens)),
  };
  const thinking = geminiThinkingConfig(input.model);
  if (thinking) config.thinkingConfig = thinking;
  if (input.json) config.responseMimeType = "application/json";
  return config;
}

/** Ambil teks jawaban, abaikan part "thought" dan part non-teks. */
export function extractGeminiText(payload: unknown): string {
  const data = payload as GeminiResponse | null;
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export function geminiFinishReason(payload: unknown): string | null {
  const data = payload as GeminiResponse | null;
  return data?.candidates?.[0]?.finishReason ?? null;
}

/** Ringkasan error Gemini tanpa membocorkan API key. */
export function summarizeGeminiError(
  raw: string,
  apiKey: string,
  status: number
): string {
  let message = "";
  try {
    const parsed = JSON.parse(raw) as GeminiResponse;
    message = parsed?.error?.message ?? "";
  } catch {
    message = raw;
  }

  const withoutKey = apiKey ? message.split(apiKey).join("***") : message;
  return (withoutKey || `HTTP ${status}`).replace(/\s+/g, " ").trim().slice(0, 400);
}

async function requestGemini(
  input: GeminiGenerateInput,
  model: string
): Promise<GeminiGenerateResult> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? GEMINI_DEFAULT_TIMEOUT_MS
  );

  try {
    const res = await fetch(buildGeminiUrl(input.baseUrl, model), {
      method: "POST",
      headers: {
        "x-goog-api-key": input.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: input.contents,
        generationConfig: buildGeminiGenerationConfig({
          model,
          maxOutputTokens: input.maxOutputTokens,
          json: input.json,
        }),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await res.text();
    let parsed: unknown = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    return {
      ok: res.ok,
      status: res.status,
      text: res.ok ? extractGeminiText(parsed) : "",
      raw: raw.slice(0, 2000),
      json: parsed,
      usedModel: normalizeModelName(model),
      fallbackFrom: null,
      finishReason: geminiFinishReason(parsed),
    };
  } catch (error) {
    const reason =
      error instanceof Error && error.name === "AbortError"
        ? "permintaan timeout"
        : error instanceof Error
          ? error.message
          : "gagal terhubung";
    return {
      ok: false,
      status: 0,
      text: "",
      raw: reason,
      json: null,
      usedModel: normalizeModelName(model),
      fallbackFrom: null,
      finishReason: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

function isRetryableGeminiStatus(status: number): boolean {
  // 404: model tidak tersedia untuk key ini / sudah dihentikan.
  // 429/5xx: kuota sementara atau model sedang kelebihan beban.
  return status === 404 || status === 429 || status >= 500;
}

export async function generateGeminiContent(
  input: GeminiGenerateInput
): Promise<GeminiGenerateResult> {
  const primaryModel = normalizeModelName(input.model);
  const fallbackList =
    input.fallbackModels === undefined
      ? GEMINI_FALLBACK_MODELS
      : input.fallbackModels ?? [];

  const models = Array.from(
    new Set(
      [primaryModel, ...fallbackList.map(normalizeModelName)]
        .map((model) => model.trim())
        .filter(Boolean)
    )
  );

  const totalBudget = input.timeoutMs ?? GEMINI_DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();
  let firstFailure: GeminiGenerateResult | null = null;

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index];
    const remaining = totalBudget - (Date.now() - startedAt);

    // Sisakan waktu minimal agar percobaan berikutnya tidak langsung timeout.
    if (index > 0 && remaining < 1_000) break;

    const result = await requestGemini(
      { ...input, timeoutMs: Math.max(1_000, remaining) },
      model
    );

    if (result.ok) {
      return {
        ...result,
        fallbackFrom: index === 0 ? null : primaryModel,
      };
    }

    if (!firstFailure) firstFailure = result;

    // Error seperti API key salah (400/403) tidak akan membaik dengan
    // mengganti model, jadi hentikan percobaan.
    if (!isRetryableGeminiStatus(result.status)) break;
  }

  return (
    firstFailure ?? {
      ok: false,
      status: 0,
      text: "",
      raw: "Tidak ada model Gemini yang dapat dicoba.",
      json: null,
      usedModel: primaryModel,
      fallbackFrom: null,
      finishReason: null,
    }
  );
}
