import { NextResponse } from "next/server";

/**
 * Helper respons API dengan header `Cache-Control: no-store`.
 *
 * Output identik dengan pola `noStore` lokal yang sebelumnya di-copy-paste
 * pada 7 route (settings/ai/*, settings/whatsapp/*, admin/whatsapp/*).
 */
export function noStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Klasifikasi pesan error validasi.
 *
 * Logika identik dengan pemeriksaan `message.includes(...)` yang sebelumnya
 * ada inline di PATCH /api/admin/reports/[id]. Tidak mengubah status code
 * yang dihasilkan (422 untuk validasi, 500 untuk error server).
 */
export function isValidationError(message: string): boolean {
  return (
    message.includes("tidak valid") ||
    message.includes("tidak bisa") ||
    message.includes("Hanya") ||
    message.includes("harus") ||
    message.includes("nonaktif")
  );
}
