import "./test-env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  formatGenericMessage,
  formatReportMessage,
  reportReference,
  safeInternalPath,
} from "@/lib/telegram/messages";

test("escapeHtml mengamankan karakter khusus Telegram HTML", () => {
  assert.equal(
    escapeHtml(`<b>A & B "x" 'y'</b>`),
    "&lt;b&gt;A &amp; B &quot;x&quot; &#39;y&#39;&lt;/b&gt;"
  );
});

test("safeInternalPath hanya menerima path internal", () => {
  assert.equal(safeInternalPath("/my-reports/abc"), "/my-reports/abc");
  assert.equal(safeInternalPath("https://evil.example"), null);
  assert.equal(safeInternalPath("//evil.example"), null);
  assert.equal(safeInternalPath(""), null);
  assert.equal(safeInternalPath(null), null);
});

test("formatReportMessage memuat data laporan, meng-escape input, dan tautan aplikasi", () => {
  const text = formatReportMessage({
    heading: "🔔 Pembaruan Laporan",
    intro: "Halo, laporan Anda berubah.",
    reportId: "clx123456789abc",
    reportTitle: `Jalan <Rusak> & "Berlubang"`,
    status: "Perlu Revisi",
    note: "Mohon tambahkan foto.",
    address: "Jl. <Utama> No. 1",
    eventTime: new Date("2026-10-22T03:00:00.000Z"),
    footer: "Silakan buka aplikasi.",
    linkPath: "/my-reports/clx123456789abc",
  });

  assert.match(text, /🔔 Pembaruan Laporan/);
  assert.match(text, /#789ABC/);
  assert.match(text, /Jalan &lt;Rusak&gt; &amp; &quot;Berlubang&quot;/);
  assert.match(text, /Status: Perlu Revisi/);
  assert.match(text, /Lokasi: Jl\. &lt;Utama&gt; No\. 1/);
  assert.match(text, /Catatan: Mohon tambahkan foto\./);
  assert.match(
    text,
    /<a href="http:\/\/localhost:3000\/my-reports\/clx123456789abc">Buka detail laporan<\/a>/
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
  assert.doesNotMatch(text, /<a href=/);
});

test("formatGenericMessage adalah fallback yang aman", () => {
  const text = formatGenericMessage({
    title: "Info <Penting>",
    message: "Pesan & aman",
    linkPath: "/settings/telegram",
  });

  assert.match(text, /🔔 <b>Info &lt;Penting&gt;<\/b>/);
  assert.match(text, /Pesan &amp; aman/);
  assert.match(text, /settings\/telegram/);
  assert.equal(reportReference("abc"), "#ABC");
});
