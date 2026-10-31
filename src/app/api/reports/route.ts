import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { CreateReportSchema } from "@/lib/validations/report";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getAIService, decideAutoModeration, type AutoDecision } from "@/lib/ai-service";
import { notifyReportCreated } from "@/lib/report-notification-service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    
    // Parse fields
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const facilityTypeId = formData.get("facilityTypeId") as string;
    const address = formData.get("address") as string;
    const latitude = formData.get("latitude") ? parseFloat(formData.get("latitude") as string) : null;
    const longitude = formData.get("longitude") ? parseFloat(formData.get("longitude") as string) : null;
    
    const file = formData.get("image") as File;

    // Validate payload texts
    const parsed = CreateReportSchema.safeParse({
      title, description, facilityTypeId, address, latitude, longitude
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validasi gagal", errors: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // Validate Image
    if (!file || (typeof (file as unknown) === "string")) {
      return NextResponse.json({ success: false, message: "Foto kerusakan wajib diunggah" }, { status: 422 });
    }

    const validTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, message: "Format foto harus JPG atau PNG" }, { status: 422 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "Ukuran foto maksimal 5MB" }, { status: 422 });
    }

    // Save image to public/uploads/reports
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create unique filename
    const ext = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
    
    const uploadDir = path.join(process.cwd(), "public", "uploads", "reports");
    
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch {
      console.log("Directory exists or error creating directory");
    }
    
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const relativeImageUrl = `/uploads/reports/${fileName}`;

    // Database Transaction to save Report, ReportImage, and ReportStatusHistory
    const report = await db.$transaction(async (tx) => {
      // 1. Create Report
      const newReport = await tx.report.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          facilityTypeId: parsed.data.facilityTypeId,
          address: parsed.data.address,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          userId: session.user.id,
          status: "MENUNGGU_VERIFIKASI"
        }
      });

      // 2. Create Image
      await tx.reportImage.create({
        data: {
          reportId: newReport.id,
          imagePath: relativeImageUrl,
          imageType: "KERUSAKAN"
        }
      });

      // 3. Create Status History
      await tx.reportStatusHistory.create({
        data: {
          reportId: newReport.id,
          status: "MENUNGGU_VERIFIKASI",
          note: "Laporan baru dibuat oleh masyarakat",
          updatedById: session.user.id
        }
      });

      return newReport;
    });

    // ====================================================================
    // AI OTOMATIS (non-blocking: jika gagal, laporan tetap tersimpan
    // dan menunggu verifikasi manual admin)
    // - confidence tinggi → AI verifikasi otomatis (DITERIMA)
    // - confidence rendah → AI tolak otomatis (DITOLAK)
    // - di antaranya → MENUNGGU_VERIFIKASI untuk admin manual
    // ====================================================================
    let aiResult = null;
    let autoDecision: AutoDecision = "MANUAL_REVIEW";
    let autoReason = "";
    const aiService = getAIService();

    if (aiService.isAvailable()) {
      try {
        await db.report.update({
          where: { id: report.id },
          data: { status: "DIPROSES_AI" },
        });
        await db.reportStatusHistory.create({
          data: {
            reportId: report.id,
            status: "DIPROSES_AI",
            note: "Laporan sedang dianalisis otomatis oleh AI",
            updatedById: session.user.id,
          },
        });

        console.log("[AI] Memulai analisis gambar untuk laporan:", report.id);
        aiResult = await aiService.analyzeImage(relativeImageUrl);

        if (aiResult) {
          const moderation = decideAutoModeration(aiResult);
          autoDecision = moderation.decision;
          autoReason = moderation.reason;

          const finalStatus =
            autoDecision === "AUTO_ACCEPTED"
              ? "DITERIMA"
              : autoDecision === "AUTO_REJECTED"
                ? "DITOLAK"
                : "MENUNGGU_VERIFIKASI";

          await db.report.update({
            where: { id: report.id },
            data: {
              aiAnalysis: JSON.stringify({ ...aiResult, autoDecision, autoReason }),
              damageType: aiResult.damage_type,
              damageLevel: aiResult.damage_level,
              priority: aiResult.priority,
              status: finalStatus,
            },
          });

          const historyNote =
            autoDecision === "AUTO_ACCEPTED"
              ? `Diverifikasi otomatis oleh AI. ${autoReason} Admin dapat meninjau/override manual.`
              : autoDecision === "AUTO_REJECTED"
                ? `Ditolak otomatis oleh AI. ${autoReason} Admin dapat meninjau/override manual.`
                : `Analisis AI selesai (${Math.round(aiResult.confidence * 100)}%). ${autoReason}`;

          await db.reportStatusHistory.create({
            data: {
              reportId: report.id,
              status: finalStatus,
              note: historyNote,
              updatedById: session.user.id,
            },
          });

          console.log("[AI] Keputusan otomatis untuk laporan:", report.id, autoDecision);
        } else {
          console.warn("[AI] Analisis mengembalikan null untuk laporan:", report.id);
          await db.report.update({
            where: { id: report.id },
            data: { status: "MENUNGGU_VERIFIKASI" },
          });
        }
      } catch (aiError) {
        // AI gagal — kembalikan ke antrean manual agar tidak macet di DIPROSES_AI
        console.error("[AI] Error saat menganalisis, laporan tetap tersimpan:", aiError);
        await db.report.update({
          where: { id: report.id },
          data: { status: "MENUNGGU_VERIFIKASI" },
        }).catch(() => {});
      }
    } else {
      console.log("[AI] AI Service tidak tersedia (API key belum diset). Laporan tersimpan tanpa analisis AI.");
    }

    // ====================================================================
    // NOTIFIKASI (fail-open: kegagalan notif tidak menggagalkan laporan)
    // 1. Masyarakat pelapor → "laporan sudah dibuat" (+ hasil AI bila ada)
    // 2. Semua admin aktif → "laporan masuk dari masyarakat"
    // 3. Semua petugas aktif → bila laporan terverifikasi (manual/AI)
    // ====================================================================
    await notifyReportCreated({
      report: {
        id: report.id,
        title: report.title,
        createdAt: report.createdAt,
      },
      reporterId: session.user.id,
      reporterName: session.user.name ?? "Masyarakat",
      autoDecision,
    });

    const responseMessage =
      autoDecision === "AUTO_ACCEPTED"
        ? "Laporan berhasil dikirim dan terverifikasi otomatis oleh AI!"
        : autoDecision === "AUTO_REJECTED"
          ? "Laporan diterima tetapi ditolak otomatis oleh AI (foto tidak jelas). Admin dapat meninjau ulang."
          : "Laporan berhasil dikirim!";

    return NextResponse.json(
      {
        success: true,
        message: responseMessage,
        data: report,
        aiAnalyzed: aiResult !== null,
        autoDecision,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("[CREATE_REPORT_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "Terjadi kesalahan server saat menyimpan laporan." },
      { status: 500 }
    );
  }
}

