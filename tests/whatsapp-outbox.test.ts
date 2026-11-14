import "./test-env";
import test, { beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import db from "@/lib/db";
import { createNotification } from "@/lib/notification-service";
import {
  enqueueWhatsappForUser,
  processWhatsappOutbox,
  WHATSAPP_MAX_ATTEMPTS,
} from "@/lib/whatsapp/outbox";
import { createTestUser, resetDatabase } from "./helpers";

interface FetchCall {
  url: string;
  authorization: string | null;
  body: { target: string; message: string };
}

let fetchCalls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

function mockFonnteFetch(result: "ok" | "fail") {
  fetchCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const body = new URLSearchParams(String(init?.body ?? ""));
    fetchCalls.push({
      url: String(input),
      authorization: headers.get("Authorization"),
      body: {
        target: body.get("target") ?? "",
        message: body.get("message") ?? "",
      },
    });

    if (result === "ok") {
      return new Response(JSON.stringify({ status: true, id: ["msg-1"] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ status: false, reason: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;
}

async function createLinkedUser(phoneNumber = "6281234567890") {
  const user = await createTestUser("MASYARAKAT", "Warga Uji");
  await db.whatsappLink.create({
    data: { userId: user.id, phoneNumber },
  });
  return user;
}

beforeEach(async () => {
  await resetDatabase();
  mockFonnteFetch("ok");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

after(async () => {
  await db.$disconnect();
});

test("mengirim notifikasi WhatsApp sekali, idempoten, dan tidak membocorkan token ke body", async () => {
  const user = await createLinkedUser();

  await createNotification({
    userId: user.id,
    title: "Tugas Baru",
    message: "Anda mendapat tugas baru.",
    link: "/tasks/abc",
    dedupeKey: "report-assigned:abc",
    whatsapp: { text: "*Tugas Baru*" },
  });

  assert.equal(await db.notification.count(), 1);
  assert.equal(await db.whatsappOutbox.count(), 1);

  const first = await processWhatsappOutbox();
  assert.deepEqual(first, { sent: 1, failed: 0, retried: 0 });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "https://api.fonnte.com/send");
  assert.equal(fetchCalls[0].body.target, "6281234567890");
  assert.equal(fetchCalls[0].body.message, "*Tugas Baru*");
  assert.equal(fetchCalls[0].authorization, "test-fonnte-token");
  assert.ok(!fetchCalls[0].body.message.includes("test-fonnte-token"));

  // Event yang sama diproses ulang tidak boleh membuat notifikasi/pesan ganda.
  await createNotification({
    userId: user.id,
    title: "Tugas Baru",
    message: "Anda mendapat tugas baru.",
    link: "/tasks/abc",
    dedupeKey: "report-assigned:abc",
    whatsapp: { text: "*Tugas Baru*" },
  });

  assert.equal(await db.notification.count(), 1);
  assert.equal(await db.whatsappOutbox.count(), 1);

  const second = await processWhatsappOutbox();
  assert.deepEqual(second, { sent: 0, failed: 0, retried: 0 });
  assert.equal(fetchCalls.length, 1);

  const outbox = await db.whatsappOutbox.findFirst();
  assert.equal(outbox?.status, "SENT");
});

test("akun tanpa WhatsApp tetap mendapat notifikasi in-app", async () => {
  const user = await createTestUser();

  await createNotification({
    userId: user.id,
    title: "Info",
    message: "Notifikasi in-app saja.",
    dedupeKey: "event-no-whatsapp",
  });

  assert.equal(await db.notification.count(), 1);
  assert.equal(await db.whatsappOutbox.count(), 0);
});

test("kegagalan Fonnte tidak membatalkan data dan dapat di-retry", async () => {
  const user = await createLinkedUser("628222333444");
  mockFonnteFetch("fail");

  await createNotification({
    userId: user.id,
    title: "Laporan Selesai",
    message: "Laporan selesai.",
    dedupeKey: "event-retry",
    whatsapp: { text: "*Selesai*" },
  });

  const first = await processWhatsappOutbox();
  assert.deepEqual(first, { sent: 0, failed: 0, retried: 1 });

  let outbox = await db.whatsappOutbox.findFirst();
  assert.equal(outbox?.status, "PENDING");
  assert.equal(outbox?.attempts, 1);
  assert.equal(outbox?.lastError, "Internal Server Error");

  assert.equal(await db.notification.count(), 1);

  await db.whatsappOutbox.update({
    where: { id: outbox!.id },
    data: { nextAttemptAt: new Date(Date.now() - 1000) },
  });

  mockFonnteFetch("ok");
  const second = await processWhatsappOutbox();
  assert.deepEqual(second, { sent: 1, failed: 0, retried: 0 });
  assert.equal(fetchCalls.length, 1);

  outbox = await db.whatsappOutbox.findFirst();
  assert.equal(outbox?.status, "SENT");
  assert.equal(outbox?.attempts, 1);
});

test("berhenti setelah batas percobaan retry tercapai", async () => {
  const user = await createLinkedUser("628555666777");
  mockFonnteFetch("fail");

  await createNotification({
    userId: user.id,
    title: "Gagal",
    message: "Pesan gagal.",
    dedupeKey: "event-max-attempts",
    whatsapp: { text: "*Gagal*" },
  });

  for (let attempt = 1; attempt <= WHATSAPP_MAX_ATTEMPTS; attempt += 1) {
    const result = await processWhatsappOutbox();
    assert.equal(result.sent, 0);

    const outbox = await db.whatsappOutbox.findFirst();
    if (attempt < WHATSAPP_MAX_ATTEMPTS) {
      assert.equal(outbox?.status, "PENDING");
      await db.whatsappOutbox.update({
        where: { id: outbox!.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });
    }
  }

  const outbox = await db.whatsappOutbox.findFirst();
  assert.equal(outbox?.status, "FAILED");
  assert.equal(outbox?.attempts, WHATSAPP_MAX_ATTEMPTS);
  assert.equal(fetchCalls.length, WHATSAPP_MAX_ATTEMPTS);
});

test("antrean duplikat dengan dedupeKey sama hanya dikirim sekali", async () => {
  const user = await createLinkedUser("628888999000");

  const first = await enqueueWhatsappForUser({
    userId: user.id,
    text: "*Satu*",
    dedupeKey: "same-event",
  });
  const second = await enqueueWhatsappForUser({
    userId: user.id,
    text: "*Satu*",
    dedupeKey: "same-event",
  });

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(await db.whatsappOutbox.count(), 1);

  await processWhatsappOutbox();
  assert.equal(fetchCalls.length, 1);
});

test("pesan tidak dikirim jika nomor sudah diputus", async () => {
  const user = await createLinkedUser("628101010101");

  await createNotification({
    userId: user.id,
    title: "Info",
    message: "Akan diputus.",
    dedupeKey: "event-disconnected",
    whatsapp: { text: "*Info*" },
  });

  await db.whatsappLink.deleteMany({ where: { userId: user.id } });

  const result = await processWhatsappOutbox();
  assert.deepEqual(result, { sent: 0, failed: 1, retried: 0 });
  assert.equal(fetchCalls.length, 0);

  const outbox = await db.whatsappOutbox.findFirst();
  assert.equal(outbox?.status, "FAILED");
  assert.equal(outbox?.lastError, "whatsapp_disconnected");
});

test("nomor yang diganti tidak lagi menerima pesan lama", async () => {
  const user = await createLinkedUser("628111111111");

  await createNotification({
    userId: user.id,
    title: "Info",
    message: "Pesan untuk nomor lama.",
    dedupeKey: "event-change-number",
    whatsapp: { text: "*Info*" },
  });

  // Simulasikan penggantian nomor setelah pesan masuk antrean.
  await db.whatsappLink.update({
    where: { userId: user.id },
    data: { phoneNumber: "628222222222" },
  });

  const result = await processWhatsappOutbox();
  assert.deepEqual(result, { sent: 0, failed: 1, retried: 0 });
  assert.equal(fetchCalls.length, 0);
});
