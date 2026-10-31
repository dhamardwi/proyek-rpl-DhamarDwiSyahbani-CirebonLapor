import { getAppUrl } from "./config";

/**
 * Telegram memakai parse mode HTML, sehingga semua nilai dinamis wajib
 * di-escape agar tidak merusak format atau menyisipkan markup.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  lines.push(`<a href="${escapeHtml(url)}">${escapeHtml(linkLabel)}</a>`);
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
  const lines: string[] = [`<b>${escapeHtml(input.heading)}</b>`, ""];

  if (input.intro) {
    lines.push(escapeHtml(input.intro), "");
  }

  lines.push(`Nomor Laporan: <code>${escapeHtml(reportReference(input.reportId))}</code>`);
  lines.push(`Judul: ${escapeHtml(input.reportTitle)}`);

  if (input.status) lines.push(`Status: ${escapeHtml(input.status)}`);
  if (input.address) lines.push(`Lokasi: ${escapeHtml(input.address)}`);
  if (input.assignedTo) lines.push(`Petugas: ${escapeHtml(input.assignedTo)}`);
  if (input.assignedBy) lines.push(`Ditugaskan oleh: ${escapeHtml(input.assignedBy)}`);

  const time = formatDateTime(input.eventTime);
  if (time) lines.push(`Waktu: ${escapeHtml(time)}`);

  if (input.note) {
    lines.push("");
    lines.push(`Catatan: ${escapeHtml(input.note)}`);
  }

  if (input.footer) {
    lines.push("", escapeHtml(input.footer));
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
  const lines = [`🔔 <b>${escapeHtml(params.title)}</b>`, "", escapeHtml(params.message)];
  appendLink(lines, params.linkPath, params.linkLabel);
  return lines.join("\n");
}
