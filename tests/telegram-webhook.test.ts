import "./test-env";
import test, { beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import db from "@/lib/db";
import { POST } from "@/app/api/telegram/webhook/route";
import { createLinkToken } from "@/lib/telegram/linking";
import { isValidWebhookSecret } from "@/lib/telegram/webhook-auth";
import { createTestUser, resetDatabase } from "./helpers";

const SECRET = "test-webhook-secret-1234567890";

const originalFetch = globalThis.fetch;
let replyTexts: string[] = [];

function mockReplyFetch() {
  replyTexts = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string };
    replyTexts.push(body.text ?? "");
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function webhookRequest(
  body: unknown,
  secret: string | null = SECRET
): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret !== null) headers["x-telegram-bot-api-secret-token"] = secret;

  return new Request("http://localhost:3000/api/telegram/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function startUpdate(text: string, chatId = "111222333", username = "warga_uji") {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      chat: { id: chatId, username },
      from: { username },
      text,
    },
  };
}

beforeEach(async () => {
  await resetDatabase();
  mockReplyFetch();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

after(async () => {
  await db.$disconnect();
});

test("secret webhook divalidasi constant-time dan secret kosong ditolak", () => {
  assert.equal(isValidWebhookSecret(SECRET, SECRET), true);
  assert.equal(isValidWebhookSecret("salah", SECRET), false);
  assert.equal(isValidWebhookSecret(null, SECRET), false);
  assert.equal(isValidWebhookSecret(SECRET, ""), false);
  assert.equal(isValidWebhookSecret("pendek", "lebih-panjang"), false);
});

test("menolak update tanpa secret yang valid", async () => {
  const response = await POST(webhookRequest(startUpdate("/start"), "salah"));
  assert.equal(response.status, 401);
  assert.equal(await db.telegramLink.count(), 0);

  const missing = await POST(webhookRequest(startUpdate("/start"), null));
  assert.equal(missing.status, 401);
});

test("token valid dari /start menautkan chat ke akun pemilik token", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Webhook");
  const { token } = await createLinkToken(user.id);

  const response = await POST(webhookRequest(startUpdate(`/start ${token}`)));
  assert.equal(response.status, 200);

  const link = await db.telegramLink.findUnique({ where: { userId: user.id } });
  assert.equal(link?.chatId, "111222333");
  assert.equal(replyTexts.length, 1);
  assert.match(replyTexts[0], /Akun berhasil terhubung/);

  const storedToken = await db.telegramLinkToken.findFirst({ where: { userId: user.id } });
  assert.ok(storedToken?.usedAt);
});

test("token yang sudah dipakai tidak dapat menautkan chat lain", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Webhook");
  const { token } = await createLinkToken(user.id);

  await POST(webhookRequest(startUpdate(`/start ${token}`, "999888777")));
  await POST(webhookRequest(startUpdate(`/start ${token}`, "666555444")));

  assert.equal(await db.telegramLink.count(), 1);
  const link = await db.telegramLink.findUnique({ where: { userId: user.id } });
  assert.equal(link?.chatId, "999888777");
  assert.ok(replyTexts.some((text) => /Gagal menghubungkan/.test(text)));
});

test("/start tanpa token hanya menampilkan petunjuk", async () => {
  const response = await POST(webhookRequest(startUpdate("/start")));

  assert.equal(response.status, 200);
  assert.equal(await db.telegramLink.count(), 0);
  assert.match(replyTexts[0], /Pengaturan Telegram/);
});

test("/status menampilkan akun yang terhubung dan /disconnect memutus koneksi", async () => {
  const user = await createTestUser("PETUGAS", "Petugas Webhook");
  const { token } = await createLinkToken(user.id);
  await POST(webhookRequest(startUpdate(`/start ${token}`, "123123123")));

  await POST(webhookRequest(startUpdate("/status", "123123123")));
  assert.match(replyTexts[replyTexts.length - 1], /Petugas Webhook/);

  await POST(webhookRequest(startUpdate("/disconnect", "123123123")));
  assert.equal(await db.telegramLink.count(), 0);
  assert.match(replyTexts[replyTexts.length - 1], /Koneksi diputuskan/);
});

test("webhook ditolak bila secret belum dikonfigurasi", async () => {
  const previous = process.env.TELEGRAM_WEBHOOK_SECRET;
  delete process.env.TELEGRAM_WEBHOOK_SECRET;

  try {
    const response = await POST(webhookRequest(startUpdate("/start")));
    assert.equal(response.status, 503);
  } finally {
    process.env.TELEGRAM_WEBHOOK_SECRET = previous;
  }
});
