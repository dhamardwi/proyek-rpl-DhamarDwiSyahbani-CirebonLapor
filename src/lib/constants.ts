/**
 * Application-wide constants for enum values.
 * These mirror the database string values defined in schema.prisma.
 */

// ------------------------------------
// User Roles
// ------------------------------------
export const ROLE = {
  MASYARAKAT: "MASYARAKAT",
  PETUGAS: "PETUGAS",
  ADMIN: "ADMIN",
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

// ------------------------------------
// Report Status
// ------------------------------------
export const REPORT_STATUS = {
  MENUNGGU_VERIFIKASI: "MENUNGGU_VERIFIKASI",
  DIPROSES_AI: "DIPROSES_AI",
  DITERIMA: "DITERIMA",
  DITOLAK: "DITOLAK",
  DITUGASKAN: "DITUGASKAN",
  SEDANG_DIPERBAIKI: "SEDANG_DIPERBAIKI",
  SELESAI: "SELESAI",
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  MENUNGGU_VERIFIKASI: "Menunggu Verifikasi",
  DIPROSES_AI: "Diproses AI",
  DITERIMA: "Diterima",
  DITOLAK: "Ditolak",
  DITUGASKAN: "Ditugaskan",
  SEDANG_DIPERBAIKI: "Sedang Diperbaiki",
  SELESAI: "Selesai",
};

// Status flow: hanya transisi ini yang valid
export const VALID_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  MENUNGGU_VERIFIKASI: ["DIPROSES_AI", "DITOLAK"],
  DIPROSES_AI: ["DITERIMA", "DITOLAK"],
  DITERIMA: ["DITUGASKAN", "DITOLAK"],
  DITOLAK: [],
  DITUGASKAN: ["SEDANG_DIPERBAIKI"],
  SEDANG_DIPERBAIKI: ["SELESAI"],
  SELESAI: [],
};

// ------------------------------------
// Damage Level
// ------------------------------------
export const DAMAGE_LEVEL = {
  UNKNOWN: "UNKNOWN",
  RINGAN: "RINGAN",
  SEDANG: "SEDANG",
  BERAT: "BERAT",
  KRITIS: "KRITIS",
} as const;

export type DamageLevel = (typeof DAMAGE_LEVEL)[keyof typeof DAMAGE_LEVEL];

export const DAMAGE_LEVEL_LABELS: Record<DamageLevel, string> = {
  UNKNOWN: "Belum Dianalisis",
  RINGAN: "Ringan",
  SEDANG: "Sedang",
  BERAT: "Berat",
  KRITIS: "Kritis",
};

// ------------------------------------
// Priority
// ------------------------------------
export const PRIORITY = {
  RENDAH: "RENDAH",
  SEDANG: "SEDANG",
  TINGGI: "TINGGI",
  KRITIS: "KRITIS",
} as const;

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export const PRIORITY_LABELS: Record<Priority, string> = {
  RENDAH: "Rendah",
  SEDANG: "Sedang",
  TINGGI: "Tinggi",
  KRITIS: "Kritis",
};

// ------------------------------------
// Image Type
// ------------------------------------
export const IMAGE_TYPE = {
  KERUSAKAN: "KERUSAKAN",
  BUKTI_PERBAIKAN: "BUKTI_PERBAIKAN",
} as const;

export type ImageType = (typeof IMAGE_TYPE)[keyof typeof IMAGE_TYPE];
