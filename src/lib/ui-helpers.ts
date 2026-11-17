/**
 * Helper UI murni (Tahap C7). Tidak mengakses DB/network/FS dan tidak
 * mengubah nilai keluaran dibanding pola inline sebelumnya.
 */

/**
 * Ambil pesan error dari response JSON dengan fallback.
 * Mempertahankan persis semantika `data.message || fallback`
 * (termasuk string kosong → fallback).
 */
export function getErrorMessage(data: unknown, fallback: string): string {
  const message =
    data && typeof data === "object" && "message" in data
      ? (data as { message?: unknown }).message
      : undefined;
  return (message || fallback) as string;
}

/**
 * Hitung rentang tampilan pagination dan total halaman.
 * Rumus identik dengan ekspresi inline pada halaman users & admin reports.
 */
export function getPaginationRange(
  page: number,
  pageSize: number,
  total: number
): { totalPages: number; start: number; end: number } {
  return {
    totalPages: Math.ceil(total / pageSize),
    start: (page - 1) * pageSize + 1 || 0,
    end: Math.min(page * pageSize, total),
  };
}
