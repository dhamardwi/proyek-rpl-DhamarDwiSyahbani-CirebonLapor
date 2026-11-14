import { getAppUrl } from "./config";

/**
 * WhatsApp tidak memakai HTML. Tanda bintang dipakai untuk teks tebal.
 * Nilai dinamis dibersihkan dari karakter kontrol agar pesan tetap rapi.
 */

export function sanitizeText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
}

/**
 * Nomor referensi mengikuti konvensi tampilan UI yang sudah ada:
 * enam karakter terakhir ID laporan, mis. #A1B2C3.
 */
export function reportReference(reportId: string): string {
  return `#${reportId.slice(-6).toUpperCase()}`;
}

export function formatDateTime(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

/** Hanya izinkan path internal agar tautan tidak menjadi open redirect. */
export function safeInternalPath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;
  return path;
}

export function absoluteAppLink(path: string | null | undefined): string | null {
  const safePath = safeInternalPath(path);
  if (!safePath) return null;
  return `${getAppUrl()}${safePath}`;
}

function appendLink(lines: string[], linkPath?: string, linkLabel = "Buka detail laporan") {
  const url = absoluteAppLink(linkPath);
  if (!url) return;
  lines.push("");
  lines.push(`${sanitizeText(linkLabel)}: ${url}`);
}

export interface ReportMessageInput {
  heading: string;
  intro?: string;
  reportId: string;
  reportTitle: string;
  status?: string;
  note?: string;
  address?: string;
  assignedTo?: string;
  assignedBy?: string;
  eventTime?: Date | string | null;
  footer?: string;
  linkPath?: string;
  linkLabel?: string;
}

export function formatReportMessage(input: ReportMessageInput): string {
  const lines: string[] = [`*${sanitizeText(input.heading)}*`, ""];

  if (input.intro) {
    lines.push(sanitizeText(input.intro), "");
  }

  lines.push(`Nomor Laporan: ${reportReference(input.reportId)}`);
  lines.push(`Judul: ${sanitizeText(input.reportTitle)}`);

  if (input.status) lines.push(`Status: ${sanitizeText(input.status)}`);
  if (input.address) lines.push(`Lokasi: ${sanitizeText(input.address)}`);
  if (input.assignedTo) lines.push(`Petugas: ${sanitizeText(input.assignedTo)}`);
  if (input.assignedBy) lines.push(`Ditugaskan oleh: ${sanitizeText(input.assignedBy)}`);

  const time = formatDateTime(input.eventTime);
  if (time) lines.push(`Waktu: ${time}`);

  if (input.note) {
    lines.push("");
    lines.push(`Catatan: ${sanitizeText(input.note)}`);
  }

  if (input.footer) {
    lines.push("", sanitizeText(input.footer));
  }

  appendLink(lines, input.linkPath, input.linkLabel);
  return lines.join("\n");
}

export function formatGenericMessage(params: {
  title: string;
  message: string;
  linkPath?: string;
  linkLabel?: string;
}): string {
  const lines = [`🔔 *${sanitizeText(params.title)}*`, "", sanitizeText(params.message)];
  appendLink(lines, params.linkPath, params.linkLabel);
  return lines.join("\n");
}

/** Pesan OTP singkat. Tidak pernah disimpan ke outbox atau log. */
export function formatOtpMessage(otp: string, ttlMinutes: number): string {
  return [
    "*CirebonLapor - Verifikasi WhatsApp*",
    "",
    `Kode OTP Anda: *${otp}*`,
    "",
    `Kode berlaku ${ttlMinutes} menit dan hanya dapat digunakan satu kali.`,
    "Jangan bagikan kode ini kepada siapa pun.",
  ].join("\n");
}
