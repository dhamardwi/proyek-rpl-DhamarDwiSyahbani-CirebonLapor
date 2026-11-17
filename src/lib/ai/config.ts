/**
 * Konfigurasi provider AI (NVIDIA NIM).
 *
 * Penyimpanan memakai tabel `app_settings` (key-value) yang sudah ada.
 * Kunci yang dipakai:
 *   - NVIDIA : ai.chatbot.apiKey / ai.chatbot.baseUrl / ai.chatbot.model / ai.chatbot.enabled
 *
 * Fallback environment variable tetap didukung agar deployment lama berjalan.
 * Modul ini hanya boleh diimpor di server. API key tidak pernah diekspos ke
 * client; gunakan `getAiProviderStatus()` untuk data yang aman ditampilkan.
 */

import db from "@/lib/db";
import { decryptSecret, encryptSecret } from "./crypto";

export type AiProvider = "NVIDIA";

interface SettingsKeys {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: string;
}

export interface AiProviderDefinition {
  label: string;
  purpose: string;
  baseUrl: string;
  model: string;
  envApiKey: string;
  envBaseUrl: string;
  envModel: string;
  settings: SettingsKeys;
  /** Kunci lama/alternatif yang tetap dibaca agar konfigurasi tidak hilang. */
  legacySettings?: Partial<Record<keyof SettingsKeys, string[]>>;
}

export const AI_PROVIDERS: Record<AiProvider, AiProviderDefinition> = {
  NVIDIA: {
    label: "NVIDIA NIM",
    purpose: "Chatbot asisten CirebonLapor",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "openai/gpt-oss-20b",
    envApiKey: "NVIDIA_API_KEY",
    envBaseUrl: "NVIDIA_BASE_URL",
    envModel: "NVIDIA_MODEL",
    settings: {
      apiKey: "ai.chatbot.apiKey",
      baseUrl: "ai.chatbot.baseUrl",
      model: "ai.chatbot.model",
      enabled: "ai.chatbot.enabled",
    },
    legacySettings: {
      apiKey: ["ai.nvidia.apiKey"],
      baseUrl: ["ai.nvidia.baseUrl"],
      model: ["ai.nvidia.model"],
    },
  },
};

export const AI_PROVIDER_LIST: AiProvider[] = ["NVIDIA"];

export function isAiProvider(value: unknown): value is AiProvider {
  return value === "NVIDIA";
}

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function normalizeBaseUrl(
  value: string | null | undefined,
  fallback: string
): string {
  const raw = (value ?? "").trim() || fallback;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return fallback;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return fallback;
  }
}

export function normalizeModel(
  value: string | null | undefined,
  fallback: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameter dummy, nilai tidak dipakai
  _provider: AiProvider
): string {
  return (value ?? "").trim() || fallback;
}

// ---------------------------------------------------------------------------
// Akses tabel app_settings (SQL parameterized, kompatibel dengan data lama)
// ---------------------------------------------------------------------------

interface SettingRow {
  key: string;
  value: string;
  updated_at: number | string | Date | null;
}

function toDate(value: SettingRow["updated_at"]): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const numeric = Number(value);
    // Nilai lama disimpan sebagai epoch milidetik.
    const date = new Date(numeric);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readSettings(keys: string[]): Promise<Map<string, SettingRow>> {
  if (keys.length === 0) return new Map();

  try {
    const placeholders = keys.map(() => "?").join(", ");
    const rows = await db.$queryRawUnsafe<SettingRow[]>(
      `SELECT key, value, updated_at FROM app_settings WHERE key IN (${placeholders})`,
      ...keys
    );
    return new Map(rows.map((row) => [row.key, row]));
  } catch (error) {
    console.warn(
      "[AI_CONFIG] Gagal membaca app_settings:",
      error instanceof Error ? error.message : "unknown"
    );
    return new Map();
  }
}

async function writeSetting(key: string, value: string): Promise<void> {
  await db.$executeRawUnsafe(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    value,
    Date.now()
  );
}

async function deleteSetting(key: string): Promise<void> {
  await db.$executeRawUnsafe(`DELETE FROM app_settings WHERE key = ?`, key);
}

function pickRow(
  rows: Map<string, SettingRow>,
  primary: string,
  aliases: string[] = []
): SettingRow | null {
  return rows.get(primary) ?? aliases.map((key) => rows.get(key)).find(Boolean) ?? null;
}

function allKeys(definition: AiProviderDefinition): string[] {
  const keys = Object.values(definition.settings);
  for (const aliasList of Object.values(definition.legacySettings ?? {})) {
    if (aliasList) keys.push(...aliasList);
  }
  return Array.from(new Set(keys));
}

// ---------------------------------------------------------------------------
// Resolusi konfigurasi
// ---------------------------------------------------------------------------

export type AiConfigSource = "database" | "environment" | "none";

export interface ResolvedAiConfig {
  provider: AiProvider;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  isActive: boolean;
  source: AiConfigSource;
  updatedAt: Date | null;
}

export async function getAiConfig(provider: AiProvider): Promise<ResolvedAiConfig> {
  const definition = AI_PROVIDERS[provider];
  const rows = await readSettings(allKeys(definition));

  const keyRow = pickRow(
    rows,
    definition.settings.apiKey,
    definition.legacySettings?.apiKey
  );
  const baseUrlRow = pickRow(
    rows,
    definition.settings.baseUrl,
    definition.legacySettings?.baseUrl
  );
  const modelRow = pickRow(
    rows,
    definition.settings.model,
    definition.legacySettings?.model
  );
  const enabledRow = pickRow(
    rows,
    definition.settings.enabled,
    definition.legacySettings?.enabled
  );

  const storedKey = keyRow?.value ? decryptSecret(keyRow.value) : null;
  const envKey = readEnv(definition.envApiKey);

  const apiKey = storedKey || envKey || null;
  const source: AiConfigSource = storedKey
    ? "database"
    : envKey
      ? "environment"
      : "none";

  const dates = [keyRow, baseUrlRow, modelRow, enabledRow]
    .map((row) => (row ? toDate(row.updated_at) : null))
    .filter((date): date is Date => Boolean(date));
  const updatedAt =
    dates.length > 0
      ? new Date(Math.max(...dates.map((date) => date.getTime())))
      : null;

  return {
    provider,
    apiKey,
    baseUrl: normalizeBaseUrl(
      baseUrlRow?.value || readEnv(definition.envBaseUrl),
      definition.baseUrl
    ),
    model: normalizeModel(
      modelRow?.value || readEnv(definition.envModel),
      definition.model,
      provider
    ),
    isActive: enabledRow ? enabledRow.value !== "false" : true,
    source,
    updatedAt,
  };
}

export interface AiProviderStatus {
  provider: AiProvider;
  label: string;
  purpose: string;
  hasApiKey: boolean;
  apiKeySource: AiConfigSource;
  baseUrl: string;
  model: string;
  isActive: boolean;
  available: boolean;
  updatedAt: string | null;
  defaults: {
    baseUrl: string;
    model: string;
  };
}

/** Data konfigurasi yang aman dikirim ke frontend (tanpa API key). */
export async function getAiProviderStatus(
  provider: AiProvider
): Promise<AiProviderStatus> {
  const definition = AI_PROVIDERS[provider];
  const config = await getAiConfig(provider);

  return {
    provider,
    label: definition.label,
    purpose: definition.purpose,
    hasApiKey: Boolean(config.apiKey),
    apiKeySource: config.source,
    baseUrl: config.baseUrl,
    model: config.model,
    isActive: config.isActive,
    available: config.isActive && Boolean(config.apiKey),
    updatedAt: config.updatedAt ? config.updatedAt.toISOString() : null,
    defaults: {
      baseUrl: definition.baseUrl,
      model: definition.model,
    },
  };
}

export async function getAiProviderStatuses(): Promise<AiProviderStatus[]> {
  return Promise.all(AI_PROVIDER_LIST.map((provider) => getAiProviderStatus(provider)));
}

// ---------------------------------------------------------------------------
// Simpan konfigurasi
// ---------------------------------------------------------------------------

export interface SaveAiConfigInput {
  provider: AiProvider;
  /** API key baru (plaintext). Kosong/undefined = pertahankan key tersimpan. */
  apiKey?: string | null;
  /** Hapus API key tersimpan di database. */
  clearApiKey?: boolean;
  baseUrl?: string | null;
  model?: string | null;
  isActive?: boolean;
  updatedById?: string | null;
}

export async function saveAiConfig(
  input: SaveAiConfigInput
): Promise<AiProviderStatus> {
  const { provider } = input;
  const definition = AI_PROVIDERS[provider];
  const settings = definition.settings;

  const trimmedKey = input.apiKey?.trim() ?? "";

  try {
    if (input.clearApiKey) {
      await deleteSetting(settings.apiKey);
    } else if (trimmedKey) {
      await writeSetting(settings.apiKey, encryptSecret(trimmedKey));
    }

    if (input.baseUrl !== undefined && input.baseUrl !== null) {
      await writeSetting(
        settings.baseUrl,
        normalizeBaseUrl(input.baseUrl, definition.baseUrl)
      );
    }

    if (input.model !== undefined && input.model !== null) {
      await writeSetting(
        settings.model,
        normalizeModel(input.model, definition.model, provider)
      );
    }

    if (typeof input.isActive === "boolean") {
      await writeSetting(settings.enabled, input.isActive ? "true" : "false");
    }
  } catch (error) {
    console.error(
      "[AI_CONFIG] Gagal menyimpan konfigurasi:",
      error instanceof Error ? error.message : "unknown"
    );
    throw new Error("Gagal menyimpan konfigurasi AI ke database.");
  }

  return getAiProviderStatus(provider);
}
