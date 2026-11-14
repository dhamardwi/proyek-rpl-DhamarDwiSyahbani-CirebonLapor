import "./test-env";
import test, { beforeEach, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import db from "@/lib/db";
import {
  approveRegistration,
  disconnectWhatsapp,
  getWhatsappStatus,
  rejectRegistration,
  submitWhatsappRegistration,
  verifyOtp,
  WHATSAPP_OTP_MAX_ATTEMPTS,
  WhatsappLinkError,
} from "@/lib/whatsapp/linking";
import { createTestUser, resetDatabase } from "./helpers";

interface SentMessage {
  target: string;
  message: string;
}

let sentMessages: SentMessage[] = [];
const originalFetch = globalThis.fetch;

function mockFonnte() {
  sentMessages = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = new URLSearchParams(String(init?.body ?? ""));
    sentMessages.push({
      target: body.get("target") ?? "",
      message: body.get("message") ?? "",
    });

    return new Response(JSON.stringify({ status: true, id: ["msg-1"] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;
}

function lastOtp(): string {
  const message = sentMessages[sentMessages.length - 1]?.message ?? "";
  const match = message.match(/Kode OTP Anda: \*(\d{6})\*/);
  assert.ok(match, `OTP tidak ditemukan pada pesan: ${message}`);
  return match[1];
}

async function approveAndGetOtp(registrationId: string, adminId: string) {
  const result = await approveRegistration(registrationId, adminId);
  assert.equal(result.otpSent, true);
  return lastOtp();
}

function assertLinkError(code: string) {
  return (error: unknown) =>
    error instanceof WhatsappLinkError && error.code === code;
}

beforeEach(async () => {
  await resetDatabase();
  mockFonnte();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

after(async () => {
  await db.$disconnect();
});

test("pengajuan nomor disimpan PENDING dan nomor lama tidak diputus", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Satu");
  await db.whatsappLink.create({
    data: { userId: user.id, phoneNumber: "628111111111" },
  });

  const registration = await submitWhatsappRegistration({
    userId: user.id,
    phoneNumber: "0812-3456-7890",
  });

  assert.equal(registration.status, "PENDING");
  assert.equal(registration.phoneNumber, "6281234567890");

  const stored = await db.whatsappRegistration.findUnique({
    where: { id: registration.id },
  });
  assert.equal(stored?.status, "PENDING");

  // Tautan lama tetap aktif sampai OTP nomor baru berhasil.
  const link = await db.whatsappLink.findUnique({ where: { userId: user.id } });
  assert.equal(link?.phoneNumber, "628111111111");

  const status = await getWhatsappStatus(user.id);
  assert.equal(status.connected, true);
  assert.equal(status.registration?.status, "PENDING");
  assert.ok(status.registration?.maskedPhoneNumber.includes("7890"));
});

test("menolak nomor yang sudah terhubung ke akun lain", async () => {
  const userA = await createTestUser("MASYARAKAT", "User A");
  const userB = await createTestUser("MASYARAKAT", "User B");
  await db.whatsappLink.create({
    data: { userId: userA.id, phoneNumber: "6281234567890" },
  });

  await assert.rejects(
    () =>
      submitWhatsappRegistration({
        userId: userB.id,
        phoneNumber: "081234567890",
      }),
    assertLinkError("PHONE_ALREADY_LINKED")
  );
});

test("persetujuan mengirim OTP hash, lalu verifikasi mengaktifkan nomor", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Verifikasi");
  const admin = await createTestUser("ADMIN", "Admin");

  const registration = await submitWhatsappRegistration({
    userId: user.id,
    phoneNumber: "081298765432",
  });

  const otp = await approveAndGetOtp(registration.id, admin.id);

  const registrationAfterApprove = await db.whatsappRegistration.findUnique({
    where: { id: registration.id },
    include: { otp: true },
  });
  assert.equal(registrationAfterApprove?.status, "APPROVED");
  assert.ok(registrationAfterApprove?.otpSentAt);
  assert.ok(registrationAfterApprove?.otp);
  assert.notEqual(registrationAfterApprove?.otp?.otpHash, otp);
  assert.equal(registrationAfterApprove?.otp?.otpHash.length, 60);

  // OTP salah tidak boleh mengaktifkan nomor.
  await assert.rejects(
    () => verifyOtp({ userId: user.id, otp: "000000" }),
    assertLinkError("OTP_INVALID")
  );
  assert.equal(await db.whatsappLink.count(), 0);

  const result = await verifyOtp({ userId: user.id, otp });
  assert.equal(result.phoneNumber, "6281298765432");

  const link = await db.whatsappLink.findUnique({ where: { userId: user.id } });
  assert.equal(link?.phoneNumber, "6281298765432");

  const verified = await db.whatsappRegistration.findUnique({
    where: { id: registration.id },
  });
  assert.equal(verified?.status, "VERIFIED");

  // OTP tidak dapat dipakai dua kali.
  await assert.rejects(
    () => verifyOtp({ userId: user.id, otp }),
    assertLinkError("OTP_NOT_AVAILABLE")
  );
});

test("OTP kedaluwarsa ditolak", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Expired");
  const admin = await createTestUser("ADMIN", "Admin");
  const registration = await submitWhatsappRegistration({
    userId: user.id,
    phoneNumber: "081211112222",
  });
  const otp = await approveAndGetOtp(registration.id, admin.id);

  await db.whatsappOtp.updateMany({
    where: { registrationId: registration.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });

  await assert.rejects(
    () => verifyOtp({ userId: user.id, otp }),
    assertLinkError("OTP_EXPIRED")
  );
  assert.equal(await db.whatsappLink.count(), 0);
});

test("batas percobaan OTP diterapkan", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Limit");
  const admin = await createTestUser("ADMIN", "Admin");
  const registration = await submitWhatsappRegistration({
    userId: user.id,
    phoneNumber: "081233334444",
  });
  const otp = await approveAndGetOtp(registration.id, admin.id);

  for (let attempt = 1; attempt < WHATSAPP_OTP_MAX_ATTEMPTS; attempt += 1) {
    await assert.rejects(
      () => verifyOtp({ userId: user.id, otp: "999999" }),
      assertLinkError("OTP_INVALID")
    );
  }

  await assert.rejects(
    () => verifyOtp({ userId: user.id, otp: "999999" }),
    assertLinkError("OTP_MAX_ATTEMPTS")
  );

  // OTP yang benar pun tidak bisa dipakai setelah batas tercapai.
  await assert.rejects(
    () => verifyOtp({ userId: user.id, otp }),
    assertLinkError("OTP_MAX_ATTEMPTS")
  );
  assert.equal(await db.whatsappLink.count(), 0);
});

test("penolakan administrator tidak mengaktifkan nomor", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Tolak");
  const admin = await createTestUser("ADMIN", "Admin");
  const registration = await submitWhatsappRegistration({
    userId: user.id,
    phoneNumber: "081255556666",
  });

  await rejectRegistration(registration.id, admin.id, "Nomor tidak aktif.");

  const stored = await db.whatsappRegistration.findUnique({
    where: { id: registration.id },
  });
  assert.equal(stored?.status, "REJECTED");
  assert.equal(stored?.rejectionReason, "Nomor tidak aktif.");
  assert.equal(await db.whatsappLink.count(), 0);

  await assert.rejects(
    () => verifyOtp({ userId: user.id, otp: "123456" }),
    assertLinkError("OTP_NOT_AVAILABLE")
  );
});

test("perubahan nomor: nomor lama baru dilepas setelah nomor baru terverifikasi", async () => {
  const user = await createTestUser("MASYARAKAT", "Warga Ganti");
  const admin = await createTestUser("ADMIN", "Admin");
  await db.whatsappLink.create({
    data: { userId: user.id, phoneNumber: "628111111111" },
  });

  const registration = await submitWhatsappRegistration({
    userId: user.id,
    phoneNumber: "081277778888",
  });
  const otp = await approveAndGetOtp(registration.id, admin.id);

  // Sebelum verifikasi, nomor lama tetap aktif.
  let link = await db.whatsappLink.findUnique({ where: { userId: user.id } });
  assert.equal(link?.phoneNumber, "628111111111");

  await verifyOtp({ userId: user.id, otp });

  link = await db.whatsappLink.findUnique({ where: { userId: user.id } });
  assert.equal(link?.phoneNumber, "6281277778888");
  assert.equal(await db.whatsappLink.count(), 1);

  const oldNumber = await db.whatsappLink.findUnique({
    where: { phoneNumber: "628111111111" },
  });
  assert.equal(oldNumber, null);
});

test("pemutusan koneksi hanya menghapus nomor milik pengguna", async () => {
  const userA = await createTestUser("MASYARAKAT", "User A");
  const userB = await createTestUser("MASYARAKAT", "User B");
  await db.whatsappLink.create({
    data: { userId: userA.id, phoneNumber: "628111111111" },
  });
  await db.whatsappLink.create({
    data: { userId: userB.id, phoneNumber: "628222222222" },
  });

  assert.equal(await disconnectWhatsapp(userA.id), 1);
  assert.equal(await db.whatsappLink.count(), 1);

  const remaining = await db.whatsappLink.findUnique({ where: { userId: userB.id } });
  assert.equal(remaining?.phoneNumber, "628222222222");
});
