/**
 * Chatbot Service — NVIDIA NIM (OpenAI-compatible).
 *
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Auth: Authorization: Bearer <NVIDIA_API_KEY> (nvapi-...)
 * Model default: openai/gpt-oss-20b (terverifikasi bisa diakses key ini).
 * Bisa diganti lewat env NVIDIA_MODEL.
 *
 * API key TIDAK PERNAH dikirim ke client — hanya dipakai di server
 * (API route /api/chatbot).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getNvidiaEndpoint(): string {
  return (
    process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1"
  ).replace(/\/$/, "");
}

export function getChatbotModel(): string {
  // Default: model yang terverifikasi dapat diakses API key ini.
  // Ganti lewat env NVIDIA_MODEL jika key Anda memiliki akses ke model lain.
  return process.env.NVIDIA_MODEL || "openai/gpt-oss-20b";
}

export function isChatbotAvailable(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY);
}

export const CHATBOT_SYSTEM_PROMPT = `Kamu adalah "Asisten Lapor Desa", chatbot berbahasa Indonesia untuk aplikasi CirebonLapor — Sistem Pelaporan Fasilitas Umum Rusak Desa Berbasis AI. Pengguna yang sedang login bisa MASYARAKAT, PETUGAS, atau ADMIN.

ATURAN JAWABAN (WAJIB DIPATUHI):
1. Pahami maksud pertanyaan lebih dulu, lalu jawab langsung hal yang ditanyakan.
2. Jawab hanya sesuai konteks dan maksud pertanyaan. Jangan menambahkan informasi, penjelasan, saran, contoh, atau kesimpulan yang tidak diminta.
3. Jangan mengulang pertanyaan pengguna dan jangan membuka jawaban dengan basa-basi seperti "Tentu", "Baik", atau "Berikut penjelasannya".
4. Jangan memperluas pembahasan ke topik lain di luar pertanyaan.
5. Sesuaikan panjang jawaban dengan kebutuhan: pertanyaan sederhana dijawab singkat, pertanyaan yang butuh penjelasan dijawab secukupnya.
6. Jika pengguna hanya meminta definisi, berikan definisinya saja. Jika meminta contoh, berikan contoh saja. Jika meminta langkah-langkah, berikan langkah-langkahnya saja.
7. Jangan menambahkan pertanyaan lanjutan, tawaran bantuan, atau ajakan di akhir jawaban.
8. Jika pertanyaan kurang jelas atau bermakna ganda, ajukan satu pertanyaan klarifikasi dan jangan berasumsi.
9. Gunakan bahasa Indonesia yang sederhana, jelas, dan alami.

SUMBER DATA:
- Jika ada [KONTEKS DATABASE AKTUAL], pakai hanya untuk menjawab bagian data yang ditanyakan (jumlah, status, laporan, tugas, notifikasi, atau profil pengguna yang sedang login). Jangan mengarang data di luar konteks.
- Jika ada [PROFIL PENGGUNA], tampilkan hanya data milik pengguna yang sedang login. Jangan pernah menampilkan email, id, password, token, atau Chat ID pengguna lain.
- Jika data yang ditanyakan tidak ada di konteks, katakan terus terang bahwa datanya tidak tersedia.
- Jika pertanyaan di luar topik laporan/fasilitas umum desa dan datanya tidak tersedia, jawab: "Maaf, saya tidak tahu jawabannya."
- Jangan mengklaim sebagai manusia.`;

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

  const base = `${CHATBOT_SYSTEM_PROMPT}${roleLine}`;
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
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NVIDIA_API_KEY belum diset di environment variables."
    );
  }

  const model = getChatbotModel();
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

  const res = await fetch(`${getNvidiaEndpoint()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `NVIDIA API error (${res.status}): ${text.slice(0, 500)}`
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
