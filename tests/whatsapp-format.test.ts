import "./test-env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  formatGenericMessage,
  formatOtpMessage,
  formatReportMessage,
  reportReference,
  safeInternalPath,
  sanitizeText,
} from "@/lib/whatsapp/messages";
import {
  maskWhatsappNumber,
  normalizeWhatsappNumber,
} from "@/lib/whatsapp/config";

test("normalizeWhatsappNumber menghasilkan format internasional", () => {
  assert.equal(normalizeWhatsappNumber("0812-3456-7890"), "6281234567890");
  assert.equal(normalizeWhatsappNumber("+62 812 3456 7890"), "6281234567890");
  assert.equal(normalizeWhatsappNumber("6281234567890"), "6281234567890");
  assert.equal(normalizeWhatsappNumber("81234567890"), "6281234567890");
  assert.equal(normalizeWhatsappNumber("abc"), null);
  assert.equal(normalizeWhatsappNumber("021234"), null);
});

test("maskWhatsappNumber tidak membocorkan nomor lengkap", () => {
  const masked = maskWhatsappNumber("6281234567890");
  assert.equal(masked, "+62••••••7890");
  assert.ok(!masked.includes("81234567"));
});

test("sanitizeText membersihkan karakter kontrol", () => {
  assert.equal(sanitizeText("A\u0000B\u0007C"), "A B C");
});

test("safeInternalPath hanya menerima path internal", () => {
  assert.equal(safeInternalPath("/my-reports/abc"), "/my-reports/abc");
  assert.equal(safeInternalPath("https://evil.example"), null);
  assert.equal(safeInternalPath("//evil.example"), null);
  assert.equal(safeInternalPath(""), null);
  assert.equal(safeInternalPath(null), null);
});

test("formatReportMessage memuat data laporan dan tautan aplikasi", () => {
  const text = formatReportMessage({
    heading: "🔔 Pembaruan Laporan",
    intro: "Halo, laporan Anda berubah.",
    reportId: "clx123456789abc",
    reportTitle: `Jalan <Rusak> & "Berlubang"`,
    status: "Perlu Revisi",
    note: "Mohon tambahkan foto.",
    address: "Jl. Utama No. 1",
    eventTime: new Date("2026-10-22T03:00:00.000Z"),
    footer: "Silakan buka aplikasi.",
    linkPath: "/my-reports/clx123456789abc",
  });

  assert.match(text, /\*🔔 Pembaruan Laporan\*/);
  assert.match(text, /#789ABC/);
  assert.match(text, /Judul: Jalan <Rusak> & "Berlubang"/);
  assert.match(text, /Status: Perlu Revisi/);
  assert.match(text, /Lokasi: Jl\. Utama No\. 1/);
  assert.match(text, /Catatan: Mohon tambahkan foto\./);
  assert.match(
    text,
    /Buka detail laporan: http:\/\/localhost:3000\/my-reports\/clx123456789abc/
  );
});

test("formatReportMessage tidak menambahkan tautan berbahaya", () => {
  const text = formatReportMessage({
    heading: "Tes",
    reportId: "abcdef123456",
    reportTitle: "Judul",
    linkPath: "https://evil.example/phishing",
  });

  assert.doesNotMatch(text, /evil\.example/);
});

test("formatGenericMessage dan formatOtpMessage aman", () => {
  const text = formatGenericMessage({
    title: "Info Penting",
    message: "Pesan aman",
    linkPath: "/settings/whatsapp",
  });

  assert.match(text, /🔔 \*Info Penting\*/);
  assert.match(text, /Pesan aman/);
  assert.match(text, /settings\/whatsapp/);
  assert.equal(reportReference("abc"), "#ABC");

  const otp = formatOtpMessage("123456", 10);
  assert.match(otp, /\*123456\*/);
  assert.match(otp, /10 menit/);
});
