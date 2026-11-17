import { getServerSession, type Session } from "next-auth";
import { authOptions } from "./auth";

/**
 * Dependency seam untuk autentikasi (Tahap A1).
 *
 * Produksi: SELALU mendelegasikan ke NextAuth (`getServerSession(authOptions)`).
 * Pengujian: session override hanya dapat diaktifkan secara in-process oleh test,
 * tidak pernah melalui HTTP/env/request, dan ditolak di luar NODE_ENV=test.
 */
let testInjectionEnabled = false;
let testSessionOverride: Session | null = null;

export async function getCurrentSession(): Promise<Session | null> {
  if (testInjectionEnabled) {
    return testSessionOverride;
  }
  return getServerSession(authOptions);
}

/**
 * Test-only: set session override. Tidak boleh dipanggil dari kode aplikasi/HTTP.
 * Menolak penggunaan di luar lingkungan test.
 */
export function __setTestSession(session: Session | null): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Test session override is only available in test environment.");
  }
  testInjectionEnabled = true;
  testSessionOverride = session;
}

/**
 * Test-only: reset override agar tidak bocor antar skenario/test.
 */
export function __resetTestSession(): void {
  testInjectionEnabled = false;
  testSessionOverride = null;
}
