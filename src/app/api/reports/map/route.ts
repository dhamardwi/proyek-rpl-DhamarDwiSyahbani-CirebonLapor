import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { Prisma } from "@prisma/client";
import { REPORT_STATUS, PRIORITY, DAMAGE_LEVEL } from "@/lib/constants";

const VALID_STATUSES = new Set(Object.values(REPORT_STATUS));
const VALID_PRIORITIES = new Set(Object.values(PRIORITY));
const VALID_DAMAGE_LEVELS = new Set(Object.values(DAMAGE_LEVEL));

const MAX_MAP_POINTS = 500;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const facilityTypeId = searchParams.get("facilityTypeId");
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const damageLevel = searchParams.get("damageLevel");

    const where: Prisma.ReportWhereInput = {
      // Hanya ambil laporan yang memiliki koordinat
      latitude: { not: null },
      longitude: { not: null },
    };

    if (facilityTypeId) where.facilityTypeId = facilityTypeId;
    if (status && VALID_STATUSES.has(status as (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS])) {
      where.status = status;
    }
    if (priority && VALID_PRIORITIES.has(priority as (typeof PRIORITY)[keyof typeof PRIORITY])) {
      where.priority = priority;
    }
    if (damageLevel && VALID_DAMAGE_LEVELS.has(damageLevel as (typeof DAMAGE_LEVEL)[keyof typeof DAMAGE_LEVEL])) {
      where.damageLevel = damageLevel;
    }

    // Ambil data laporan (dibatasi agar peta tetap cepat).
    // PENTING: Jangan sertakan relasi user (pelapor) untuk menjaga privasi masyarakat.
    const reports = await db.report.findMany({
      where,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        damageLevel: true,
        latitude: true,
        longitude: true,
        facilityType: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_MAP_POINTS,
    });

    return NextResponse.json({ success: true, data: reports });
  } catch (error) {
    console.error("[MAP_REPORTS_ERROR]", error);
    return NextResponse.json({ success: false, message: "Gagal mengambil data peta" }, { status: 500 });
  }
}
