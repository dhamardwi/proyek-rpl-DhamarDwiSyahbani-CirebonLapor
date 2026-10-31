import "./test-env";
import test, { beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import db from "@/lib/db";
import { createNotification } from "@/lib/notification-service";
import {
  enqueueTelegramForUser,
  processTelegramOutbox,
  TELEGRAM_MAX_ATTEMPTS,
} from "@/lib/telegram/outbox";
import { createTestUser, resetDatabase } from "./helpers";

interface FetchCall {
  url: string;
  body: { chat_id: string; text: string };
}

let fetchCalls: FetchCall[] = [];
const originalFetch = globalThis.fetch;

function mockTelegramFetch(result: "ok" | "fail") {
  fetchCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({
      url: String(input),
      body: JSON.parse(String(init?.body ?? "{}")) as FetchCall["body"],
    });

    if (result === "ok") {
      return new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: false, error_code: 500, description: "Internal Server Error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }) as typeof fetch;
}

async function createLinkedUser(chatId = "123456789") {
  const user = await createTestUser("PETUGAS", "Petugas Uji");
  await db.telegramLink.create({
    data: { userId: user.id, chatId, username: "petugas_uji" },
  });
  return user;
}

beforeEach(async () => {
  await resetDatabase();
  mockTelegramFetch("ok");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

after(async () => {
  await db.$disconnect();
});

test("mengirim notifikasi ke Telegram sekali dan idempoten", async () => {
  const user = await createLinkedUser();

  await createNotification({
    userId: user.id,
    title: "Tugas Baru",
    message: "Anda mendapat tugas baru.",
    link: "/tasks/abc",
    dedupeKey: "report-assigned:abc",
    telegram: { text: "<b>Tugas Baru</b>" },
  });

  assert.equal(await db.notification.count(), 1);
  assert.equal(await db.telegramOutbox.count(), 1);

  const first = await processTelegramOutbox();
  assert.deepEqual(first, { sent: 1, failed: 0, retried: 0 });
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].body.chat_id, "123456789");
  assert.equal(fetchCalls[0].body.text, "<b>Tugas Baru</b>");

  // Event yang sama diproses ulang tidak boleh membuat notifikasi/pesan ganda.
  await createNotification({
    userId: user.id,
    title: "Tugas Baru",
    message: "Anda mendapat tugas baru.",
    link: "/tasks/abc",
    dedupeKey: "report-assigned:abc",
    telegram: { text: "<b>Tugas Baru</b>" },
  });

  assert.equal(await db.notification.count(), 1);
  assert.equal(await db.telegramOutbox.count(), 1);

  const second = await processTelegramOutbox();
  assert.deepEqual(second, { sent: 0, failed: 0, retried: 0 });
  assert.equal(fetchCalls.length, 1);

  const outbox = await db.telegramOutbox.findFirst();
  assert.equal(outbox?.status, "SENT");
});

test("akun tanpa Telegram tetap mendapat notifikasi in-app", async () => {
  const user = await createTestUser();

  await createNotification({
    userId: user.id,
    title: "Info",
    message: "Notifikasi in-app saja.",
    dedupeKey: "event-no-telegram",
  });

  assert.equal(await db.notification.count(), 1);
  assert.equal(await db.telegramOutbox.count(), 0);
});

test("kegagalan Telegram tidak membatalkan data dan dapat di-retry", async () => {
  const user = await createLinkedUser("222333444");
  mockTelegramFetch("fail");

  await createNotification({
    userId: user.id,
    title: "Laporan Selesai",
    message: "Laporan selesai.",
    dedupeKey: "event-retry",
    telegram: { text: "<b>Selesai</b>" },
  });

  const first = await processTelegramOutbox();
  assert.deepEqual(first, { sent: 0, failed: 0, retried: 1 });

  let outbox = await db.telegramOutbox.findFirst();
  assert.equal(outbox?.status, "PENDING");
  assert.equal(outbox?.attempts, 1);
  assert.equal(outbox?.lastError, "Internal Server Error");

  // Notifikasi in-app tetap ada meskipun kanal Telegram gagal.
  assert.equal(await db.notification.count(), 1);

  await db.telegramOutbox.update({
    where: { id: outbox!.id },
    data: { nextAttemptAt: new Date(Date.now() - 1000) },
  });

  mockTelegramFetch("ok");
  const second = await processTelegramOutbox();
  assert.deepEqual(second, { sent: 1, failed: 0, retried: 0 });
  assert.equal(fetchCalls.length, 1);

  outbox = await db.telegramOutbox.findFirst();
  assert.equal(outbox?.status, "SENT");
  assert.equal(outbox?.attempts, 1);
  assert.equal(await db.notification.count(), 1);
});

test("berhenti setelah batas percobaan retry tercapai", async () => {
  const user = await createLinkedUser("555666777");
  mockTelegramFetch("fail");

  await createNotification({
    userId: user.id,
    title: "Gagal",
    message: "Pesan gagal.",
    dedupeKey: "event-max-attempts",
    telegram: { text: "<b>Gagal</b>" },
  });

  for (let attempt = 1; attempt <= TELEGRAM_MAX_ATTEMPTS; attempt += 1) {
    const result = await processTelegramOutbox();
    assert.equal(result.sent, 0);

    const outbox = await db.telegramOutbox.findFirst();
    if (attempt < TELEGRAM_MAX_ATTEMPTS) {
      assert.equal(outbox?.status, "PENDING");
      await db.telegramOutbox.update({
        where: { id: outbox!.id },
        data: { nextAttemptAt: new Date(Date.now() - 1000) },
      });
    }
  }

  const outbox = await db.telegramOutbox.findFirst();
  assert.equal(outbox?.status, "FAILED");
  assert.equal(outbox?.attempts, TELEGRAM_MAX_ATTEMPTS);
  assert.equal(fetchCalls.length, TELEGRAM_MAX_ATTEMPTS);
});

test("antrean duplikat dengan dedupeKey sama hanya dikirim sekali", async () => {
  const user = await createLinkedUser("888999000");

  const first = await enqueueTelegramForUser({
    userId: user.id,
    text: "<b>Satu</b>",
    dedupeKey: "same-event",
  });
  const second = await enqueueTelegramForUser({
    userId: user.id,
    text: "<b>Satu</b>",
    dedupeKey: "same-event",
  });

  assert.equal(first, true);
  assert.equal(second, false);
  assert.equal(await db.telegramOutbox.count(), 1);

  await processTelegramOutbox();
  assert.equal(fetchCalls.length, 1);
});

test("pesan tidak dikirim jika pengguna sudah memutuskan koneksi", async () => {
  const user = await createLinkedUser("101010101");

  await createNotification({
    userId: user.id,
    title: "Info",
    message: "Akan diputus.",
    dedupeKey: "event-disconnected",
    telegram: { text: "<b>Info</b>" },
  });

  await db.telegramLink.deleteMany({ where: { userId: user.id } });

  const result = await processTelegramOutbox();
  assert.deepEqual(result, { sent: 0, failed: 1, retried: 0 });
  assert.equal(fetchCalls.length, 0);

  const outbox = await db.telegramOutbox.findFirst();
  assert.equal(outbox?.status, "FAILED");
  assert.equal(outbox?.lastError, "telegram_disconnected");
});
