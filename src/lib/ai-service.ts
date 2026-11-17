/**
 * AI Analysis Service (dinonaktifkan).
 *
 * Fitur analisis foto kerusakan berbasis AI eksternal telah dihapus.
 * Service ini tetap ada sebagai stub agar pipeline laporan dan tipe terkait
 * tetap kompatibel; analisis AI tidak dijalankan dan laporan akan masuk ke
 * alur verifikasi manual.
 */

export interface AIAnalysisResult {
  facility_type: string;
  damage_type: string;
  damage_level: "RINGAN" | "SEDANG" | "BERAT" | "KRITIS";
  priority: "RENDAH" | "SEDANG" | "TINGGI" | "KRITIS";
  recommendation: string;
  confidence: number;
}

export type AutoDecision = "AUTO_ACCEPTED" | "AUTO_REJECTED" | "MANUAL_REVIEW";

export interface AutoModeration {
  decision: AutoDecision;
  reason: string;
}

/** Dipertahankan untuk kompatibilitas; tidak digunakan tanpa analisis AI. */
export const AI_AUTO_ACCEPT_CONFIDENCE = 0.75;
/** Dipertahankan untuk kompatibilitas; tidak digunakan tanpa analisis AI. */
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

export class AIAnalysisService {
  /** Analisis foto AI dinonaktifkan. */
  async isAvailable(): Promise<boolean> {
    return false;
  }

  /** Analisis foto AI dinonaktifkan; selalu mengembalikan null. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- parameter dummy, AI dinonaktifkan
  async analyzeImage(_imagePath: string): Promise<AIAnalysisResult | null> {
    return null;
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
