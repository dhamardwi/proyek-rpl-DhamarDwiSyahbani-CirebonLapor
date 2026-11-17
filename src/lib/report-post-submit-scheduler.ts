import { after } from "next/server";

/**
 * Dependency seam untuk penjadwalan pasca-submit laporan (Tahap R2.1).
 *
 * Produksi: SELALU mendelegasikan ke Next.js `after()` sehingga callback
 * berjalan dalam lifecycle request yang benar (non-blocking setelah response).
 * Pengujian: scheduler override hanya dapat diaktifkan secara in-process oleh
 * test (bukan via HTTP/env/request), ditolak di luar NODE_ENV=test, dan harus
 * di-reset agar tidak bocor antar skenario. Tidak ada override otomatis.
 */

export type ReportPostSubmitTask = () => void | Promise<void>;
export type ReportPostSubmitScheduler = (task: ReportPostSubmitTask) => void;

const defaultScheduler: ReportPostSubmitScheduler = (task) => {
  after(task);
};

let testInjectionEnabled = false;
let testSchedulerOverride: ReportPostSubmitScheduler | null = null;

/**
 * Jadwalkan tugas pasca-submit. Default (produksi & tanpa override) memanggil
 * `after()` asli Next.js. Callback/payload ditentukan pemanggil (route).
 */
export function scheduleReportPostSubmit(task: ReportPostSubmitTask): void {
  if (testInjectionEnabled && testSchedulerOverride) {
    testSchedulerOverride(task);
    return;
  }
  defaultScheduler(task);
}

/**
 * Test-only: ganti scheduler. Hanya di NODE_ENV=test (in-process), tidak dapat
 * dipicu via HTTP. Gunakan untuk no-op agar callback tidak dijalankan saat
 * direct-handler test.
 */
export function __setReportPostSubmitScheduler(
  scheduler: ReportPostSubmitScheduler
): void {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "Report post-submit scheduler override is only available in test environment."
    );
  }
  testInjectionEnabled = true;
  testSchedulerOverride = scheduler;
}

/**
 * Test-only: reset override agar kembali ke scheduler default (`after()` asli).
 */
export function __resetReportPostSubmitScheduler(): void {
  testInjectionEnabled = false;
  testSchedulerOverride = null;
}
