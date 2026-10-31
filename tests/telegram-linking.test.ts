import "./test-env";
import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import db from "@/lib/db";
import {
  consumeLinkToken,
  createLinkToken,
  disconnectTelegram,
  getTelegramStatus,
  TelegramLinkError,
  TELEGRAM_LINK_TOKEN_TTL_MS,
} from "@/lib/telegram/linking";
import { createTestUser, resetDatabase } from "./helpers";

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await db.$disconnect();
});

test("membuat token acak, menyimpan hash, dan menautkan chat Telegram", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Satu");
  const { token, expiresAt } = await createLinkToken(user.id);

  assert.ok(token.length >= 40);
  assert.ok(expiresAt.getTime() > Date.now());
  assert.ok(expiresAt.getTime() <= Date.now() + TELEGRAM_LINK_TOKEN_TTL_MS + 1000);

  const stored = await db.telegramLinkToken.findFirst({ where: { userId: user.id } });
  assert.ok(stored);
  assert.notEqual(stored.tokenHash, token);
  assert.equal(stored.tokenHash.length, 64);

  const result = await consumeLinkToken({
    token,
    chatId: "123456789",
    telegramUsername: "warga_satu",
  });

  assert.equal(result.userId, user.id);
  assert.equal(result.role, "MASYARAKAT");

  const link = await db.telegramLink.findUnique({ where: { userId: user.id } });
  assert.ok(link);
  assert.equal(link.chatId, "123456789");
  assert.equal(link.username, "warga_satu");

  const used = await db.telegramLinkToken.findUnique({ where: { id: stored.id } });
  assert.ok(used?.usedAt);
});

test("menolak token yang sudah pernah dipakai", async () => {
  const user = await createTestUser();
  const { token } = await createLinkToken(user.id);

  await consumeLinkToken({ token, chatId: "111111" });

  await assert.rejects(
    () => consumeLinkToken({ token, chatId: "222222" }),
    (error: unknown) =>
      error instanceof TelegramLinkError && error.code === "USED_TOKEN"
  );

  const links = await db.telegramLink.findMany();
  assert.equal(links.length, 1);
  assert.equal(links[0].chatId, "111111");
});

test("menolak token yang kedaluwarsa", async () => {
  const user = await createTestUser();
  const { token } = await createLinkToken(user.id);

  await db.telegramLinkToken.updateMany({
    where: { userId: user.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  await assert.rejects(
    () => consumeLinkToken({ token, chatId: "333333" }),
    (error: unknown) =>
      error instanceof TelegramLinkError && error.code === "EXPIRED_TOKEN"
  );

  assert.equal(await db.telegramLink.count(), 0);
});

test("satu chat Telegram tidak dapat ditautkan ke dua akun aplikasi", async () => {
  const userA = await createTestUser("MASYARAKAT", "User A");
  const userB = await createTestUser("MASYARAKAT", "User B");

  const tokenB = await createLinkToken(userB.id);
  await consumeLinkToken({ token: tokenB.token, chatId: "444444" });

  const tokenA = await createLinkToken(userA.id);
  await assert.rejects(
    () => consumeLinkToken({ token: tokenA.token, chatId: "444444" }),
    (error: unknown) =>
      error instanceof TelegramLinkError && error.code === "CHAT_ALREADY_LINKED"
  );

  const link = await db.telegramLink.findUnique({ where: { chatId: "444444" } });
  assert.equal(link?.userId, userB.id);
  assert.equal(await db.telegramLink.count(), 1);
});

test("pengguna hanya dapat memutuskan koneksi Telegram miliknya", async () => {
  const userA = await createTestUser("MASYARAKAT", "User A");
  const userB = await createTestUser("MASYARAKAT", "User B");

  const tokenA = await createLinkToken(userA.id);
  await consumeLinkToken({ token: tokenA.token, chatId: "555555" });
  const tokenB = await createLinkToken(userB.id);
  await consumeLinkToken({ token: tokenB.token, chatId: "666666" });

  const removed = await disconnectTelegram(userA.id);
  assert.equal(removed, 1);

  assert.equal(await db.telegramLink.count(), 1);
  const remaining = await db.telegramLink.findUnique({ where: { userId: userB.id } });
  assert.equal(remaining?.chatId, "666666");
});

test("status koneksi tidak membocorkan Chat ID lengkap", async () => {
  const user = await createTestUser();
  const { token } = await createLinkToken(user.id);
  await consumeLinkToken({ token, chatId: "9876543210" });

  const status = await getTelegramStatus(user.id);
  assert.equal(status.connected, true);
  if (status.connected) {
    assert.equal(status.maskedChatId, "••••3210");
    assert.ok(!status.maskedChatId.includes("987654"));
  }
});
