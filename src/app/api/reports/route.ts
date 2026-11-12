import { NextRequest, NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import db from "@/lib/db";
import { CreateReportSchema } from "@/lib/validations/report";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { getAIService } from "@/lib/ai-service";
import { computeImageHash } from "@/lib/duplicate/image-hash";
import { processReportAfterSubmission } from "@/lib/report-ai-pipeline";

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

    // Hash perseptual untuk deteksi gambar duplikat (gagal = null, tidak fatal).
    const imageHash = await computeImageHash(buffer);

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

    after(async () => {
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

