/**
 * Shared UI helpers for report badges — single source of truth
 * agar warna status/prioritas konsisten di semua halaman detail & list.
 */

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  MENUNGGU_VERIFIKASI: "bg-yellow-100 text-yellow-700",
  DIPROSES_AI: "bg-blue-100 text-blue-700",
  DITERIMA: "bg-teal-100 text-teal-700",
  DITOLAK: "bg-red-100 text-red-700",
  DITUGASKAN: "bg-indigo-100 text-indigo-700",
  SEDANG_DIPERBAIKI: "bg-orange-100 text-orange-700",
  SELESAI: "bg-green-100 text-green-700",
};

export const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  RENDAH: "bg-slate-100 text-slate-600",
  SEDANG: "bg-blue-100 text-blue-600",
  TINGGI: "bg-orange-100 text-orange-600",
  KRITIS: "bg-red-100 text-red-700",
};

export function statusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "bg-slate-100 text-slate-600";
}

export function priorityBadgeClass(priority: string): string {
  return PRIORITY_BADGE_CLASSES[priority] ?? "bg-slate-100 text-slate-600";
}

export function shortId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}
