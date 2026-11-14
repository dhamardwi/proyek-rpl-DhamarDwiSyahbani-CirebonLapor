import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { sendWhatsappMessage } from "./fonnte-service";
import { formatOtpMessage } from "./messages";
import { maskWhatsappNumber, normalizeWhatsappNumber } from "./config";

export const WHATSAPP_OTP_TTL_MS = 10 * 60 * 1000;
export const WHATSAPP_OTP_MAX_ATTEMPTS = 5;
export const WHATSAPP_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

const OTP_BCRYPT_ROUNDS = 10;

export type WhatsappLinkErrorCode =
  | "USER_NOT_FOUND"
  | "INVALID_PHONE"
  | "PHONE_ALREADY_LINKED"
  | "ALREADY_ACTIVE"
  | "REGISTRATION_NOT_FOUND"
  | "INVALID_STATUS"
  | "OTP_NOT_AVAILABLE"
  | "OTP_EXPIRED"
  | "OTP_USED"
  | "OTP_INVALID"
  | "OTP_MAX_ATTEMPTS"
  | "OTP_COOLDOWN"
  | "OTP_SEND_FAILED";

export class WhatsappLinkError extends Error {
  constructor(
    public readonly code: WhatsappLinkErrorCode,
    message: string
  ) {
    super(message);
    this.name = "WhatsappLinkError";
  }
}

function maskPhone(phoneNumber: string): string {
  return maskWhatsappNumber(phoneNumber);
}

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, OTP_BCRYPT_ROUNDS);
}

async function findActiveRegistration(userId: string) {
  return db.whatsappRegistration.findFirst({
    where: {
      userId,
      status: { in: ["PENDING", "APPROVED", "REJECTED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { otp: true },
  });
}

export interface SubmitRegistrationResult {
  id: string;
  phoneNumber: string;
  maskedPhoneNumber: string;
  status: string;
  createdAt: Date;
}

/**
 * Mengajukan nomor WhatsApp baru. Nomor lama yang sudah aktif TIDAK diputus
 * pada tahap ini; penggantian baru terjadi setelah OTP nomor baru berhasil.
 */
export async function submitWhatsappRegistration(input: {
  userId: string;
  phoneNumber: string;
}): Promise<SubmitRegistrationResult> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, isActive: true, role: true },
  });

  if (!user || !user.isActive) {
    throw new WhatsappLinkError("USER_NOT_FOUND", "Akun tidak tersedia.");
  }
  if (user.role !== "MASYARAKAT") {
    throw new WhatsappLinkError(
      "USER_NOT_FOUND",
      "Integrasi WhatsApp hanya tersedia untuk akun masyarakat."
    );
  }

  const phoneNumber = normalizeWhatsappNumber(input.phoneNumber);
  if (!phoneNumber) {
    throw new WhatsappLinkError(
      "INVALID_PHONE",
      "Format nomor WhatsApp tidak valid. Gunakan nomor Indonesia, mis. 081234567890."
    );
  }

  const [activeLink, phoneOwner] = await Promise.all([
    db.whatsappLink.findUnique({ where: { userId: input.userId } }),
    db.whatsappLink.findUnique({ where: { phoneNumber } }),
  ]);

  if (activeLink?.phoneNumber === phoneNumber) {
    throw new WhatsappLinkError(
      "ALREADY_ACTIVE",
      "Nomor WhatsApp ini sudah aktif pada akun Anda."
    );
  }
  if (phoneOwner && phoneOwner.userId !== input.userId) {
    throw new WhatsappLinkError(
      "PHONE_ALREADY_LINKED",
      "Nomor WhatsApp ini sudah terhubung ke akun lain."
    );
  }

  const registration = await db.$transaction(async (tx) => {
    // Hanya satu pengajuan berjalan per pengguna. Pengajuan lama dibatalkan,
    // tetapi tautan aktif lama tetap dipertahankan.
    await tx.whatsappRegistration.updateMany({
      where: { userId: input.userId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "CANCELLED" },
    });

    return tx.whatsappRegistration.create({
      data: {
        userId: input.userId,
        phoneNumber,
        status: "PENDING",
      },
    });
  });

  return {
    id: registration.id,
    phoneNumber: registration.phoneNumber,
    maskedPhoneNumber: maskPhone(registration.phoneNumber),
    status: registration.status,
    createdAt: registration.createdAt,
  };
}

export interface WhatsappStatus {
  connected: boolean;
  maskedPhoneNumber?: string;
  verifiedAt?: string;
  registration:
    | {
        id: string;
        maskedPhoneNumber: string;
        status: string;
        rejectionReason: string | null;
        reviewedAt: string | null;
        otpSentAt: string | null;
        otpSendError: string | null;
        otpExpiresAt: string | null;
        otpAttemptsRemaining: number | null;
      }
    | null;
}

export async function getWhatsappStatus(userId: string): Promise<WhatsappStatus> {
  const [link, registration] = await Promise.all([
    db.whatsappLink.findUnique({
      where: { userId },
      select: { phoneNumber: true, verifiedAt: true },
    }),
    findActiveRegistration(userId),
  ]);

  return {
    connected: Boolean(link),
    maskedPhoneNumber: link ? maskPhone(link.phoneNumber) : undefined,
    verifiedAt: link?.verifiedAt.toISOString(),
    registration: registration
      ? {
          id: registration.id,
          maskedPhoneNumber: maskPhone(registration.phoneNumber),
          status: registration.status,
          rejectionReason: registration.rejectionReason,
          reviewedAt: registration.reviewedAt?.toISOString() ?? null,
          otpSentAt: registration.otpSentAt?.toISOString() ?? null,
          otpSendError: registration.otpSendError,
          otpExpiresAt: registration.otp?.expiresAt.toISOString() ?? null,
          otpAttemptsRemaining: registration.otp
            ? Math.max(0, WHATSAPP_OTP_MAX_ATTEMPTS - registration.otp.attempts)
            : null,
        }
      : null,
  };
}

async function allocateAndSendOtp(registration: {
  id: string;
  phoneNumber: string;
}): Promise<{ sent: boolean; error?: string; expiresAt: Date }> {
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + WHATSAPP_OTP_TTL_MS);

  await db.whatsappOtp.upsert({
    where: { registrationId: registration.id },
    create: {
      registrationId: registration.id,
      otpHash,
      expiresAt,
      attempts: 0,
      lastSentAt: new Date(),
    },
    update: {
      otpHash,
      expiresAt,
      attempts: 0,
      usedAt: null,
      lastSentAt: new Date(),
    },
  });

  const result = await sendWhatsappMessage(
    registration.phoneNumber,
    formatOtpMessage(otp, Math.round(WHATSAPP_OTP_TTL_MS / 60_000))
  );

  // OTP mentah tidak pernah disimpan atau dicatat. Hanya status pengiriman
  // dan ID pesan Fonnte (untuk penelusuran di dashboard Fonnte).
  if (result.ok) {
    console.info(
      "[WHATSAPP_OTP_SENT]",
      registration.id,
      result.messageId ?? "(tanpa-id)"
    );
  } else {
    console.warn("[WHATSAPP_OTP_FAILED]", registration.id, result.error);
  }

  await db.whatsappRegistration.update({
    where: { id: registration.id },
    data: {
      otpSentAt: result.ok ? new Date() : null,
      otpSendError: result.ok ? null : result.error,
    },
  });

  return { sent: result.ok, error: result.ok ? undefined : result.error, expiresAt };
}

/** Menyetujui pengajuan lalu mengirim OTP. */
export async function approveRegistration(registrationId: string, adminId: string) {
  const registration = await db.whatsappRegistration.findUnique({
    where: { id: registrationId },
    include: { user: { select: { name: true, email: true, role: true, isActive: true } } },
  });

  if (!registration) {
    throw new WhatsappLinkError("REGISTRATION_NOT_FOUND", "Pengajuan tidak ditemukan.");
  }
  if (registration.status !== "PENDING") {
    throw new WhatsappLinkError(
      "INVALID_STATUS",
      "Hanya pengajuan berstatus PENDING yang dapat disetujui."
    );
  }
  if (!registration.user.isActive) {
    throw new WhatsappLinkError("USER_NOT_FOUND", "Akun pengguna sedang nonaktif.");
  }

  const phoneOwner = await db.whatsappLink.findUnique({
    where: { phoneNumber: registration.phoneNumber },
  });
  if (phoneOwner && phoneOwner.userId !== registration.userId) {
    throw new WhatsappLinkError(
      "PHONE_ALREADY_LINKED",
      "Nomor WhatsApp ini sudah terhubung ke akun lain."
    );
  }

  await db.whatsappRegistration.update({
    where: { id: registration.id },
    data: {
      status: "APPROVED",
      reviewedBy: adminId,
      reviewedAt: new Date(),
      rejectionReason: null,
      otpSendError: null,
    },
  });

  const send = await allocateAndSendOtp(registration);

  return {
    registrationId: registration.id,
    phoneNumber: registration.phoneNumber,
    otpSent: send.sent,
    otpSendError: send.error ?? null,
    otpExpiresAt: send.expiresAt.toISOString(),
  };
}

export async function rejectRegistration(
  registrationId: string,
  adminId: string,
  reason?: string
) {
  const registration = await db.whatsappRegistration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    throw new WhatsappLinkError("REGISTRATION_NOT_FOUND", "Pengajuan tidak ditemukan.");
  }
  if (!["PENDING", "APPROVED"].includes(registration.status)) {
    throw new WhatsappLinkError(
      "INVALID_STATUS",
      "Pengajuan ini tidak dapat ditolak pada status saat ini."
    );
  }

  await db.$transaction([
    db.whatsappRegistration.update({
      where: { id: registration.id },
      data: {
        status: "REJECTED",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason?.trim() || "Tidak memenuhi syarat.",
        otpSentAt: null,
        otpSendError: null,
      },
    }),
    db.whatsappOtp.deleteMany({ where: { registrationId: registration.id } }),
  ]);

  return { registrationId: registration.id };
}

/** Kirim ulang OTP untuk pengajuan yang sudah disetujui (dibatasi cooldown). */
export async function resendOtp(
  registrationId: string,
  options?: { userId?: string }
) {
  const registration = await db.whatsappRegistration.findUnique({
    where: { id: registrationId },
    include: { otp: true },
  });

  if (!registration) {
    throw new WhatsappLinkError("REGISTRATION_NOT_FOUND", "Pengajuan tidak ditemukan.");
  }
  if (options?.userId && registration.userId !== options.userId) {
    throw new WhatsappLinkError("REGISTRATION_NOT_FOUND", "Pengajuan tidak ditemukan.");
  }
  if (registration.status !== "APPROVED") {
    throw new WhatsappLinkError(
      "INVALID_STATUS",
      "Pengajuan belum disetujui administrator."
    );
  }

  const lastSentAt = registration.otp?.lastSentAt?.getTime() ?? 0;
  if (Date.now() - lastSentAt < WHATSAPP_OTP_RESEND_COOLDOWN_MS) {
    const wait = Math.ceil(
      (WHATSAPP_OTP_RESEND_COOLDOWN_MS - (Date.now() - lastSentAt)) / 1000
    );
    throw new WhatsappLinkError(
      "OTP_COOLDOWN",
      `Tunggu ${wait} detik sebelum meminta kode OTP baru.`
    );
  }

  const send = await allocateAndSendOtp(registration);
  if (!send.sent) {
    throw new WhatsappLinkError(
      "OTP_SEND_FAILED",
      "Kode OTP gagal dikirim. Silakan coba beberapa saat lagi."
    );
  }

  return { expiresAt: send.expiresAt.toISOString() };
}

export interface VerifyOtpResult {
  userId: string;
  phoneNumber: string;
  maskedPhoneNumber: string;
}

/**
 * Memverifikasi OTP milik pengguna. OTP disimpan sebagai hash, berumur
 * terbatas, dibatasi percobaannya, dan hanya dapat dipakai sekali.
 */
export async function verifyOtp(input: {
  userId: string;
  otp: string;
}): Promise<VerifyOtpResult> {
  const otpValue = input.otp.trim();
  if (!/^\d{6}$/.test(otpValue)) {
    throw new WhatsappLinkError("OTP_INVALID", "Kode OTP harus terdiri dari 6 angka.");
  }

  const registration = await db.whatsappRegistration.findFirst({
    where: { userId: input.userId, status: "APPROVED" },
    orderBy: { reviewedAt: "desc" },
    include: { otp: true },
  });

  if (!registration || !registration.otp) {
    throw new WhatsappLinkError(
      "OTP_NOT_AVAILABLE",
      "Tidak ada kode OTP aktif untuk akun Anda."
    );
  }

  const otp = registration.otp;

  if (otp.usedAt) {
    throw new WhatsappLinkError("OTP_USED", "Kode OTP sudah pernah digunakan.");
  }
  if (otp.attempts >= WHATSAPP_OTP_MAX_ATTEMPTS) {
    throw new WhatsappLinkError(
      "OTP_MAX_ATTEMPTS",
      "Batas percobaan OTP tercapai. Minta kode baru kepada administrator."
    );
  }
  if (otp.expiresAt.getTime() <= Date.now()) {
    throw new WhatsappLinkError(
      "OTP_EXPIRED",
      "Kode OTP sudah kedaluwarsa. Minta kode baru kepada administrator."
    );
  }

  const matches = await bcrypt.compare(otpValue, otp.otpHash);
  if (!matches) {
    const attempts = otp.attempts + 1;
    await db.whatsappOtp.update({
      where: { id: otp.id },
      data: { attempts },
    });

    if (attempts >= WHATSAPP_OTP_MAX_ATTEMPTS) {
      throw new WhatsappLinkError(
        "OTP_MAX_ATTEMPTS",
        "Batas percobaan OTP tercapai. Minta kode baru kepada administrator."
      );
    }

    throw new WhatsappLinkError(
      "OTP_INVALID",
      `Kode OTP salah. Sisa percobaan: ${WHATSAPP_OTP_MAX_ATTEMPTS - attempts}.`
    );
  }

  // Klaim OTP secara atomik agar dua request paralel tidak sama-sama sukses.
  const claimed = await db.whatsappOtp.updateMany({
    where: {
      id: otp.id,
      usedAt: null,
      attempts: { lt: WHATSAPP_OTP_MAX_ATTEMPTS },
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  if (claimed.count !== 1) {
    throw new WhatsappLinkError("OTP_USED", "Kode OTP sudah pernah digunakan.");
  }

  const phoneOwner = await db.whatsappLink.findUnique({
    where: { phoneNumber: registration.phoneNumber },
  });
  if (phoneOwner && phoneOwner.userId !== input.userId) {
    throw new WhatsappLinkError(
      "PHONE_ALREADY_LINKED",
      "Nomor WhatsApp ini sudah terhubung ke akun lain."
    );
  }

  await db.$transaction(async (tx) => {
    // Tautan lama baru dilepas setelah verifikasi nomor baru berhasil.
    await tx.whatsappLink.deleteMany({ where: { userId: input.userId } });

    await tx.whatsappLink.create({
      data: {
        userId: input.userId,
        phoneNumber: registration.phoneNumber,
        verifiedAt: new Date(),
      },
    });

    await tx.whatsappRegistration.update({
      where: { id: registration.id },
      data: {
        status: "VERIFIED",
        reviewedAt: registration.reviewedAt ?? new Date(),
        otpSendError: null,
      },
    });

    // Pengajuan lain milik pengguna tidak boleh lagi berjalan.
    await tx.whatsappRegistration.updateMany({
      where: {
        userId: input.userId,
        id: { not: registration.id },
        status: { in: ["PENDING", "APPROVED"] },
      },
      data: { status: "CANCELLED" },
    });
  });

  return {
    userId: input.userId,
    phoneNumber: registration.phoneNumber,
    maskedPhoneNumber: maskPhone(registration.phoneNumber),
  };
}

export async function disconnectWhatsapp(userId: string): Promise<number> {
  const result = await db.whatsappLink.deleteMany({ where: { userId } });
  return result.count;
}

export interface AdminRegistrationRow {
  id: string;
  phoneNumber: string;
  maskedPhoneNumber: string;
  status: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  otpSentAt: string | null;
  otpSendError: string | null;
  otpExpiresAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
  };
  activeLink: {
    maskedPhoneNumber: string;
    verifiedAt: string;
  } | null;
}

/** Daftar pengajuan untuk administrator. */
export async function listRegistrations(options?: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<AdminRegistrationRow[]> {
  const status = options?.status?.trim();
  const search = options?.search?.trim();

  const rows = await db.whatsappRegistration.findMany({
    where: {
      ...(status && status !== "ALL" ? { status } : {}),
      ...(search
        ? {
            OR: [
              { phoneNumber: { contains: search } },
              { user: { is: { name: { contains: search } } } },
              { user: { is: { email: { contains: search } } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(1, Math.min(options?.limit ?? 100, 200)),
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          whatsappLink: { select: { phoneNumber: true, verifiedAt: true } },
        },
      },
      otp: { select: { expiresAt: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    phoneNumber: row.phoneNumber,
    maskedPhoneNumber: maskPhone(row.phoneNumber),
    status: row.status,
    rejectionReason: row.rejectionReason,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    otpSentAt: row.otpSentAt?.toISOString() ?? null,
    otpSendError: row.otpSendError,
    otpExpiresAt: row.otp?.expiresAt.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    user: {
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      role: row.user.role,
      isActive: row.user.isActive,
    },
    activeLink: row.user.whatsappLink
      ? {
          maskedPhoneNumber: maskPhone(row.user.whatsappLink.phoneNumber),
          verifiedAt: row.user.whatsappLink.verifiedAt.toISOString(),
        }
      : null,
  }));
}
