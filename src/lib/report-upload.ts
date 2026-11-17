import path from "path";
import {
  ACCEPTED_REPORT_IMAGE_TYPES,
  MAX_REPORT_IMAGE_SIZE,
} from "@/lib/validations/report";

/**
 * Helper murni untuk input & upload gambar laporan (Tahap C3).
 *
 * Tidak melakukan I/O: hanya parsing field, validasi tipe/ukuran, dan
 * pembentukan nama/path. Urutan pemanggilan serta efek samping (mkdir,
 * writeFile, hashing, transaksi) tetap dikendalikan route handler.
 */

export const REPORT_UPLOAD_DIR = path.join(
  process.cwd(),
  "public",
  "uploads",
  "reports"
);

export interface ReportFormFields {
  title: string;
  description: string;
  facilityTypeId: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  file: File;
}

/** Pars field multipart dengan ekspresi yang sama persis seperti sebelumnya. */
export function parseReportFormFields(formData: FormData): ReportFormFields {
  return {
    title: formData.get("title") as string,
    description: formData.get("description") as string,
    facilityTypeId: formData.get("facilityTypeId") as string,
    address: formData.get("address") as string,
    latitude: formData.get("latitude")
      ? parseFloat(formData.get("latitude") as string)
      : null,
    longitude: formData.get("longitude")
      ? parseFloat(formData.get("longitude") as string)
      : null,
    file: formData.get("image") as File,
  };
}

export function isAcceptedReportImageType(file: File): boolean {
  return (ACCEPTED_REPORT_IMAGE_TYPES as readonly string[]).includes(file.type);
}

export function isOversizedReportImage(file: File): boolean {
  return file.size > MAX_REPORT_IMAGE_SIZE;
}

export function buildReportImageFileName(file: File, prefix = ""): string {
  const ext = file.name.split(".").pop();
  return `${prefix}${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
}

export function buildReportImagePaths(fileName: string): {
  filePath: string;
  relativeImageUrl: string;
} {
  return {
    filePath: path.join(REPORT_UPLOAD_DIR, fileName),
    relativeImageUrl: `/uploads/reports/${fileName}`,
  };
}
