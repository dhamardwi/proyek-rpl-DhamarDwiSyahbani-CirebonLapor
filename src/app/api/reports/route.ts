import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth-session";
import db from "@/lib/db";
import { CreateReportSchema } from "@/lib/validations/report";
import { writeFile, mkdir } from "fs/promises";
import { getAIService } from "@/lib/ai-service";
import {
  REPORT_UPLOAD_DIR,
  buildReportImageFileName,
  buildReportImagePaths,
  isAcceptedReportImageType,
  isOversizedReportImage,
  parseReportFormFields,
} from "@/lib/report-upload";
import { computeImageHash } from "@/lib/duplicate/image-hash";
import { processReportAfterSubmission } from "@/lib/report-ai-pipeline";
import { scheduleReportPostSubmit } from "@/lib/report-post-submit-scheduler";

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session?.user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "MASYARAKAT") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    
    // Parse fields
    const fields = parseReportFormFields(formData);
    const file = fields.file;

    // Validate payload texts
    const parsed = CreateReportSchema.safeParse({
      title: fields.title,
      description: fields.description,
      facilityTypeId: fields.facilityTypeId,
      address: fields.address,
      latitude: fields.latitude,
      longitude: fields.longitude,
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

    if (!isAcceptedReportImageType(file)) {
      return NextResponse.json({ success: false, message: "Format foto harus JPG atau PNG" }, { status: 422 });
    }

    if (isOversizedReportImage(file)) {
      return NextResponse.json({ success: false, message: "Ukuran foto maksimal 5MB" }, { status: 422 });
    }

    // Save image to public/uploads/reports
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Create unique filename
    const fileName = buildReportImageFileName(file);
    const { filePath, relativeImageUrl } = buildReportImagePaths(fileName);
    
    try {
      await mkdir(REPORT_UPLOAD_DIR, { recursive: true });
    } catch {
      console.log("Directory exists or error creating directory");
    }
    
    await writeFile(filePath, buffer);

    // Hash perseptual untuk deteksi gambar duplikat (gagal = null, tidak fatal).
    const imageHash = await computeImageHash(buffer);

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
          imageType: "KERUSAKAN",
          imageHash,
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
    // PROSES AI & DUPLIKAT (non-blocking)
    // Dijadwalkan lewat `after()` agar masyarakat tidak menunggu Gemini.
    // Kegagalan AI tidak pernah menggagalkan pengiriman laporan.
    // ====================================================================
    const aiService = getAIService();
    const aiQueued = await aiService.isAvailable();

    scheduleReportPostSubmit(async () => {
      await processReportAfterSubmission({
        reportId: report.id,
        userId: session.user.id,
        reporterName: session.user.name ?? "Masyarakat",
        reportCreatedAt: report.createdAt,
        imageUrl: relativeImageUrl,
        imageHash,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        facilityTypeId: parsed.data.facilityTypeId,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
      });
    });

    if (!aiQueued) {
      console.log(
        "[AI] Gemini belum dikonfigurasi. Pemeriksaan duplikat lokal tetap dijalankan."
      );
    }

    // Notifikasi & analisis AI dijalankan setelah response (lihat pipeline),
    // sehingga pengiriman laporan tidak pernah tertahan oleh provider AI.
    return NextResponse.json(
      {
        success: true,
        message: "Laporan berhasil dikirim!",
        data: report,
        aiQueued,
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

