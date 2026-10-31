import "./test-env";
import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import db from "@/lib/db";
import {
  notifyAdminReportAction,
  notifyReportCreated,
  notifyTaskStatusChanged,
} from "@/lib/report-notification-service";
import { createTestUser, resetDatabase } from "./helpers";

let chatCounter = 100000;

async function createLinkedUser(role: string, name: string, isActive = true) {
  const user = await createTestUser(role, name);
  if (!isActive) {
    await db.user.update({ where: { id: user.id }, data: { isActive: false } });
  }
  chatCounter += 1;
  await db.telegramLink.create({
    data: { userId: user.id, chatId: String(chatCounter) },
  });
  return user;
}

async function notificationCount(userId: string) {
  return db.notification.count({ where: { userId } });
}

async function outboxCount(userId: string) {
  return db.telegramOutbox.count({ where: { userId } });
}

beforeEach(async () => {
  await resetDatabase();
});

after(async () => {
  await db.$disconnect();
});

test("laporan baru AUTO_ACCEPTED hanya mengirim ke pelapor, admin aktif, petugas aktif", async () => {
  const reporter = await createLinkedUser("MASYARAKAT", "Pelapor");
  const admin = await createLinkedUser("ADMIN", "Admin Aktif");
  const inactiveAdmin = await createLinkedUser("ADMIN", "Admin Nonaktif", false);
  const petugas = await createLinkedUser("PETUGAS", "Petugas Aktif");
  const inactivePetugas = await createLinkedUser("PETUGAS", "Petugas Nonaktif", false);
  const otherCitizen = await createLinkedUser("MASYARAKAT", "Warga Lain");

  const input = {
    report: {
      id: "report-auto-accepted",
      title: "Jalan Rusak",
      createdAt: new Date("2026-10-22T03:00:00Z"),
    },
    reporterId: reporter.id,
    reporterName: reporter.name,
    autoDecision: "AUTO_ACCEPTED" as const,
  };

  await notifyReportCreated(input);

  assert.equal(await notificationCount(reporter.id), 1);
  assert.equal(await notificationCount(admin.id), 1);
  assert.equal(await notificationCount(inactiveAdmin.id), 0);
  assert.equal(await notificationCount(petugas.id), 1);
  assert.equal(await notificationCount(inactivePetugas.id), 0);
  assert.equal(await notificationCount(otherCitizen.id), 0);

  assert.equal(await outboxCount(reporter.id), 1);
  assert.equal(await outboxCount(admin.id), 1);
  assert.equal(await outboxCount(inactiveAdmin.id), 0);
  assert.equal(await outboxCount(petugas.id), 1);
  assert.equal(await outboxCount(inactivePetugas.id), 0);
  assert.equal(await outboxCount(otherCitizen.id), 0);

  const reporterOutbox = await db.telegramOutbox.findFirst({
    where: { userId: reporter.id },
  });
  assert.match(reporterOutbox?.message ?? "", /Laporan Berhasil Dibuat/);
  assert.match(reporterOutbox?.message ?? "", /Jalan Rusak/);

  // Event yang diproses ulang tidak menggandakan notifikasi.
  await notifyReportCreated(input);
  assert.equal(await notificationCount(reporter.id), 1);
  assert.equal(await outboxCount(reporter.id), 1);
});

test("laporan baru yang menunggu verifikasi manual tidak mengirim ke petugas", async () => {
  const reporter = await createLinkedUser("MASYARAKAT", "Pelapor");
  const admin = await createLinkedUser("ADMIN", "Admin");
  const petugas = await createLinkedUser("PETUGAS", "Petugas");

  await notifyReportCreated({
    report: {
      id: "report-manual",
      title: "Lampu Mati",
      createdAt: new Date(),
    },
    reporterId: reporter.id,
    reporterName: reporter.name,
    autoDecision: "MANUAL_REVIEW",
  });

  assert.equal(await notificationCount(reporter.id), 1);
  assert.equal(await notificationCount(admin.id), 1);
  assert.equal(await notificationCount(petugas.id), 0);
  assert.equal(await outboxCount(petugas.id), 0);
});

test("verifikasi admin mengirim ke pelapor dan semua petugas aktif", async () => {
  const reporter = await createLinkedUser("MASYARAKAT", "Pelapor");
  const actor = await createLinkedUser("ADMIN", "Admin Pemeriksa");
  const petugasA = await createLinkedUser("PETUGAS", "Petugas A");
  const petugasB = await createLinkedUser("PETUGAS", "Petugas B");
  const inactive = await createLinkedUser("PETUGAS", "Petugas Nonaktif", false);

  const occurredAt = new Date("2026-10-22T04:00:00Z");
  const input = {
    action: "VERIFY" as const,
    report: {
      id: "report-verify",
      userId: reporter.id,
      title: "Drainase Tersumbat",
      address: "RT 03",
      status: "MENUNGGU_VERIFIKASI",
      assignedTo: null,
    },
    actorId: actor.id,
    actorName: actor.name,
    occurredAt,
  };

  await notifyAdminReportAction(input);

  assert.equal(await notificationCount(reporter.id), 1);
  assert.equal(await notificationCount(petugasA.id), 1);
  assert.equal(await notificationCount(petugasB.id), 1);
  assert.equal(await notificationCount(inactive.id), 0);
  assert.equal(await notificationCount(actor.id), 0);
  assert.equal(await outboxCount(reporter.id), 1);
  assert.equal(await outboxCount(petugasA.id), 1);

  await notifyAdminReportAction(input);
  assert.equal(await notificationCount(reporter.id), 1);
});

test("penolakan admin mengirim alasan hanya ke pelapor", async () => {
  const reporter = await createLinkedUser("MASYARAKAT", "Pelapor");
  const actor = await createLinkedUser("ADMIN", "Admin");
  const petugas = await createLinkedUser("PETUGAS", "Petugas");

  await notifyAdminReportAction({
    action: "REJECT",
    report: {
      id: "report-reject",
      userId: reporter.id,
      title: "Laporan Tidak Jelas",
      address: "Jl. Mawar",
      status: "MENUNGGU_VERIFIKASI",
      assignedTo: null,
    },
    note: "Foto terlalu buram.",
    actorId: actor.id,
    actorName: actor.name,
    occurredAt: new Date(),
  });

  assert.equal(await notificationCount(reporter.id), 1);
  assert.equal(await notificationCount(petugas.id), 0);
  assert.equal(await outboxCount(reporter.id), 1);

  const outbox = await db.telegramOutbox.findFirst({ where: { userId: reporter.id } });
  assert.match(outbox?.message ?? "", /Foto terlalu buram\./);
});

test("penugasan hanya mengirim ke pelapor dan petugas yang ditugaskan", async () => {
  const reporter = await createLinkedUser("MASYARAKAT", "Pelapor");
  const actor = await createLinkedUser("ADMIN", "Admin");
  const assignee = await createLinkedUser("PETUGAS", "Petugas Terpilih");
  const otherPetugas = await createLinkedUser("PETUGAS", "Petugas Lain");

  await notifyAdminReportAction({
    action: "ASSIGN",
    report: {
      id: "report-assign",
      userId: reporter.id,
      title: "Lampu Jalan Mati",
      address: "Jl. Melati",
      status: "DITERIMA",
      assignedTo: null,
    },
    assigneeId: assignee.id,
    actorId: actor.id,
    actorName: actor.name,
    occurredAt: new Date(),
  });

  assert.equal(await notificationCount(reporter.id), 1);
  assert.equal(await notificationCount(assignee.id), 1);
  assert.equal(await notificationCount(otherPetugas.id), 0);
  assert.equal(await outboxCount(assignee.id), 1);

  const outbox = await db.telegramOutbox.findFirst({ where: { userId: assignee.id } });
  assert.match(outbox?.message ?? "", /Penugasan Laporan Baru/);
  assert.match(outbox?.message ?? "", /Lampu Jalan Mati/);
  assert.match(outbox?.message ?? "", /Ditugaskan oleh: Admin/);
});

test("perubahan prioritas hanya mengirim ke petugas yang bertanggung jawab", async () => {
  const reporter = await createLinkedUser("MASYARAKAT", "Pelapor");
  const actor = await createLinkedUser("ADMIN", "Admin");
  const assignee = await createLinkedUser("PETUGAS", "Petugas");
  const otherPetugas = await createLinkedUser("PETUGAS", "Petugas Lain");

  await notifyAdminReportAction({
    action: "PRIORITY",
    report: {
      id: "report-priority",
      userId: reporter.id,
      title: "Jembatan Retak",
      address: "Desa Sukamaju",
      status: "DITUGASKAN",
      assignedTo: assignee.id,
    },
    priority: "KRITIS",
    actorId: actor.id,
    actorName: actor.name,
    occurredAt: new Date(),
  });

  assert.equal(await notificationCount(assignee.id), 1);
  assert.equal(await notificationCount(reporter.id), 0);
  assert.equal(await notificationCount(otherPetugas.id), 0);

  const outbox = await db.telegramOutbox.findFirst({ where: { userId: assignee.id } });
  assert.match(outbox?.message ?? "", /Kritis/);
});

test("status pengerjaan mengirim ke pelapor, penyelesaian juga menginformasikan admin aktif", async () => {
  const reporter = await createLinkedUser("MASYARAKAT", "Pelapor");
  const actor = await createLinkedUser("PETUGAS", "Petugas Pelaksana");
  const admin = await createLinkedUser("ADMIN", "Admin Aktif");
  const inactiveAdmin = await createLinkedUser("ADMIN", "Admin Nonaktif", false);

  const report = {
    id: "report-work",
    userId: reporter.id,
    title: "Trotoar Rusak",
    address: "Jl. Merdeka",
  };

  await notifyTaskStatusChanged({
    report,
    newStatus: "SEDANG_DIPERBAIKI",
    note: "Mulai dikerjakan",
    actorId: actor.id,
    actorName: actor.name,
    occurredAt: new Date(),
  });

  assert.equal(await notificationCount(reporter.id), 1);
  assert.equal(await notificationCount(admin.id), 0);

  await notifyTaskStatusChanged({
    report,
    newStatus: "SELESAI",
    note: "Selesai dan dirapikan",
    actorId: actor.id,
    actorName: actor.name,
    occurredAt: new Date(Date.now() + 60_000),
  });

  assert.equal(await notificationCount(reporter.id), 2);
  assert.equal(await notificationCount(admin.id), 1);
  assert.equal(await notificationCount(inactiveAdmin.id), 0);
  assert.equal(await outboxCount(reporter.id), 2);
  assert.equal(await outboxCount(admin.id), 1);

  const adminOutbox = await db.telegramOutbox.findFirst({ where: { userId: admin.id } });
  assert.match(adminOutbox?.message ?? "", /Laporan Selesai Ditangani/);
  assert.match(adminOutbox?.message ?? "", /Petugas Pelaksana/);
});
