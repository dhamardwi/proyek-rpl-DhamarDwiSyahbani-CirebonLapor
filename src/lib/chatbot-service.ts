/**
 * Chatbot Service — NVIDIA NIM (OpenAI-compatible).
 *
 * Endpoint default: https://integrate.api.nvidia.com/v1/chat/completions
 * Auth: Authorization: Bearer <API key>
 * Model default: openai/gpt-oss-20b.
 *
 * Konfigurasi (API key, base URL, model) dibaca dari pengaturan Admin di
 * database, dengan fallback ke environment variable. API key TIDAK PERNAH
 * dikirim ke client — hanya dipakai di server (API route /api/chatbot).
 */

import { getAiConfig } from "@/lib/ai/config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function getChatbotModel(): Promise<string> {
  const config = await getAiConfig("NVIDIA");
  return config.model;
}

export async function isChatbotAvailable(): Promise<boolean> {
  const config = await getAiConfig("NVIDIA");
  return config.isActive && Boolean(config.apiKey);
}

export const CHATBOT_SYSTEM_PROMPT = `Anda adalah Chatbot Asisten untuk aplikasi pengaduan fasilitas umum "CirebonLapor". Peran pengguna saat ini: {USER_ROLE} (MASYARAKAT, ADMIN, atau PETUGAS).

SUMBER DATA (WAJIB):
- Data aktual (database) ada di konteks berikut: {DASHBOARD_CONTEXT_DATA}
- Untuk pertanyaan statistik/jumlah/status/prioritas/pengguna, gunakan HANYA angka dari konteks tersebut. Jangan mengarang, memperkirakan, atau mengganti angka.
- Jika hasilnya 0, jawab 0 (jangan mengganti dengan total laporan). Jika data tidak tersedia, katakan datanya tidak tersedia.

DEFINISI DASHBOARD (harus konsisten):
- ADMIN: Menunggu Verifikasi = MENUNGGU_VERIFIKASI, Sudah Diverifikasi = DITERIMA, Sedang Diproses = SEDANG_DIPERBAIKI, Selesai = SELESAI, Ditolak = DITOLAK, Prioritas Tinggi (kartu) = TINGGI atau KRITIS, Total Laporan = seluruh laporan.
- PETUGAS (hanya penugasan milik petugas login): Total Penugasan = seluruh tugas, Tugas Baru = DITUGASKAN, Sedang Diproses = SEDANG_DIPERBAIKI, Selesai = SELESAI.

ATURAN JAWABAN:
- Jawab langsung dan singkat sesuai pertanyaan.
- Jangan membuka dengan basa-basi.
- Jangan menampilkan data/angka milik peran lain.
- Jika pertanyaan ambigu (mis. "diverifikasi" tanpa jelas menunggu/sudah), minta klarifikasi singkat.
- Jika di luar cakupan data/aplikasi, jawab sopan bahwa Anda tidak memiliki datanya. Gunakan Bahasa Indonesia yang jelas.`;

/** Pekerjaan chatbot per peran, dipakai untuk mengarahkan jawaban AI. */
const ROLE_DUTIES: Record<string, string> = {
  ADMIN:
    "memverifikasi laporan, menugaskan petugas, dan melihat data pengguna serta seluruh laporan",
  PETUGAS: "melihat dan menangani tugas perbaikan yang ditugaskan kepadanya",
  MASYARAKAT: "membuat laporan, memantau status laporan miliknya, dan melihat notifikasinya",
};

/** Gabungkan system prompt stabil + konteks DB read-only (opsional, fail-open). */
export function buildSystemPrompt(dbContext?: string, role?: string): string {
  const roleLine = role
    ? `\n\nPERAN PENGGUNA SAAT INI: ${role}. Kamu adalah chatbot ${role}. ` +
      `Pekerjaanmu hanya ${ROLE_DUTIES[role] ?? "membantu sesuai peran pengguna"}. ` +
      "Jawab hanya pertanyaan yang sesuai peran tersebut dan jangan menjawab pertanyaan atau menampilkan data milik peran lain; jika ditanya, katakan bahwa informasi itu hanya tersedia untuk peran terkait."
    : "";

  // Ganti placeholder dengan nilai aktual
  let base = CHATBOT_SYSTEM_PROMPT.replace("{USER_ROLE}", role ?? "MASYARAKAT");
  base = base.replace("{DASHBOARD_CONTEXT_DATA}", dbContext ?? "Tidak ada data statistik yang tersedia.");
  base = `${base}${roleLine}`;

  if (!dbContext) return base;
  return `${base}\n\n${dbContext}`;
}

function isReasoningModel(model: string): boolean {
  return /gpt-oss|reasoning|deepseek-r1|o1|o3/i.test(model);
}

/**
 * Kirim riwayat percakapan ke NVIDIA NIM dan kembalikan jawaban asisten.
 * Param kedua dbContext bersifat opsional agar kompatibel dengan pemanggil lama.
 */
export async function sendChatToNvidia(
  messages: ChatMessage[],
  dbContext?: string,
  role?: string
): Promise<string> {
  const config = await getAiConfig("NVIDIA");
  if (!config.isActive || !config.apiKey) {
    throw new Error(
      "Konfigurasi NVIDIA NIM belum aktif. Atur API key dan model di halaman Admin."
    );
  }

  const model = config.model;
  const payload: Record<string, unknown> = {
    model,
    messages: [{ role: "system", content: buildSystemPrompt(dbContext, role) }, ...messages],
    temperature: 0.3,
    top_p: 0.9,
    max_tokens: 1024,
  };
  // reasoning_effort hanya untuk model reasoning — model chat biasa akan 400 jika dikirim.
  if (isReasoningModel(model)) {
    payload.reasoning_effort = "low";
  }

  const res = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const safeText = text.split(config.apiKey).join("***");
    throw new Error(
      `NVIDIA API error (${res.status}): ${safeText.slice(0, 500)}`
    );
  }

  const data = await res.json();
  const msg = data?.choices?.[0]?.message;
  // Beberapa model reasoning (mis. gpt-oss via NIM) menaruh jawaban di
  // reasoning_content saat token habis — fallback berurutan.
  const reply: string | undefined =
    msg?.content?.trim() ||
    msg?.reasoning_content?.trim() ||
    (typeof msg?.reasoning === "string" ? msg.reasoning.trim() : undefined);

  if (!reply) {
    throw new Error("Respons AI kosong dari NVIDIA API.");
  }

  return reply;
}
