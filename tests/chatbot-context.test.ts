import "./test-env";
import test from "node:test";
import assert from "node:assert/strict";
import {
  answerDataQuestion,
  formatDbContext,
  suggestQuestions,
  type ChatbotDbData,
} from "@/lib/chatbot-context";

const joinedAt = new Date("2025-01-15T08:00:00.000Z");

function makeData(overrides: Partial<ChatbotDbData> = {}): ChatbotDbData {
  return {
    profile: {
      name: "Siti Aminah",
      email: "siti@example.com",
      role: "MASYARAKAT",
      isActive: true,
      joinedAt,
      reportCount: 3,
      taskCount: 0,
      unreadNotifications: 2,
      whatsappConnected: true,
    },
    admin: null,
    total: 10,
    menunggu: 2,
    selesai: 5,
    kritis: 1,
    mine: [
      {
        id: "cmrpt123456",
        title: "Lampu Jalan Mati",
        status: "DITUGASKAN",
        priority: "TINGGI",
        facility: "Penerangan Jalan",
        assignee: "Budi",
        createdAt: new Date("2025-02-01T08:00:00.000Z"),
      },
    ],
    tasks: [],
    byStatus: [
      { status: "SELESAI", count: 5 },
      { status: "MENUNGGU_VERIFIKASI", count: 2 },
    ],
    mineByStatus: [
      { status: "DITUGASKAN", count: 1 },
      { status: "SELESAI", count: 1 },
      { status: "MENUNGGU_VERIFIKASI", count: 1 },
    ],
    taskByStatus: [],
    byPriority: [{ priority: "KRITIS", count: 1 }],
    mineByPriority: [{ priority: "KRITIS", count: 2 }],
    taskByPriority: [{ priority: "KRITIS", count: 1 }],
    facilityTypes: [{ name: "Jalan", reports: 7 }],
    myNotifications: [{ title: "Laporan diverifikasi", isRead: false }],
    recent: null,
    ...overrides,
  };
}

test("konteks memuat profil pengguna yang sedang login", () => {
  const context = formatDbContext(makeData(), "MASYARAKAT");

  assert.match(context, /\[PROFIL PENGGUNA\]/);
  assert.match(context, /Nama: Siti Aminah/);
  assert.match(context, /Email: siti@example.com/);
  assert.match(context, /Peran: Masyarakat/);
  assert.match(context, /WhatsApp: terhubung/);
  assert.match(context, /Jumlah laporan dibuat: 3/);
});

test("jawaban personal menggunakan nama, email, dan peran pengguna", () => {
  const data = makeData();

  assert.match(
    answerDataQuestion("Siapa nama dan email saya?", data, "MASYARAKAT") ?? "",
    /Siti Aminah[\s\S]*siti@example\.com/
  );
  assert.match(
    answerDataQuestion("Apa peran saya?", data, "MASYARAKAT") ?? "",
    /Masyarakat/
  );
  assert.match(
    answerDataQuestion("Apakah WhatsApp saya terhubung?", data, "MASYARAKAT") ?? "",
    /sudah terhubung/
  );
  assert.match(
    answerDataQuestion("Sejak kapan akun saya terdaftar?", data, "MASYARAKAT") ?? "",
    /2025/
  );
});

test("pertanyaan identitas pengguna dijawab sesuai peran tempat chatbot dibuka", () => {
  const data = makeData();

  assert.equal(
    answerDataQuestion("Siapa saya?", data, "ADMIN"),
    "Kamu adalah Admin."
  );
  assert.equal(
    answerDataQuestion("Siapa saya?", data, "PETUGAS"),
    "Kamu adalah Petugas."
  );
  assert.equal(
    answerDataQuestion("Siapa saya?", data, "MASYARAKAT"),
    "Kamu adalah Masyarakat."
  );
  assert.equal(
    answerDataQuestion("Saya siapa?", data, "ADMIN"),
    "Kamu adalah Admin."
  );

  assert.equal(
    answerDataQuestion("Siapa kamu?", data, "ADMIN"),
    "Saya adalah chatbot Admin."
  );
  const botName = answerDataQuestion("Siapa nama bot ini?", data, "ADMIN") ?? "";
  assert.match(botName, /chatbot Admin/);
  assert.doesNotMatch(botName, /siti@example\.com/);

  assert.match(
    answerDataQuestion("Kamu bisa apa saja?", data, "PETUGAS") ?? "",
    /chatbot Petugas[\s\S]*daftar tugas/
  );
  assert.match(
    answerDataQuestion("Apa tugas kamu?", data, "ADMIN") ?? "",
    /chatbot Admin[\s\S]*memverifikasi laporan/
  );
});

test("petugas mendapat ringkasan tugas miliknya", () => {
  const data = makeData({
    profile: {
      name: "Budi",
      email: "budi@example.com",
      role: "PETUGAS",
      isActive: true,
      joinedAt,
      reportCount: 0,
      taskCount: 4,
      unreadNotifications: 1,
      whatsappConnected: false,
    },
    tasks: [
      {
        id: "cmtask123456",
        title: "Perbaiki Jembatan",
        status: "SEDANG_DIPERBAIKI",
        priority: "TINGGI",
        facility: "Jembatan",
        assignee: "Budi",
        createdAt: new Date("2025-02-02T08:00:00.000Z"),
      },
    ],
  });

  const reply = answerDataQuestion("Apa tugas saya?", data, "PETUGAS") ?? "";
  assert.match(reply, /total tugas Anda 4/);
  assert.match(reply, /Perbaiki Jembatan/);
  assert.match(reply, /belum selesai/);
});

test("admin mendapat statistik pengguna dan verifikasi", () => {
  const data = makeData({
    profile: {
      name: "Admin Desa",
      email: "admin@example.com",
      role: "ADMIN",
      isActive: true,
      joinedAt,
      reportCount: 0,
      taskCount: 0,
      unreadNotifications: 0,
      whatsappConnected: false,
    },
    admin: {
      totalUsers: 12,
      activeUsers: 10,
      usersByRole: [
        { role: "MASYARAKAT", count: 7 },
        { role: "PETUGAS", count: 2 },
        { role: "ADMIN", count: 1 },
      ],
      verifiedUnassigned: 3,
    },
  });

  assert.match(
    answerDataQuestion("Berapa pengguna aktif?", data, "ADMIN") ?? "",
    /total 12 pengguna, 10 aktif/
  );
  assert.match(
    answerDataQuestion("Berapa laporan yang menunggu verifikasi?", data, "ADMIN") ?? "",
    /Laporan yang menunggu verifikasi ada 2/
  );
  assert.match(
    answerDataQuestion("Berapa laporan yang belum ditugaskan?", data, "ADMIN") ?? "",
    /3 laporan/
  );

  const context = formatDbContext(data, "ADMIN");
  assert.match(context, /terverifikasi yang belum ditugaskan: 3/);
});

test("admin membedakan laporan menunggu verifikasi dan sudah diverifikasi", () => {
  const data = makeData({
    admin: {
      totalUsers: 12,
      activeUsers: 10,
      usersByRole: [],
      verifiedUnassigned: 3,
    },
    byStatus: [
      { status: "SELESAI", count: 5 },
      { status: "DITERIMA", count: 3 },
      { status: "MENUNGGU_VERIFIKASI", count: 2 },
    ],
  });

  assert.equal(
    answerDataQuestion("Ada berapa laporan yang sudah diverifikasi?", data, "ADMIN"),
    "Ada 8 laporan yang sudah diverifikasi."
  );
  assert.equal(
    answerDataQuestion("Ada berapa laporan yang sudah di verifikasi?", data, "ADMIN"),
    "Ada 8 laporan yang sudah diverifikasi."
  );
  assert.equal(
    answerDataQuestion("Ada berapa laporan yang sudah selesai?", data, "ADMIN"),
    "Laporan yang sudah selesai ada 5."
  );
  assert.equal(
    answerDataQuestion("Berapa laporan yang menunggu verifikasi?", data, "ADMIN"),
    "Laporan yang menunggu verifikasi ada 2."
  );
  assert.equal(
    answerDataQuestion("Berapa laporan yang diverifikasi?", data, "ADMIN"),
    "Apakah maksud Anda laporan yang menunggu verifikasi atau laporan yang sudah diverifikasi?"
  );
});

test("pertanyaan peran lain ditolak sesuai peran pengguna", () => {
  const data = makeData();

  assert.match(
    answerDataQuestion("Berapa laporan yang sudah diverifikasi?", data, "MASYARAKAT") ?? "",
    /hanya dapat dijawab untuk peran Admin[\s\S]*Masyarakat/
  );
  assert.match(
    answerDataQuestion("Berapa laporan yang menunggu verifikasi?", data, "PETUGAS") ?? "",
    /hanya dapat dijawab untuk peran Admin[\s\S]*Petugas/
  );
  assert.match(
    answerDataQuestion("Apa tugas saya?", data, "ADMIN") ?? "",
    /hanya dapat dijawab untuk peran Petugas/
  );
});

test("masyarakat hanya mendapat hitungan laporan miliknya", () => {
  const data = makeData();

  assert.equal(
    answerDataQuestion("Berapa laporan saya yang sudah diverifikasi?", data, "MASYARAKAT"),
    "Anda memiliki 2 laporan yang sudah diverifikasi."
  );
  assert.equal(
    answerDataQuestion("Berapa laporan saya yang menunggu verifikasi?", data, "MASYARAKAT"),
    "Laporan Anda yang menunggu verifikasi ada 1."
  );
  assert.equal(
    answerDataQuestion("Ada berapa laporan yang sudah selesai?", data, "MASYARAKAT"),
    "Laporan Anda yang sudah selesai ada 1."
  );
});

test("petugas mendapat hitungan tugas yang spesifik", () => {
  const data = makeData({
    profile: {
      name: "Budi",
      email: "budi@example.com",
      role: "PETUGAS",
      isActive: true,
      joinedAt,
      reportCount: 0,
      taskCount: 4,
      unreadNotifications: 1,
      whatsappConnected: false,
    },
    tasks: [
      {
        id: "cmtask123456",
        title: "Perbaiki Jembatan",
        status: "SEDANG_DIPERBAIKI",
        priority: "TINGGI",
        facility: "Jembatan",
        assignee: "Budi",
        createdAt: new Date("2025-02-02T08:00:00.000Z"),
      },
    ],
    taskByStatus: [
      { status: "SELESAI", count: 1 },
      { status: "SEDANG_DIPERBAIKI", count: 3 },
    ],
  });

  assert.equal(
    answerDataQuestion("Berapa tugas yang belum selesai?", data, "PETUGAS"),
    "Tugas yang belum selesai ada 3."
  );
  assert.equal(
    answerDataQuestion("Berapa tugas yang sudah selesai?", data, "PETUGAS"),
    "Tugas yang sudah selesai ada 1."
  );
  assert.equal(
    answerDataQuestion("Ada berapa laporan yang sudah selesai?", data, "PETUGAS"),
    "Laporan Anda yang sudah selesai ada 1."
  );
});

test("jumlah laporan per prioritas dijawab spesifik untuk semua peran", () => {
  const data = makeData();

  assert.equal(
    answerDataQuestion("Berapa laporan yang kritis?", data, "ADMIN"),
    "Laporan yang berprioritas KRITIS ada 1."
  );
  assert.equal(
    answerDataQuestion("Berapa laporan saya yang kritis?", data, "MASYARAKAT"),
    "Laporan Anda yang berprioritas KRITIS ada 2."
  );
  assert.equal(
    answerDataQuestion("Berapa tugas yang kritis?", data, "PETUGAS"),
    "Tugas yang berprioritas KRITIS ada 1."
  );
});

test("jumlah laporan tanpa status spesifik dijawab total milik scope", () => {
  const data = makeData();

  assert.equal(
    answerDataQuestion("Berapa laporan yang ada?", data, "ADMIN"),
    "Laporan ada 10."
  );
  assert.equal(
    answerDataQuestion("Berapa laporan saya ada?", data, "MASYARAKAT"),
    "Laporan Anda ada 3."
  );
});

test("saran pertanyaan mengikuti peran pengguna", () => {
  assert.match(suggestQuestions("MASYARAKAT").join(" "), /Status laporan saya/);
  assert.match(suggestQuestions("PETUGAS").join(" "), /Apa tugas saya/);
  assert.match(suggestQuestions("ADMIN").join(" "), /menunggu verifikasi/);
});
