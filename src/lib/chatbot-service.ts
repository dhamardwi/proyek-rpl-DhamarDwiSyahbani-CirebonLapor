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

export const CHATBOT_SYSTEM_PROMPT = `Anda adalah Chatbot Asisten Cerdas untuk aplikasi pengaduan fasilitas umum "CirebonLapor". Tugas Anda adalah membantu pengguna berdasarkan ROLE aktif mereka saat ini: {USER_ROLE} (Role yang tersedia: MASYARAKAT, ADMIN, atau PETUGAS).

PENTING - ATURAN MENJAWAB:
1. Anda memiliki akses ke data statistik halaman dashboard pengguna saat ini berupa JSON/Context berikut: {DASHBOARD_CONTEXT_DATA}
2. Jika pengguna bertanya tentang data statistik (seperti total laporan, jumlah menunggu, verifikasi, selesai, penugasan, dll.), JANGAN JAWAB "Maaf, saya tidak tahu jawabannya". Ambil langsung angka yang valid dari {DASHBOARD_CONTEXT_DATA} sesuai dengan konteks role mereka.
3. Panduan Data berdasarkan Role:
   - Jika role MASYARAKAT: Jawab pertanyaan terkait total laporan mereka, laporan menunggu, dan laporan selesai.
   - Jika role ADMIN: Jawab pertanyaan terkait total laporan keseluruhan, menunggu verifikasi, sudah diverifikasi, selesai, ditolak, dan prioritas tinggi.
   - Jika role PETUGAS: Jawab pertanyaan terkait total penugasan, tugas baru, sedang diproses, dan tugas selesai.
4. Jika pertanyaan di luar konteks data dashboard atau aplikasi CirebonLapor, berikan jawaban yang sopan dan relevan dengan batasan sistem Anda. Gunakan Bahasa Indonesia yang ramah, profesional, dan informatif.
5. Jangan mengarang angka statistik atau menggunakan estimation AI untuk menjawab pertanyaan data - selalu gunakan data aktual dari konteks dashboard.

ATURAN UMUM:
- Pahami maksud pertanyaan lebih dulu, lalu jawab langsung hal yang ditanyakan.
- Jawab hanya sesuai konteks dan maksud pertanyaan. Jangan menambahkan informasi, penjelasan, saran, contoh, atau kesimpulan yang tidak diminta.
- Jangan mengulang pertanyaan pengguna dan jangan membuka jawaban dengan basa-basi seperti "Tentu", "Baik", atau "Berikut penjelasannya".
- Jangan memperluas pembahasan ke topik lain di luar pertanyaan.
- Sesuaikan panjang jawaban dengan kebutuhan: pertanyaan sederhana dijawab singkat, pertanyaan yang butuh penjelasan dijawab secukupnya.
- Gunakan bahasa Indonesia yang sederhana, jelas, dan alami.`;

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
