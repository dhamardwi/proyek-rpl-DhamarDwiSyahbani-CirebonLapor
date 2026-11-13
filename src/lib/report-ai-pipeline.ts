/**
 * Pipeline pasca-pengiriman laporan.
 *
 * Dijalankan lewat `after()` pada route POST /api/reports sehingga pemrosesan
 * pasca-laporan tidak menahan response ke masyarakat. Semua kegagalan bersifat
 * fail-open: laporan tetap tersimpan dan masuk antrean verifikasi manual.
 */

import db from "@/lib/db";
import { getAIService, decideAutoModeration, type AutoDecision } from "@/lib/ai-service";
import { notifyReportCreated } from "@/lib/report-notification-service";
import { checkDuplicateReport, persistDuplicateResult } from "@/lib/duplicate/service";

export interface ReportProcessingInput {
  reportId: string;
  userId: string;
  reporterName: string;
  reportCreatedAt: Date;
  imageUrl: string;
  imageHash: string | null;
  title: string;
  description?: string | null;
  facilityTypeId: string;
  latitude?: number | null;
  longitude?: number | null;
}

async function analyzeImageAndModerate(
  input: ReportProcessingInput
): Promise<AutoDecision> {
  const aiService = getAIService();
  if (!(await aiService.isAvailable())) {
    console.log(
      "[AI] Analisis foto AI tidak aktif. Laporan tetap menunggu verifikasi manual."
    );
    return "MANUAL_REVIEW";
  }

  try {
    await db.report.update({
      where: { id: input.reportId },
      data: { status: "DIPROSES_AI" },
    });
    await db.reportStatusHistory.create({
      data: {
        reportId: input.reportId,
        status: "DIPROSES_AI",
        note: "Laporan sedang dianalisis otomatis oleh AI",
        updatedById: input.userId,
      },
    });

    console.log("[AI] Memulai analisis gambar untuk laporan:", input.reportId);
    const aiResult = await aiService.analyzeImage(input.imageUrl);

    if (!aiResult) {
      console.warn("[AI] Analisis mengembalikan null untuk laporan:", input.reportId);
      await db.report.update({
        where: { id: input.reportId },
        data: { status: "MENUNGGU_VERIFIKASI" },
      });
      return "MANUAL_REVIEW";
    }

    const moderation = decideAutoModeration(aiResult);
    const finalStatus =
      moderation.decision === "AUTO_ACCEPTED"
        ? "DITERIMA"
        : moderation.decision === "AUTO_REJECTED"
          ? "DITOLAK"
          : "MENUNGGU_VERIFIKASI";

    await db.report.update({
      where: { id: input.reportId },
      data: {
        aiAnalysis: JSON.stringify({ ...aiResult, ...moderation }),
        damageType: aiResult.damage_type,
        damageLevel: aiResult.damage_level,
        priority: aiResult.priority,
        status: finalStatus,
      },
    });

    const historyNote =
      moderation.decision === "AUTO_ACCEPTED"
        ? `Diverifikasi otomatis oleh AI. ${moderation.reason} Admin dapat meninjau/override manual.`
        : moderation.decision === "AUTO_REJECTED"
          ? `Ditolak otomatis oleh AI. ${moderation.reason} Admin dapat meninjau/override manual.`
          : `Analisis AI selesai (${Math.round(aiResult.confidence * 100)}%). ${moderation.reason}`;

    await db.reportStatusHistory.create({
      data: {
        reportId: input.reportId,
        status: finalStatus,
        note: historyNote,
        updatedById: input.userId,
      },
    });

    console.log(
      "[AI] Keputusan otomatis untuk laporan:",
      input.reportId,
      moderation.decision
    );
    return moderation.decision;
  } catch (error) {
    console.error(
      "[AI] Error saat menganalisis, laporan tetap tersimpan:",
      error instanceof Error ? error.message : "unknown"
    );
    await db.report
      .update({
        where: { id: input.reportId },
        data: { status: "MENUNGGU_VERIFIKASI" },
      })
      .catch(() => {});
    return "MANUAL_REVIEW";
  }
}

async function detectDuplicate(input: ReportProcessingInput): Promise<void> {
  try {
    const result = await checkDuplicateReport({
      reportId: input.reportId,
      title: input.title,
      description: input.description,
      facilityTypeId: input.facilityTypeId,
      latitude: input.latitude,
      longitude: input.longitude,
      imageHash: input.imageHash,
    });

    await persistDuplicateResult(input.reportId, result);

    if (result.isDuplicate) {
      console.log(
        "[DUPLICATE] Laporan",
        input.reportId,
        "kemungkinan duplikat dari",
        result.reportId,
        `(${result.method}, skor ${Math.round(result.score * 100)}%)`
      );
    }
  } catch (error) {
    console.error(
      "[DUPLICATE] Gagal memeriksa duplikat:",
      error instanceof Error ? error.message : "unknown"
    );
  }
}

async function notifyCreated(
  input: ReportProcessingInput,
  decision: AutoDecision
): Promise<void> {
  try {
    await notifyReportCreated({
      report: {
        id: input.reportId,
        title: input.title,
        createdAt: input.reportCreatedAt,
      },
      reporterId: input.userId,
      reporterName: input.reporterName,
      autoDecision: decision,
    });
  } catch (error) {
    console.error(
      "[NOTIF] Gagal mengirim notifikasi laporan baru:",
      error instanceof Error ? error.message : "unknown"
    );
  }
}

/** Jalankan seluruh proses pasca-pengiriman. Tidak pernah melempar error. */
export async function processReportAfterSubmission(
  input: ReportProcessingInput
): Promise<void> {
  const decision = await analyzeImageAndModerate(input);
  // Notifikasi dikirim setelah keputusan AI agar petugas ikut diberi tahu
  // ketika laporan otomatis diterima. Tetap fail-open.
  await notifyCreated(input, decision);
  await detectDuplicate(input);
}
