/**
 * AI Analysis Service
 *
 * Menggunakan Google Gemini Vision API untuk menganalisis foto kerusakan fasilitas umum.
 * Konfigurasi (API key, base URL, model) dibaca dari pengaturan Admin di database,
 * dengan fallback ke environment variable.
 *
 * Service ini bertindak sebagai Decision Support — bukan pengambil keputusan final.
 * Jika AI gagal, laporan tetap tersimpan dan Admin tetap bisa menilai secara manual.
 */

import { readFile } from "fs/promises";
import path from "path";
import { getAiConfig } from "@/lib/ai/config";
import {
  generateGeminiContent,
  summarizeGeminiError,
} from "@/lib/ai/gemini";

export interface AIAnalysisResult {
  facility_type: string;
  damage_type: string;
  damage_level: "RINGAN" | "SEDANG" | "BERAT" | "KRITIS";
  priority: "RENDAH" | "SEDANG" | "TINGGI" | "KRITIS";
  recommendation: string;
  confidence: number;
}

// ------------------------------------
// Auto-moderation: AI verifikasi/tolak otomatis.
// Admin tetap bisa meninjau & override manual.
// ------------------------------------

export type AutoDecision = "AUTO_ACCEPTED" | "AUTO_REJECTED" | "MANUAL_REVIEW";

export interface AutoModeration {
  decision: AutoDecision;
  reason: string;
}

/** Confidence >= ini → AI berani verifikasi otomatis. */
export const AI_AUTO_ACCEPT_CONFIDENCE = 0.75;
/** Confidence <= ini → AI menolak otomatis (foto kemungkinan bukan kerusakan). */
export const AI_AUTO_REJECT_CONFIDENCE = 0.3;

export function decideAutoModeration(result: AIAnalysisResult): AutoModeration {
  const pct = Math.round(result.confidence * 100);
  if (result.confidence >= AI_AUTO_ACCEPT_CONFIDENCE) {
    return {
      decision: "AUTO_ACCEPTED",
      reason: `AI yakin ${pct}% melihat kerusakan ${result.damage_level} pada ${result.facility_type} (prioritas ${result.priority}).`,
    };
  }
  if (result.confidence <= AI_AUTO_REJECT_CONFIDENCE) {
    return {
      decision: "AUTO_REJECTED",
      reason: `Keyakinan AI rendah (${pct}%): foto kemungkinan tidak menunjukkan kerusakan fasilitas umum yang jelas.`,
    };
  }
  return {
    decision: "MANUAL_REVIEW",
    reason: `Keyakinan AI sedang (${pct}%) — perlu peninjauan manual admin.`,
  };
}

const SYSTEM_PROMPT = `Kamu adalah seorang ahli inspeksi infrastruktur dan fasilitas umum di Indonesia, khususnya di lingkungan desa/kelurahan.

Tugas kamu adalah menganalisis foto kerusakan fasilitas umum dan memberikan penilaian dalam format JSON yang ketat.

Panduan penilaian:

**Tingkat Kerusakan (damage_level):**
- RINGAN: Kerusakan estetika/kosmetik, tidak mengganggu fungsi utama. Contoh: cat mengelupas, retakan kecil.
- SEDANG: Kerusakan fungsional parsial, masih bisa digunakan dengan hati-hati. Contoh: jalan berlubang kecil, pagar bengkok.
- BERAT: Kerusakan fungsional serius, berbahaya jika digunakan. Contoh: jalan berlubang besar, jembatan retak, tiang miring.
- KRITIS: Kerusakan total/hampir total, sangat berbahaya, butuh penanganan darurat. Contoh: jembatan ambruk, bangunan roboh.

**Prioritas Penanganan (priority):**
- RENDAH: Bisa ditangani dalam jangka panjang (> 1 bulan).
- SEDANG: Perlu ditangani dalam 2-4 minggu.
- TINGGI: Perlu ditangani dalam 1-7 hari karena berdampak pada keselamatan.
- KRITIS: Perlu penanganan darurat (< 24 jam) karena mengancam jiwa.

**Jenis Fasilitas (facility_type):** Identifikasi dari foto, contoh: Jalan, Jembatan, Saluran Air, Penerangan Jalan, Taman, Bangunan Publik, Fasilitas Olahraga, dll.

**Jenis Kerusakan (damage_type):** Deskripsi singkat kerusakan spesifik yang terlihat di foto.

**Rekomendasi (recommendation):** Berikan saran penanganan yang ringkas, praktis, dan bisa ditindaklanjuti oleh petugas desa.

**Tingkat Keyakinan (confidence):** Angka desimal antara 0.0 sampai 1.0 yang menggambarkan seberapa yakin kamu terhadap analisis ini. Jika foto kurang jelas atau ambigu, turunkan confidence.

PENTING:
- Jika foto TIDAK menunjukkan kerusakan fasilitas umum (misalnya foto selfie, makanan, pemandangan biasa), tetap berikan analisis terbaik dengan confidence sangat rendah (< 0.3).
- Respons HARUS berupa JSON murni tanpa markdown code block, tanpa teks tambahan.
- Bahasa Indonesia.

Format respons JSON:
{
  "facility_type": "string",
  "damage_type": "string",
  "damage_level": "RINGAN | SEDANG | BERAT | KRITIS",
  "priority": "RENDAH | SEDANG | TINGGI | KRITIS",
  "recommendation": "string",
  "confidence": 0.0-1.0
}`;

const GEMINI_TIMEOUT_MS = 45_000;

export class AIAnalysisService {
  /**
   * Cek apakah service siap digunakan. Konfigurasi dibaca ulang setiap kali
   * dipanggil agar perubahan dari halaman Admin langsung berlaku.
   */
  async isAvailable(): Promise<boolean> {
    const config = await getAiConfig("GEMINI");
    return config.isActive && Boolean(config.apiKey);
  }

  /**
   * Menganalisis gambar kerusakan fasilitas umum.
   *
   * @param imagePath - Path absolut ke file gambar ATAU path relatif dari public/
   * @returns Hasil analisis AI atau null jika gagal
   */
  async analyzeImage(imagePath: string): Promise<AIAnalysisResult | null> {
    const config = await getAiConfig("GEMINI");
    if (!config.isActive || !config.apiKey) {
      console.warn(
        "[AIAnalysisService] Service tidak tersedia — konfigurasi Gemini belum diisi di halaman Admin."
      );
      return null;
    }

    try {
      // Resolve path: jika dimulai dengan /uploads/, tambahkan public/ di depannya
      let absolutePath = imagePath;
      if (imagePath.startsWith("/uploads/") || imagePath.startsWith("uploads/")) {
        absolutePath = path.join(process.cwd(), "public", imagePath);
      }

      // Baca file gambar
      const imageBuffer = await readFile(absolutePath);
      const base64Image = imageBuffer.toString("base64");

      // Tentukan MIME type
      const ext = path.extname(absolutePath).toLowerCase();
      let mimeType = "image/jpeg";
      if (ext === ".png") mimeType = "image/png";
      if (ext === ".webp") mimeType = "image/webp";

      // Panggil Gemini REST API langsung agar Base URL & model dari Admin
      // benar-benar dipakai. Helper menangani thinkingConfig, fallback model
      // yang sudah tidak tersedia, dan ekstraksi teks tanpa part "thought".
      const result = await generateGeminiContent({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        contents: [
          {
            role: "user",
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inlineData: {
                  mimeType,
                  data: base64Image,
                },
              },
              {
                text: "Analisis foto kerusakan fasilitas umum ini dan berikan penilaian dalam format JSON.",
              },
            ],
          },
        ],
        maxOutputTokens: 2048,
        json: true,
        timeoutMs: GEMINI_TIMEOUT_MS,
      });

      if (result.status === 0) {
        console.error("[AIAnalysisService] Gemini timeout/tidak terhubung:", result.raw);
        return null;
      }

      if (!result.ok) {
        console.error(
          `[AIAnalysisService] Gemini error (${result.status}):`,
          summarizeGeminiError(result.raw, config.apiKey, result.status)
        );
        return null;
      }

      if (result.fallbackFrom) {
        console.warn(
          `[AIAnalysisService] Model "${result.fallbackFrom}" tidak tersedia/sibuk; ` +
            `memakai fallback "${result.usedModel}".`
        );
      }

      const text = result.text;

      if (!text) {
        console.error(
          "[AIAnalysisService] Gemini tidak mengembalikan teks" +
            (result.finishReason ? ` (finishReason: ${result.finishReason}).` : ".")
        );
        return null;
      }

      // Parse JSON dari respons — bersihkan jika ada markdown code block
      const cleanedText = text
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/gi, "")
        .trim();

      const parsed: AIAnalysisResult = JSON.parse(cleanedText);

      // Validasi field yang diperlukan
      if (!parsed.facility_type || !parsed.damage_level || !parsed.priority) {
        console.error("[AIAnalysisService] Respons AI tidak lengkap:", parsed);
        return null;
      }

      // Validasi dan normalisasi enum values
      const validDamageLevels = ["RINGAN", "SEDANG", "BERAT", "KRITIS"];
      const validPriorities = ["RENDAH", "SEDANG", "TINGGI", "KRITIS"];

      if (!validDamageLevels.includes(parsed.damage_level)) {
        parsed.damage_level = "SEDANG";
      }
      if (!validPriorities.includes(parsed.priority)) {
        parsed.priority = "SEDANG";
      }

      // Clamp confidence
      parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0.5));

      console.log("[AIAnalysisService] Analisis berhasil:", {
        facility: parsed.facility_type,
        damage: parsed.damage_level,
        priority: parsed.priority,
        confidence: parsed.confidence,
      });

      return parsed;

    } catch (error) {
      console.error("[AIAnalysisService] Error saat menganalisis gambar:", error);
      return null;
    }
  }
}

// Singleton instance
let aiServiceInstance: AIAnalysisService | null = null;

export function getAIService(): AIAnalysisService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIAnalysisService();
  }
  return aiServiceInstance;
}
