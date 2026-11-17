import "./test-env";
import test, { beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import bcrypt from "bcryptjs";
import db from "@/lib/db";
import { DELETED_USER_EMAIL, DELETED_USER_NAME } from "@/lib/constants";
import { createTestUser, resetDatabase } from "./helpers";
import { __resetTestSession, __setTestSession } from "@/lib/auth-session";
import {
  __resetReportPostSubmitScheduler,
  __setReportPostSubmitScheduler,
} from "@/lib/report-post-submit-scheduler";

import { readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { GET as getUsers } from "@/app/api/users/route";
import { DELETE as deleteUser } from "@/app/api/users/[id]/route";
import { POST as createAdminUser } from "@/app/api/admin/users/route";
import { PATCH as patchAdminUser } from "@/app/api/admin/users/[id]/route";
import { GET as getProfile, PUT as putProfile } from "@/app/api/profile/route";
import {
  GET as getNotifications,
  PATCH as patchNotifications,
} from "@/app/api/notifications/route";
import { GET as getSettingsAi } from "@/app/api/settings/ai/route";
import { GET as getReportsMap } from "@/app/api/reports/map/route";
import { POST as createReport } from "@/app/api/reports/route";

const UPLOAD_REPORTS_DIR = path.join(process.cwd(), "public", "uploads", "reports");

function snapshotUploadFiles(): Set<string> {
  try {
    return new Set(readdirSync(UPLOAD_REPORTS_DIR));
  } catch {
    return new Set();
  }
}

function cleanupNewUploadFiles(before: Set<string>) {
  const after = snapshotUploadFiles();
  for (const name of after) {
    if (!before.has(name)) {
      try {
        unlinkSync(path.join(UPLOAD_REPORTS_DIR, name));
      } catch {
        // best-effort cleanup of test-created files only
      }
    }
  }
}

function makeSession(
  user: { id: string; role: string; name?: string | null; email?: string | null }
): Session {
  return {
    user: {
      id: user.id,
      role: user.role,
      name: user.name ?? "Test User",
      email: user.email ?? "test@example.com",
    },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
}

async function readJson(res: Response) {
  return res.json() as Promise<Record<string, unknown>>;
}

beforeEach(async () => {
  __resetTestSession();
  await resetDatabase();
});

afterEach(() => {
  __resetTestSession();
  __resetReportPostSubmitScheduler();
});

after(async () => {
  await db.$disconnect().catch(() => {});
});

test("GET /api/users: tanpa session -> 401 (Unauthorized)", async () => {
  __setTestSession(null);
  const res = await getUsers(new NextRequest("http://localhost/api/users"));

  assert.equal(res.status, 401);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
});

test("GET /api/users: MASYARAKAT ditolak -> 403", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Warga");
  __setTestSession(makeSession(masyarakat));

  const res = await getUsers(new NextRequest("http://localhost/api/users"));

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Akses ditolak. Hanya Admin yang dapat mengakses.");
});

test("GET /api/users: PETUGAS ditolak -> 403", async () => {
  const petugas = await createTestUser("PETUGAS", "Petugas");
  __setTestSession(makeSession(petugas));

  const res = await getUsers(new NextRequest("http://localhost/api/users"));

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Akses ditolak. Hanya Admin yang dapat mengakses.");
});

test("GET /api/users: ADMIN berhasil -> 200 dengan struktur respons utama", async () => {
  const admin = await createTestUser("ADMIN", "Admin");
  const petugas = await createTestUser("PETUGAS", "Petugas Satu");
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?page=1&pageSize=10")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  assert.ok(body.data && typeof body.data === "object");

  const data = body.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.users));
  assert.equal(typeof data.total, "number");
  assert.equal(data.page, 1);
  assert.equal(data.pageSize, 10);
  assert.equal(typeof data.totalPages, "number");

  const users = data.users as Array<Record<string, unknown>>;
  assert.ok(users.length >= 2);
  const returned = users.find((u) => u.id === petugas.id);
  assert.ok(returned, "user lain harus muncul dalam daftar admin");
  assert.equal(returned?.email, petugas.email);
  assert.equal(returned?.role, "PETUGAS");
  assert.equal(typeof returned?.isActive, "boolean");
  assert.equal(typeof returned?.reportCount, "number");
  assert.equal(typeof returned?.taskCount, "number");
  assert.equal(typeof returned?.whatsappConnected, "boolean");
});

test("GET /api/profile: tanpa session -> 401", async () => {
  __setTestSession(null);
  const res = await getProfile();

  assert.equal(res.status, 401);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
});

test("GET /api/profile: session user tidak ditemukan di DB -> 404 (perilaku aktual)", async () => {
  __setTestSession(
    makeSession({
      id: "user-tidak-ada",
      role: "MASYARAKAT",
      name: "Ghost",
      email: "ghost@example.com",
    })
  );

  const res = await getProfile();

  assert.equal(res.status, 404);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Pengguna tidak ditemukan");
});

for (const role of ["ADMIN", "PETUGAS", "MASYARAKAT"] as const) {
  test(`GET /api/profile: ${role} terautentikasi mendapat profil miliknya sendiri (session.user.id)`, async () => {
    const user = await createTestUser(role, `${role} User`);
    // Buat user lain untuk memastikan data yang dikembalikan milik session.
    await createTestUser("MASYARAKAT", "Other User");
    __setTestSession(makeSession(user));

    const res = await getProfile();

    assert.equal(res.status, 200);
    const body = await readJson(res);
    assert.equal(body.success, true);
    assert.ok(body.data && typeof body.data === "object");

    const data = body.data as Record<string, unknown>;
    assert.equal(data.id, user.id);
    assert.equal(data.email, user.email);
    assert.equal(data.role, role);
    assert.equal(typeof data.name, "string");
    assert.equal(typeof data.isActive, "boolean");
    assert.equal(typeof data.reportCount, "number");
    assert.equal(typeof data.taskCount, "number");
    assert.ok(data.whatsapp && typeof data.whatsapp === "object");
  });
}

test("PUT /api/profile: tanpa session -> 401", async () => {
  __setTestSession(null);
  const res = await putProfile(
    new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Nama Baru",
        email: "baru@example.com",
        phone: "",
        address: "",
      }),
    })
  );

  assert.equal(res.status, 401);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
});

test("PUT /api/profile: update dibatasi ke session.user.id (tidak mengubah user lain)", async () => {
  const self = await createTestUser("MASYARAKAT", "Self User");
  const other = await createTestUser("MASYARAKAT", "Other User");
  __setTestSession(makeSession(self));

  const res = await putProfile(
    new NextRequest("http://localhost/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Self Updated",
        email: self.email,
        phone: "08123456789",
        address: "Alamat Self",
      }),
    })
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.id, self.id);
  assert.equal(data.name, "Self Updated");

  const selfAfter = await db.user.findUnique({ where: { id: self.id } });
  const otherAfter = await db.user.findUnique({ where: { id: other.id } });
  assert.equal(selfAfter?.name, "Self Updated");
  assert.equal(otherAfter?.name, "Other User");
  assert.equal(otherAfter?.email, other.email);
});

test("GET /api/notifications: tanpa session -> 401", async () => {
  __setTestSession(null);
  const res = await getNotifications();

  assert.equal(res.status, 401);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
});

for (const role of ["ADMIN", "PETUGAS", "MASYARAKAT"] as const) {
  test(`GET /api/notifications: ${role} hanya menerima notifikasi miliknya (session.user.id)`, async () => {
    const self = await createTestUser(role, `${role} Self`);
    const other = await createTestUser("MASYARAKAT", "Other Notif User");

    await db.notification.create({
      data: {
        userId: self.id,
        title: "Notif Self",
        message: "Milik sendiri",
      },
    });
    await db.notification.create({
      data: {
        userId: other.id,
        title: "Notif Other",
        message: "Milik orang lain",
      },
    });

    __setTestSession(makeSession(self));
    const res = await getNotifications();

    assert.equal(res.status, 200);
    const body = await readJson(res);
    assert.equal(body.success, true);
    assert.equal(typeof body.unreadCount, "number");
    assert.ok(Array.isArray(body.data));

    const data = body.data as Array<Record<string, unknown>>;
    assert.ok(data.length >= 1);
    assert.ok(data.every((n) => n.userId === self.id));
    assert.ok(data.some((n) => n.title === "Notif Self"));
    assert.ok(!data.some((n) => n.title === "Notif Other"));
  });
}

test("PATCH /api/notifications: tanpa session -> 401", async () => {
  __setTestSession(null);
  const res = await patchNotifications(
    new NextRequest("http://localhost/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    })
  );

  assert.equal(res.status, 401);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
});

test("PATCH /api/notifications: markAll hanya mengubah notifikasi milik session (user lain tidak berubah)", async () => {
  const self = await createTestUser("MASYARAKAT", "Self Notif");
  const other = await createTestUser("MASYARAKAT", "Other Notif");

  const selfNotif = await db.notification.create({
    data: {
      userId: self.id,
      title: "Self Unread",
      message: "Unread",
      isRead: false,
    },
  });
  const otherNotif = await db.notification.create({
    data: {
      userId: other.id,
      title: "Other Unread",
      message: "Unread",
      isRead: false,
    },
  });

  __setTestSession(makeSession(self));
  const res = await patchNotifications(
    new NextRequest("http://localhost/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    })
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);

  const selfAfter = await db.notification.findUnique({ where: { id: selfNotif.id } });
  const otherAfter = await db.notification.findUnique({ where: { id: otherNotif.id } });
  assert.equal(selfAfter?.isRead, true);
  assert.equal(otherAfter?.isRead, false);
});

test("PATCH /api/notifications: notificationId milik user lain tidak ikut berubah (scoping session.user.id)", async () => {
  const self = await createTestUser("PETUGAS", "Self Notif Id");
  const other = await createTestUser("MASYARAKAT", "Other Notif Id");

  const otherNotif = await db.notification.create({
    data: {
      userId: other.id,
      title: "Other Target",
      message: "Unread",
      isRead: false,
    },
  });

  __setTestSession(makeSession(self));
  const res = await patchNotifications(
    new NextRequest("http://localhost/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notificationId: otherNotif.id }),
    })
  );

  // Handler melakukan updateMany dengan filter userId session; milik user lain tidak terpengaruh.
  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);

  const otherAfter = await db.notification.findUnique({ where: { id: otherNotif.id } });
  assert.equal(otherAfter?.isRead, false);
});

test("GET /api/settings/ai: tanpa session -> 401 + Cache-Control no-store", async () => {
  __setTestSession(null);
  const res = await getSettingsAi();

  assert.equal(res.status, 401);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
});

test("GET /api/settings/ai: MASYARAKAT ditolak -> 403 + Cache-Control no-store", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Warga AI");
  __setTestSession(makeSession(masyarakat));

  const res = await getSettingsAi();

  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Akses ditolak.");
});

test("GET /api/settings/ai: PETUGAS ditolak -> 403 + Cache-Control no-store", async () => {
  const petugas = await createTestUser("PETUGAS", "Petugas AI");
  __setTestSession(makeSession(petugas));

  const res = await getSettingsAi();

  assert.equal(res.status, 403);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Akses ditolak.");
});

test("GET /api/settings/ai: ADMIN berhasil -> 200 dengan kontrak respons & Cache-Control no-store", async () => {
  const admin = await createTestUser("ADMIN", "Admin AI");
  __setTestSession(makeSession(admin));

  const res = await getSettingsAi();

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  const body = await readJson(res);
  assert.equal(body.success, true);
  assert.ok(body.data && typeof body.data === "object");

  const data = body.data as Record<string, unknown>;
  assert.ok(Array.isArray(data.providers));
  assert.equal(typeof data.chatbotAvailable, "boolean");
});

// --- B1.1a: cakupan tambahan GET /api/users (filter, pagination, proteksi, field) ---

test("GET /api/users: filter role PETUGAS hanya mengembalikan pengguna PETUGAS", async () => {
  const admin = await createTestUser("ADMIN", "Admin Filter");
  const p1 = await createTestUser("PETUGAS", "Petugas Satu");
  const p2 = await createTestUser("PETUGAS", "Petugas Dua");
  await createTestUser("MASYARAKAT", "Warga Satu");
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?role=PETUGAS&page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>>; total: number };
  assert.equal(body.success, true);
  assert.equal(data.total, 2);
  assert.equal(data.users.length, 2);
  assert.ok(data.users.every((u) => u.role === "PETUGAS"));
  const ids = data.users.map((u) => u.id);
  assert.ok(ids.includes(p1.id));
  assert.ok(ids.includes(p2.id));
});

test("GET /api/users: filter role MASYARAKAT hanya mengembalikan pengguna MASYARAKAT", async () => {
  const admin = await createTestUser("ADMIN", "Admin Filter M");
  const m1 = await createTestUser("MASYARAKAT", "Warga Satu");
  await createTestUser("PETUGAS", "Petugas Lain");
  await createTestUser("ADMIN", "Admin Lain");
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?role=MASYARAKAT&page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>>; total: number };
  assert.equal(data.total, 1);
  assert.equal(data.users.length, 1);
  assert.equal(data.users[0]?.role, "MASYARAKAT");
  assert.equal(data.users[0]?.id, m1.id);
});

test("GET /api/users: pencarian berdasarkan nama hanya mengembalikan yang cocok", async () => {
  const admin = await createTestUser("ADMIN", "Admin Search");
  const match = await db.user.create({
    data: {
      name: "Budi Santoso",
      email: "budi.search@example.com",
      password: "not-used-in-tests",
      role: "MASYARAKAT",
    },
  });
  await db.user.create({
    data: {
      name: "Siti Aminah",
      email: "siti.search@example.com",
      password: "not-used-in-tests",
      role: "MASYARAKAT",
    },
  });
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?search=Budi&page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>>; total: number };
  assert.equal(data.total, 1);
  assert.equal(data.users.length, 1);
  assert.equal(data.users[0]?.id, match.id);
  assert.equal(data.users[0]?.name, "Budi Santoso");
});

test("GET /api/users: pencarian berdasarkan email hanya mengembalikan yang cocok", async () => {
  const admin = await createTestUser("ADMIN", "Admin Search Email");
  const match = await db.user.create({
    data: {
      name: "Target Email",
      email: "unik-target@example.com",
      password: "not-used-in-tests",
      role: "PETUGAS",
    },
  });
  await db.user.create({
    data: {
      name: "Lainnya",
      email: "lainnya@example.com",
      password: "not-used-in-tests",
      role: "PETUGAS",
    },
  });
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?search=unik-target&page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>>; total: number };
  assert.equal(data.total, 1);
  assert.equal(data.users.length, 1);
  assert.equal(data.users[0]?.id, match.id);
  assert.equal(data.users[0]?.email, "unik-target@example.com");
});

test("GET /api/users: kombinasi search dan role hanya mengembalikan hasil yang sesuai keduanya", async () => {
  const admin = await createTestUser("ADMIN", "Admin Combo");
  const match = await db.user.create({
    data: {
      name: "Andi Petugas",
      email: "andi.combo@example.com",
      password: "not-used-in-tests",
      role: "PETUGAS",
    },
  });
  await db.user.create({
    data: {
      name: "Andi Warga",
      email: "andiw.combo@example.com",
      password: "not-used-in-tests",
      role: "MASYARAKAT",
    },
  });
  await db.user.create({
    data: {
      name: "Budi Petugas",
      email: "budi.combo@example.com",
      password: "not-used-in-tests",
      role: "PETUGAS",
    },
  });
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?search=Andi&role=PETUGAS&page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>>; total: number };
  assert.equal(data.total, 1);
  assert.equal(data.users.length, 1);
  assert.equal(data.users[0]?.id, match.id);
  assert.equal(data.users[0]?.role, "PETUGAS");
  assert.equal(data.users[0]?.name, "Andi Petugas");
});

test("GET /api/users: pagination page/pageSize, total, dan totalPages sesuai data", async () => {
  const admin = await createTestUser("ADMIN", "Admin Paging");
  for (let i = 1; i <= 5; i++) {
    await db.user.create({
      data: {
        name: `Warga Paging ${i}`,
        email: `paging${i}@example.com`,
        password: "not-used-in-tests",
        role: "MASYARAKAT",
      },
    });
  }
  __setTestSession(makeSession(admin));

  const resPage1 = await getUsers(
    new NextRequest("http://localhost/api/users?page=1&pageSize=2")
  );
  assert.equal(resPage1.status, 200);
  const body1 = await readJson(resPage1);
  const data1 = body1.data as {
    users: Array<Record<string, unknown>>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  assert.equal(data1.page, 1);
  assert.equal(data1.pageSize, 2);
  assert.equal(data1.total, 6); // admin + 5 warga
  assert.equal(data1.totalPages, 3);
  assert.equal(data1.users.length, 2);

  const resPage2 = await getUsers(
    new NextRequest("http://localhost/api/users?page=2&pageSize=2")
  );
  assert.equal(resPage2.status, 200);
  const body2 = await readJson(resPage2);
  const data2 = body2.data as {
    users: Array<Record<string, unknown>>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  assert.equal(data2.page, 2);
  assert.equal(data2.pageSize, 2);
  assert.equal(data2.total, 6);
  assert.equal(data2.totalPages, 3);
  assert.equal(data2.users.length, 2);

  const ids1 = new Set(data1.users.map((u) => u.id));
  const ids2 = new Set(data2.users.map((u) => u.id));
  for (const id of ids1) {
    assert.equal(ids2.has(id as string), false, "item page 2 tidak boleh duplikat page 1");
  }
});

test("GET /api/users: akun sistem/tombstone tidak muncul dan total mengikuti filter endpoint", async () => {
  const admin = await createTestUser("ADMIN", "Admin Tombstone");
  await db.user.create({
    data: {
      name: DELETED_USER_NAME,
      email: DELETED_USER_EMAIL,
      password: "not-used-in-tests",
      role: "MASYARAKAT",
      isActive: false,
    },
  });
  const warga = await createTestUser("MASYARAKAT", "Warga Aktif");
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>>; total: number };
  // total = admin + warga (tombstone dikecualikan oleh where email != DELETED_USER_EMAIL)
  assert.equal(data.total, 2);
  assert.ok(data.users.every((u) => u.email !== DELETED_USER_EMAIL));
  assert.ok(data.users.some((u) => u.id === warga.id));
});

test("GET /api/users: response tidak mengekspos password/hash/data autentikasi internal/relasi WA mentah", async () => {
  const admin = await createTestUser("ADMIN", "Admin Sensitive");
  const user = await db.user.create({
    data: {
      name: "User WA",
      email: "wa-sensitive@example.com",
      password: "plain-should-not-leak",
      role: "MASYARAKAT",
    },
  });
  await db.whatsappLink.create({
    data: { userId: user.id, phoneNumber: "6281234567890" },
  });
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>> };
  const listed = data.users.find((u) => u.id === user.id);
  assert.ok(listed, "user target harus ada di daftar");

  const serialized = JSON.stringify(body);
  assert.equal(serialized.includes("plain-should-not-leak"), false);
  assert.equal("password" in listed, false);
  assert.equal("whatsappLink" in listed, false);
  assert.equal("whatsappRegistrations" in listed, false);
  // field aman yang memang dikontrak
  assert.equal(typeof listed.whatsappConnected, "boolean");
  assert.ok("whatsappPhoneNumber" in listed);
});

test("GET /api/users: WhatsappLink -> whatsappConnected true dan nomor dimasker (nomor asli tidak terekspos)", async () => {
  const admin = await createTestUser("ADMIN", "Admin Mask");
  const user = await db.user.create({
    data: {
      name: "User Masked",
      email: "masked@example.com",
      password: "not-used-in-tests",
      role: "MASYARAKAT",
    },
  });
  const rawPhone = "6281234567890";
  await db.whatsappLink.create({
    data: { userId: user.id, phoneNumber: rawPhone },
  });
  __setTestSession(makeSession(admin));

  const res = await getUsers(
    new NextRequest("http://localhost/api/users?page=1&pageSize=20")
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  const data = body.data as { users: Array<Record<string, unknown>> };
  const listed = data.users.find((u) => u.id === user.id);
  assert.ok(listed);

  assert.equal(listed.whatsappConnected, true);
  assert.equal(typeof listed.whatsappPhoneNumber, "string");
  const masked = listed.whatsappPhoneNumber as string;
  assert.equal(masked, "+62\u2022\u2022\u2022\u2022\u2022\u20227890");
  assert.equal(masked.includes("81234567"), false);
  assert.equal(JSON.stringify(body).includes(rawPhone), false);
});

// --- B1.1b: DELETE /api/users/[id] (regresi, perilaku aktual) ---

async function createFacilityType(name = "Jalan") {
  return db.facilityType.create({
    data: { name: `${name}-${Math.random().toString(36).slice(2, 8)}` },
  });
}

async function createReportForUser(
  userId: string,
  overrides: { facilityTypeId?: string; assignedTo?: string | null } = {}
) {
  const facilityTypeId =
    overrides.facilityTypeId ?? (await createFacilityType()).id;
  return db.report.create({
    data: {
      title: "Laporan Uji",
      description: "Deskripsi uji",
      address: "Jl. Uji No. 1",
      userId,
      facilityTypeId,
      assignedTo: overrides.assignedTo ?? null,
    },
  });
}

function deleteCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

test("DELETE /api/users/[id]: tanpa session -> 401, target tidak berubah", async () => {
  const target = await createTestUser("MASYARAKAT", "Target No Session");
  __setTestSession(null);

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${target.id}`, { method: "DELETE" }),
    deleteCtx(target.id)
  );

  assert.equal(res.status, 401);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
  assert.ok(await db.user.findUnique({ where: { id: target.id } }));
});

test("DELETE /api/users/[id]: MASYARAKAT ditolak -> 403, target tidak berubah", async () => {
  const actor = await createTestUser("MASYARAKAT", "Actor Warga");
  const target = await createTestUser("MASYARAKAT", "Target Warga");
  __setTestSession(makeSession(actor));

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${target.id}`, { method: "DELETE" }),
    deleteCtx(target.id)
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Akses ditolak. Hanya Admin yang dapat menghapus pengguna.");
  assert.ok(await db.user.findUnique({ where: { id: target.id } }));
});

test("DELETE /api/users/[id]: PETUGAS ditolak -> 403, target tidak berubah", async () => {
  const actor = await createTestUser("PETUGAS", "Actor Petugas");
  const target = await createTestUser("MASYARAKAT", "Target Dari Petugas");
  __setTestSession(makeSession(actor));

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${target.id}`, { method: "DELETE" }),
    deleteCtx(target.id)
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Akses ditolak. Hanya Admin yang dapat menghapus pengguna.");
  assert.ok(await db.user.findUnique({ where: { id: target.id } }));
});

test("DELETE /api/users/[id]: ID tidak ditemukan -> 404, data lain tidak berubah", async () => {
  const admin = await createTestUser("ADMIN", "Admin 404");
  const other = await createTestUser("MASYARAKAT", "Other Tetap");
  __setTestSession(makeSession(admin));

  const res = await deleteUser(
    new NextRequest("http://localhost/api/users/tidak-ada-id", { method: "DELETE" }),
    deleteCtx("tidak-ada-id")
  );

  assert.equal(res.status, 404);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Pengguna tidak ditemukan");
  assert.ok(await db.user.findUnique({ where: { id: other.id } }));
});

test("DELETE /api/users/[id]: ADMIN menghapus akun sendiri -> 400, akun tetap ada", async () => {
  const admin = await createTestUser("ADMIN", "Admin Self");
  __setTestSession(makeSession(admin));

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${admin.id}`, { method: "DELETE" }),
    deleteCtx(admin.id)
  );

  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Tidak dapat menghapus akun Anda sendiri.");
  assert.ok(await db.user.findUnique({ where: { id: admin.id } }));
});

test("DELETE /api/users/[id]: menghapus akun tombstone -> 400, tombstone tetap ada", async () => {
  const admin = await createTestUser("ADMIN", "Admin Tomb");
  const tombstone = await db.user.create({
    data: {
      name: DELETED_USER_NAME,
      email: DELETED_USER_EMAIL,
      password: "not-used-in-tests",
      role: "MASYARAKAT",
      isActive: false,
    },
  });
  __setTestSession(makeSession(admin));

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${tombstone.id}`, { method: "DELETE" }),
    deleteCtx(tombstone.id)
  );

  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Akun sistem tidak dapat dihapus.");
  assert.ok(await db.user.findUnique({ where: { id: tombstone.id } }));
});

test("DELETE /api/users/[id]: admin tunggal (count ADMIN <= 1) ditolak -> 400, target & data tetap utuh", async () => {
  // Perilaku aktual: jika target ber-role ADMIN dan total ADMIN di DB <= 1, ditolak.
  // Session aktor berbeda id (role ADMIN) agar tidak terkena self-delete.
  const soleAdmin = await createTestUser("ADMIN", "Satu-satunya Admin");
  const relatedReport = await createReportForUser(soleAdmin.id);
  __setTestSession(
    makeSession({
      id: "aktor-admin-lain-id",
      role: "ADMIN",
      name: "Aktor",
      email: "aktor@example.com",
    })
  );

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${soleAdmin.id}`, { method: "DELETE" }),
    deleteCtx(soleAdmin.id)
  );

  assert.equal(res.status, 400);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Tidak dapat menghapus Admin tunggal. Minimal harus ada 1 Admin.");
  assert.ok(await db.user.findUnique({ where: { id: soleAdmin.id } }));
  assert.ok(await db.report.findUnique({ where: { id: relatedReport.id } }));
});

test("DELETE /api/users/[id]: ADMIN berhasil hapus non-ADMIN -> 200, target hilang, response sesuai", async () => {
  const admin = await createTestUser("ADMIN", "Admin Deleter");
  const target = await createTestUser("MASYARAKAT", "Target Hapus");
  __setTestSession(makeSession(admin));

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${target.id}`, { method: "DELETE" }),
    deleteCtx(target.id)
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  assert.equal(body.message, `Pengguna ${target.name} berhasil dihapus.`);
  assert.equal(await db.user.findUnique({ where: { id: target.id } }), null);
});

test("DELETE /api/users/[id]: laporan milik user terhapus tetap tersimpan & userId dialihkan ke tombstone", async () => {
  const admin = await createTestUser("ADMIN", "Admin Report");
  const target = await createTestUser("MASYARAKAT", "Pelapor Hapus");
  const report = await createReportForUser(target.id);
  __setTestSession(makeSession(admin));

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${target.id}`, { method: "DELETE" }),
    deleteCtx(target.id)
  );

  assert.equal(res.status, 200);
  const keptReport = await db.report.findUnique({ where: { id: report.id } });
  assert.ok(keptReport, "laporan tidak boleh ikut terhapus");
  assert.notEqual(keptReport.userId, target.id);

  const tombstone = await db.user.findUnique({
    where: { email: DELETED_USER_EMAIL },
  });
  assert.ok(tombstone, "tombstone harus dibuat/digunakan");
  assert.equal(keptReport.userId, tombstone.id);
  assert.equal(tombstone.email, DELETED_USER_EMAIL);
  assert.equal(tombstone.name, DELETED_USER_NAME);
  assert.equal(tombstone.isActive, false);
});

test("DELETE /api/users/[id]: riwayat status tetap terpelihara & updatedById dialihkan ke tombstone", async () => {
  const admin = await createTestUser("ADMIN", "Admin History");
  const author = await createTestUser("PETUGAS", "Penulis Riwayat");
  const target = await createTestUser("MASYARAKAT", "Pemilik Laporan");
  const report = await createReportForUser(target.id);

  // Riwayat yang dibuat oleh user yang akan dihapus (updatedById = author)
  const history = await db.reportStatusHistory.create({
    data: {
      reportId: report.id,
      status: "MENUNGGU_VERIFIKASI",
      note: "catatan awal",
      updatedById: author.id,
    },
  });
  __setTestSession(makeSession(admin));

  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${author.id}`, { method: "DELETE" }),
    deleteCtx(author.id)
  );

  assert.equal(res.status, 200);
  const keptHistory = await db.reportStatusHistory.findUnique({
    where: { id: history.id },
  });
  assert.ok(keptHistory, "riwayat tidak boleh ikut terhapus");
  assert.notEqual(keptHistory.updatedById, author.id);

  const tombstone = await db.user.findUnique({
    where: { email: DELETED_USER_EMAIL },
  });
  assert.ok(tombstone);
  assert.equal(keptHistory.updatedById, tombstone.id);
  // laporan milik user lain (target) tidak dialihkan userId-nya
  const keptReport = await db.report.findUnique({ where: { id: report.id } });
  assert.equal(keptReport?.userId, target.id);
});

test("DELETE /api/users/[id]: relasi penugasan & pemeriksaan duplikat sesuai perilaku aktual (DB)", async () => {
  const admin = await createTestUser("ADMIN", "Admin Relasi");
  const assignee = await createTestUser("PETUGAS", "Petugas Ditugaskan");
  const reviewer = await createTestUser("PETUGAS", "Reviewer Duplikat");
  const reporter = await createTestUser("MASYARAKAT", "Pelapor Relasi");
  const facilityType = await createFacilityType("FasilitasRelasi");

  const assignedReport = await createReportForUser(reporter.id, {
    facilityTypeId: facilityType.id,
    assignedTo: assignee.id,
  });

  // Dua laporan untuk pasangan analisis duplikat (reviewedBy = reviewer)
  const dupReportA = await createReportForUser(reporter.id, { facilityTypeId: facilityType.id });
  const dupReportB = await createReportForUser(reporter.id, { facilityTypeId: facilityType.id });
  const analysis = await db.reportDuplicateAnalysis.create({
    data: {
      reportId: dupReportA.id,
      candidateReportId: dupReportB.id,
      reviewedBy: reviewer.id,
      similarityScore: 0.9,
      isPotential: true,
    },
  });

  // Hapus petugas yang menjadi assignee -> assignedTo harus null (DB SetNull, perilaku aktual)
  __setTestSession(makeSession(admin));
  const resAssignee = await deleteUser(
    new NextRequest(`http://localhost/api/users/${assignee.id}`, { method: "DELETE" }),
    deleteCtx(assignee.id)
  );
  assert.equal(resAssignee.status, 200);
  const reportAfterAssignee = await db.report.findUnique({ where: { id: assignedReport.id } });
  assert.equal(reportAfterAssignee?.assignedTo, null);

  // Hapus reviewer duplikat -> reviewedBy harus null (DB SetNull, perilaku aktual)
  const resReviewer = await deleteUser(
    new NextRequest(`http://localhost/api/users/${reviewer.id}`, { method: "DELETE" }),
    deleteCtx(reviewer.id)
  );
  assert.equal(resReviewer.status, 200);
  const analysisAfter = await db.reportDuplicateAnalysis.findUnique({ where: { id: analysis.id } });
  assert.equal(analysisAfter?.reviewedBy, null);
  assert.ok(await db.report.findUnique({ where: { id: dupReportA.id } }));
  assert.ok(await db.report.findUnique({ where: { id: dupReportB.id } }));
});

test("DELETE /api/users/[id]: relasi WhatsApp & outbox ditangani sesuai implementasi/transaksi aktual", async () => {
  const admin = await createTestUser("ADMIN", "Admin WA");
  const target = await createTestUser("MASYARAKAT", "Target WA");
  const other = await createTestUser("MASYARAKAT", "Other WA");

  await db.whatsappLink.create({
    data: { userId: target.id, phoneNumber: "6281112223334" },
  });
  const reg = await db.whatsappRegistration.create({
    data: { userId: target.id, phoneNumber: "6281112223334", status: "PENDING" },
  });
  await db.whatsappOtp.create({
    data: {
      registrationId: reg.id,
      otpHash: "hash-uji",
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  await db.whatsappOutbox.create({
    data: {
      dedupeKey: `dedupe-${target.id}`,
      phoneNumber: "6281112223334",
      message: "pesan target",
      userId: target.id,
    },
  });
  const otherOutbox = await db.whatsappOutbox.create({
    data: {
      dedupeKey: `dedupe-${other.id}`,
      phoneNumber: "6289998887776",
      message: "pesan other",
      userId: other.id,
    },
  });

  __setTestSession(makeSession(admin));
  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${target.id}`, { method: "DELETE" }),
    deleteCtx(target.id)
  );

  assert.equal(res.status, 200);
  // Dihapus manual dalam transaksi
  assert.equal(await db.whatsappOutbox.count({ where: { userId: target.id } }), 0);
  // Cascade DB saat user dihapus
  assert.equal(await db.whatsappLink.count({ where: { userId: target.id } }), 0);
  assert.equal(await db.whatsappRegistration.count({ where: { userId: target.id } }), 0);
  assert.equal(await db.whatsappOtp.count({ where: { registrationId: reg.id } }), 0);
  // Data milik pengguna lain tetap utuh
  assert.ok(await db.whatsappOutbox.findUnique({ where: { id: otherOutbox.id } }));
  assert.ok(await db.user.findUnique({ where: { id: other.id } }));
});

test("DELETE /api/users/[id]: tidak mengganggu pengguna lain & relasinya", async () => {
  const admin = await createTestUser("ADMIN", "Admin Isolasi");
  const target = await createTestUser("MASYARAKAT", "Target Isolasi");
  const other = await createTestUser("MASYARAKAT", "Other Isolasi");
  const otherReport = await createReportForUser(other.id);
  const otherNotif = await db.notification.create({
    data: { userId: other.id, title: "N", message: "Milik other" },
  });

  __setTestSession(makeSession(admin));
  const res = await deleteUser(
    new NextRequest(`http://localhost/api/users/${target.id}`, { method: "DELETE" }),
    deleteCtx(target.id)
  );

  assert.equal(res.status, 200);
  assert.equal(await db.user.findUnique({ where: { id: target.id } }), null);

  assert.ok(await db.user.findUnique({ where: { id: other.id } }));
  const keptOtherReport = await db.report.findUnique({ where: { id: otherReport.id } });
  assert.ok(keptOtherReport);
  assert.equal(keptOtherReport.userId, other.id);
  const keptOtherNotif = await db.notification.findUnique({ where: { id: otherNotif.id } });
  assert.ok(keptOtherNotif);
  assert.equal(keptOtherNotif.userId, other.id);
});

// --- B1.1c: POST & PATCH /api/admin/users (regresi, perilaku aktual) ---

function adminUserCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const VALID_PETUGAS_PASSWORD = "Petugas123";

function postAdminUserBody(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("POST /api/admin/users: tanpa session -> 403 Forbidden (otorisasi gabungan), tidak ada user dibuat", async () => {
  __setTestSession(null);
  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas Baru",
      email: "petugas.baru@example.com",
      password: VALID_PETUGAS_PASSWORD,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Forbidden");
  assert.equal(await db.user.count(), 0);
});

test("POST /api/admin/users: MASYARAKAT ditolak -> 403 Forbidden", async () => {
  const actor = await createTestUser("MASYARAKAT", "Warga Actor");
  __setTestSession(makeSession(actor));

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas Baru",
      email: "petugas.masyarakat@example.com",
      password: VALID_PETUGAS_PASSWORD,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Forbidden");
  assert.equal(await db.user.count({ where: { email: "petugas.masyarakat@example.com" } }), 0);
});

test("POST /api/admin/users: PETUGAS ditolak -> 403 Forbidden", async () => {
  const actor = await createTestUser("PETUGAS", "Petugas Actor");
  __setTestSession(makeSession(actor));

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas Baru",
      email: "petugas.petugas@example.com",
      password: VALID_PETUGAS_PASSWORD,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Forbidden");
  assert.equal(await db.user.count({ where: { email: "petugas.petugas@example.com" } }), 0);
});

test("POST /api/admin/users: ADMIN berhasil membuat PETUGAS (201), data & response sesuai", async () => {
  const admin = await createTestUser("ADMIN", "Admin Creator");
  __setTestSession(makeSession(admin));

  const res = await createAdminUser(
    postAdminUserBody({
      name: "  Budi Petugas  ",
      email: "  BUDI.PETUGAS@Example.com  ",
      password: VALID_PETUGAS_PASSWORD,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  assert.equal(body.message, "Petugas berhasil ditambahkan");
  const data = body.data as Record<string, unknown>;
  assert.equal(data.name, "Budi Petugas");
  assert.equal(data.email, "budi.petugas@example.com");
  assert.equal(data.role, "PETUGAS");
  assert.equal(typeof data.id, "string");
  assert.ok(data.createdAt);

  const saved = await db.user.findUnique({ where: { email: "budi.petugas@example.com" } });
  assert.ok(saved);
  assert.equal(saved.role, "PETUGAS");
  assert.equal(saved.isActive, true);
  assert.equal(saved.name, "Budi Petugas");
});

test("POST /api/admin/users: password disimpan sebagai hash dan cocok via bcrypt.compare", async () => {
  const admin = await createTestUser("ADMIN", "Admin Hash");
  __setTestSession(makeSession(admin));
  const plain = "Rahasia123";

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Hash User",
      email: "hash.user@example.com",
      password: plain,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 200);
  const saved = await db.user.findUnique({ where: { email: "hash.user@example.com" } });
  assert.ok(saved);
  assert.notEqual(saved.password, plain);
  assert.equal(await bcrypt.compare(plain, saved.password), true);
});

test("POST /api/admin/users: email duplikat -> 422, user lama tidak berubah & tidak ada duplikat", async () => {
  const admin = await createTestUser("ADMIN", "Admin Dup");
  const existing = await db.user.create({
    data: {
      name: "Existing User",
      email: "duplikat@example.com",
      password: "OldPassword123",
      role: "PETUGAS",
      isActive: false,
    },
  });
  __setTestSession(makeSession(admin));

  const res = await createAdminUser(
    postAdminUserBody({
      name: "User Baru",
      email: "  DUPLIKAT@Example.com ",
      password: VALID_PETUGAS_PASSWORD,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 422);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Email sudah terdaftar");
  assert.equal(await db.user.count({ where: { email: "duplikat@example.com" } }), 1);
  const after = await db.user.findUnique({ where: { id: existing.id } });
  assert.equal(after?.name, "Existing User");
  assert.equal(after?.password, "OldPassword123");
  assert.equal(after?.isActive, false);
});

test("POST /api/admin/users: email sistem/tombstone -> 422, tidak membuat user biasa", async () => {
  const admin = await createTestUser("ADMIN", "Admin Tomb Email");
  __setTestSession(makeSession(admin));

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Coba Tombstone",
      email: `  ${DELETED_USER_EMAIL}  `,
      password: VALID_PETUGAS_PASSWORD,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 422);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Email tidak dapat digunakan");
  assert.equal(await db.user.count({ where: { email: DELETED_USER_EMAIL } }), 0);
});

for (const invalid of [
  { label: "name kosong", payload: { name: "", email: "a1@example.com", password: VALID_PETUGAS_PASSWORD, role: "PETUGAS" } },
  { label: "email kosong", payload: { name: "Nama", email: "", password: VALID_PETUGAS_PASSWORD, role: "PETUGAS" } },
  { label: "password kosong", payload: { name: "Nama", email: "a3@example.com", password: "", role: "PETUGAS" } },
  { label: "role selain PETUGAS (ADMIN)", payload: { name: "Nama", email: "a4@example.com", password: VALID_PETUGAS_PASSWORD, role: "ADMIN" } },
  { label: "role selain PETUGAS (MASYARAKAT)", payload: { name: "Nama", email: "a5@example.com", password: VALID_PETUGAS_PASSWORD, role: "MASYARAKAT" } },
]) {
  test(`POST /api/admin/users: field wajib tidak lengkap/role tidak valid (${invalid.label}) -> 422, tidak ada user tercipta`, async () => {
    const admin = await createTestUser("ADMIN", "Admin Invalid");
    __setTestSession(makeSession(admin));
    const before = await db.user.count();

    const res = await createAdminUser(postAdminUserBody(invalid.payload));

    assert.equal(res.status, 422);
    const body = await readJson(res);
    assert.equal(body.success, false);
    assert.equal(body.message, "Data tidak lengkap atau role tidak valid");
    assert.equal(await db.user.count(), before);
  });
}

test("POST /api/admin/users: trim nama & normalisasi email tersimpan sesuai perilaku aktual", async () => {
  const admin = await createTestUser("ADMIN", "Admin Trim");
  __setTestSession(makeSession(admin));

  const res = await createAdminUser(
    postAdminUserBody({
      name: "   Spasi Nama   ",
      email: "   CAPS@EXAMPLE.COM   ",
      password: VALID_PETUGAS_PASSWORD,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 200);
  const saved = await db.user.findUnique({ where: { email: "caps@example.com" } });
  assert.ok(saved);
  assert.equal(saved.name, "Spasi Nama");
  assert.equal(saved.email, "caps@example.com");
});

// --- PATCH /api/admin/users/[id] ---

test("PATCH /api/admin/users/[id]: tanpa session -> 403 Forbidden (otorisasi gabungan)", async () => {
  const target = await createTestUser("PETUGAS", "Target Patch NoSess");
  __setTestSession(null);

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Forbidden");
  const after = await db.user.findUnique({ where: { id: target.id } });
  assert.equal(after?.isActive, true);
});

test("PATCH /api/admin/users/[id]: MASYARAKAT ditolak -> 403 Forbidden", async () => {
  const actor = await createTestUser("MASYARAKAT", "Warga Patch");
  const target = await createTestUser("PETUGAS", "Target Patch Warga");
  __setTestSession(makeSession(actor));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.message, "Forbidden");
  assert.equal((await db.user.findUnique({ where: { id: target.id } }))?.isActive, true);
});

test("PATCH /api/admin/users/[id]: PETUGAS ditolak -> 403 Forbidden", async () => {
  const actor = await createTestUser("PETUGAS", "Petugas Patch");
  const target = await createTestUser("MASYARAKAT", "Target Patch Pet");
  __setTestSession(makeSession(actor));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.message, "Forbidden");
  assert.equal((await db.user.findUnique({ where: { id: target.id } }))?.isActive, true);
});

test("PATCH /api/admin/users/[id]: ADMIN menonaktifkan PETUGAS aktif -> 200, isActive false, field lain utuh", async () => {
  const admin = await createTestUser("ADMIN", "Admin Toggle Off");
  const target = await db.user.create({
    data: {
      name: "Petugas Aktif",
      email: "petugas.aktif@example.com",
      password: "secret-hash-value",
      role: "PETUGAS",
      isActive: true,
    },
  });
  __setTestSession(makeSession(admin));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  assert.equal(body.message, "User berhasil dinonaktifkan");
  const data = body.data as Record<string, unknown>;
  assert.equal(data.id, target.id);
  assert.equal(data.isActive, false);

  const after = await db.user.findUnique({ where: { id: target.id } });
  assert.equal(after?.isActive, false);
  assert.equal(after?.name, "Petugas Aktif");
  assert.equal(after?.email, "petugas.aktif@example.com");
  assert.equal(after?.role, "PETUGAS");
  assert.equal(after?.password, "secret-hash-value");
});

test("PATCH /api/admin/users/[id]: ADMIN mengaktifkan PETUGAS nonaktif -> 200, isActive true, field lain utuh", async () => {
  const admin = await createTestUser("ADMIN", "Admin Toggle On");
  const target = await db.user.create({
    data: {
      name: "Petugas Nonaktif",
      email: "petugas.nonaktif@example.com",
      password: "secret-hash-value",
      role: "PETUGAS",
      isActive: false,
    },
  });
  __setTestSession(makeSession(admin));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  assert.equal(body.message, "User berhasil diaktifkan");
  assert.equal((body.data as Record<string, unknown>).isActive, true);

  const after = await db.user.findUnique({ where: { id: target.id } });
  assert.equal(after?.isActive, true);
  assert.equal(after?.name, "Petugas Nonaktif");
  assert.equal(after?.email, "petugas.nonaktif@example.com");
  assert.equal(after?.role, "PETUGAS");
  assert.equal(after?.password, "secret-hash-value");
});

test("PATCH /api/admin/users/[id]: perubahan hanya pada target, pengguna lain tidak berubah", async () => {
  const admin = await createTestUser("ADMIN", "Admin Scope");
  const target = await createTestUser("PETUGAS", "Target Scope");
  const other = await createTestUser("PETUGAS", "Other Scope");
  const otherBefore = await db.user.findUnique({ where: { id: other.id } });
  __setTestSession(makeSession(admin));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 200);
  assert.equal((await db.user.findUnique({ where: { id: target.id } }))?.isActive, false);
  const otherAfter = await db.user.findUnique({ where: { id: other.id } });
  assert.equal(otherAfter?.isActive, otherBefore?.isActive);
  assert.equal(otherAfter?.name, otherBefore?.name);
  assert.equal(otherAfter?.email, otherBefore?.email);
  assert.equal(otherAfter?.role, otherBefore?.role);
});

test("PATCH /api/admin/users/[id]: target tidak ditemukan -> 404", async () => {
  const admin = await createTestUser("ADMIN", "Admin 404 Patch");
  __setTestSession(makeSession(admin));

  const res = await patchAdminUser(
    new NextRequest("http://localhost/api/admin/users/tidak-ada", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    adminUserCtx("tidak-ada")
  );

  assert.equal(res.status, 404);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "User tidak ditemukan");
});

test("PATCH /api/admin/users/[id]: target role ADMIN -> 403, data ADMIN tetap utuh", async () => {
  const actor = await createTestUser("ADMIN", "Admin Actor");
  const targetAdmin = await createTestUser("ADMIN", "Target Admin");
  __setTestSession(makeSession(actor));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${targetAdmin.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    }),
    adminUserCtx(targetAdmin.id)
  );

  assert.equal(res.status, 403);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Tidak dapat mengubah status Admin");
  const after = await db.user.findUnique({ where: { id: targetAdmin.id } });
  assert.equal(after?.isActive, true);
  assert.equal(after?.role, "ADMIN");
});

for (const bad of [
  { label: "string", value: "false" },
  { label: "number", value: 0 },
  { label: "null", value: null },
]) {
  test(`PATCH /api/admin/users/[id]: isActive ${bad.label} -> 422 Payload tidak valid, status tidak berubah`, async () => {
    const admin = await createTestUser("ADMIN", "Admin Bad Payload");
    const target = await createTestUser("PETUGAS", "Target Bad Payload");
    __setTestSession(makeSession(admin));

    const res = await patchAdminUser(
      new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isActive: bad.value }),
      }),
      adminUserCtx(target.id)
    );

    assert.equal(res.status, 422);
    const body = await readJson(res);
    assert.equal(body.success, false);
    assert.equal(body.message, "Payload tidak valid");
    assert.equal((await db.user.findUnique({ where: { id: target.id } }))?.isActive, true);
  });
}

test("PATCH /api/admin/users/[id]: body kosong/tanpa isActive -> 422 Payload tidak valid (perilaku aktual)", async () => {
  const admin = await createTestUser("ADMIN", "Admin Empty Body");
  const target = await createTestUser("PETUGAS", "Target Empty Body");
  __setTestSession(makeSession(admin));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 422);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Payload tidak valid");
  assert.equal((await db.user.findUnique({ where: { id: target.id } }))?.isActive, true);
});

test("PATCH /api/admin/users/[id]: body JSON malformed -> 500 Terjadi kesalahan server (perilaku aktual catch)", async () => {
  const admin = await createTestUser("ADMIN", "Admin Malformed");
  const target = await createTestUser("PETUGAS", "Target Malformed");
  __setTestSession(makeSession(admin));

  const res = await patchAdminUser(
    new NextRequest(`http://localhost/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: "{ invalid json",
    }),
    adminUserCtx(target.id)
  );

  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Terjadi kesalahan server");
  assert.equal((await db.user.findUnique({ where: { id: target.id } }))?.isActive, true);
});

// --- B1.1e: tambahan regresi C1 (POST password policy) & C2 (GET normalisasi) ---

test("POST /api/admin/users (C1): password < 8 karakter -> 422, tidak ada akun baru", async () => {
  const admin = await createTestUser("ADMIN", "Admin C1 Short");
  __setTestSession(makeSession(admin));
  const before = await db.user.count();

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas Short",
      email: "c1.short@example.com",
      password: "Ab1defg", // 7 karakter, ada A,a,1
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 422);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Password minimal 8 karakter dan mengandung huruf kapital, huruf kecil, dan angka");
  assert.equal(await db.user.count(), before);
  assert.equal(await db.user.count({ where: { email: "c1.short@example.com" } }), 0);
});

test("POST /api/admin/users (C1): password tanpa huruf besar -> 422, tidak ada akun baru", async () => {
  const admin = await createTestUser("ADMIN", "Admin C1 NoUpper");
  __setTestSession(makeSession(admin));
  const before = await db.user.count();

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas NoUpper",
      email: "c1.noupper@example.com",
      password: "abcdefg1", // tanpa huruf besar
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 422);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Password minimal 8 karakter dan mengandung huruf kapital, huruf kecil, dan angka");
  assert.equal(await db.user.count(), before);
  assert.equal(await db.user.count({ where: { email: "c1.noupper@example.com" } }), 0);
});

test("POST /api/admin/users (C1): password tanpa huruf kecil -> 422, tidak ada akun baru", async () => {
  const admin = await createTestUser("ADMIN", "Admin C1 NoLower");
  __setTestSession(makeSession(admin));
  const before = await db.user.count();

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas NoLower",
      email: "c1.nolower@example.com",
      password: "ABCDEFG1", // tanpa huruf kecil
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 422);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Password minimal 8 karakter dan mengandung huruf kapital, huruf kecil, dan angka");
  assert.equal(await db.user.count(), before);
  assert.equal(await db.user.count({ where: { email: "c1.nolower@example.com" } }), 0);
});

test("POST /api/admin/users (C1): password tanpa angka -> 422, tidak ada akun baru", async () => {
  const admin = await createTestUser("ADMIN", "Admin C1 NoDigit");
  __setTestSession(makeSession(admin));
  const before = await db.user.count();

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas NoDigit",
      email: "c1.nodigit@example.com",
      password: "Abcdefgh", // tanpa angka
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 422);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Password minimal 8 karakter dan mengandung huruf kapital, huruf kecil, dan angka");
  assert.equal(await db.user.count(), before);
  assert.equal(await db.user.count({ where: { email: "c1.nodigit@example.com" } }), 0);
});

test("POST /api/admin/users (C1): password tepat 8 char (batas) valid -> sukses, hash tersimpan & terverifikasi", async () => {
  const admin = await createTestUser("ADMIN", "Admin C1 Boundary");
  __setTestSession(makeSession(admin));
  const plain = "Abcdefg1"; // tepat 8, ada A, a, 1

  const res = await createAdminUser(
    postAdminUserBody({
      name: "Petugas Batas",
      email: "c1.boundary@example.com",
      password: plain,
      role: "PETUGAS",
    })
  );

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  assert.equal(body.message, "Petugas berhasil ditambahkan");
  const data = body.data as Record<string, unknown>;
  assert.equal(data.name, "Petugas Batas");
  assert.equal(data.email, "c1.boundary@example.com");
  assert.equal(data.role, "PETUGAS");

  const saved = await db.user.findUnique({ where: { email: "c1.boundary@example.com" } });
  assert.ok(saved);
  assert.equal(saved.role, "PETUGAS");
  assert.equal(saved.isActive, true);
  assert.notEqual(saved.password, plain);
  assert.equal(await bcrypt.compare(plain, saved.password), true);
});

test("GET /api/users (C2): page=0 -> hasil aktual (raw parse, skip negatif => 500)", async () => {
  const admin = await createTestUser("ADMIN", "Admin PageZero");
  await createTestUser("PETUGAS", "P1");
  await createTestUser("PETUGAS", "P2");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?page=0&pageSize=2"));

  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Terjadi kesalahan server");
});

test("GET /api/users (C2): page negatif -> hasil aktual (raw parse, skip negatif => 500)", async () => {
  const admin = await createTestUser("ADMIN", "Admin PageNeg");
  await createTestUser("PETUGAS", "P1");
  await createTestUser("PETUGAS", "P2");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?page=-5&pageSize=2"));

  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Terjadi kesalahan server");
});

test("GET /api/users (C2): page bukan angka -> hasil aktual (raw parse NaN => 500)", async () => {
  const admin = await createTestUser("ADMIN", "Admin PageNaN");
  await createTestUser("PETUGAS", "P1");
  await createTestUser("PETUGAS", "P2");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?page=abc&pageSize=2"));

  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Terjadi kesalahan server");
});

test("GET /api/users (C2): pageSize=0 -> hasil aktual (take 0, totalPages Infinity/null)", async () => {
  const admin = await createTestUser("ADMIN", "Admin SizeZero");
  await createTestUser("PETUGAS", "P1");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?pageSize=0"));

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.page, 1);
  assert.equal(data.pageSize, 0);
  assert.equal(data.total, 2);
  assert.equal(data.totalPages, null); // Math.ceil(total/0)=Infinity -> JSON null
  assert.equal((data.users as unknown[]).length, 0);
});

test("GET /api/users (C2): pageSize negatif -> hasil aktual (raw parse, take negatif diterima Prisma)", async () => {
  const admin = await createTestUser("ADMIN", "Admin SizeNeg");
  const petugas = await createTestUser("PETUGAS", "P1");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?pageSize=-3"));

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.page, 1);
  assert.equal(data.pageSize, -3);
  assert.equal(data.total, 2);
  // Math.ceil(total / pageSize) = Math.ceil(2 / -3) = -0, JSON serializes -0 as 0
  assert.equal(data.totalPages, 0);
  const ids = (data.users as Array<Record<string, unknown>>).map((u) => u.id).sort();
  assert.deepEqual(ids, [admin.id, petugas.id].sort());
});

test("GET /api/users (C2): pageSize bukan angka -> hasil aktual (raw parse NaN => 500)", async () => {
  const admin = await createTestUser("ADMIN", "Admin SizeNaN");
  await createTestUser("PETUGAS", "P1");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?pageSize=xyz"));

  assert.equal(res.status, 500);
  const body = await readJson(res);
  assert.equal(body.success, false);
  assert.equal(body.message, "Terjadi kesalahan server");
});

test("GET /api/users (C2): pageSize > 100 -> hasil aktual (tidak dibatasi, take 999)", async () => {
  const admin = await createTestUser("ADMIN", "Admin SizeCap");
  await createTestUser("PETUGAS", "P1");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?pageSize=999"));

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.page, 1);
  assert.equal(data.pageSize, 999);
  assert.equal(data.total, 2);
  assert.equal(data.totalPages, 1);
  assert.equal((data.users as unknown[]).length, 2);
});

test("GET /api/users (C2): search kosong -> hasil aktual sama seperti tanpa filter pencarian", async () => {
  const admin = await createTestUser("ADMIN", "Admin SearchEmpty");
  const petugas = await createTestUser("PETUGAS", "Petugas Empty");
  __setTestSession(makeSession(admin));

  const resNo = await getUsers(new NextRequest("http://localhost/api/users"));
  const resEmpty = await getUsers(new NextRequest("http://localhost/api/users?search="));

  assert.equal(resNo.status, 200);
  assert.equal(resEmpty.status, 200);
  const bodyNo = await readJson(resNo);
  const bodyEmpty = await readJson(resEmpty);
  assert.equal(bodyNo.success, true);
  assert.equal(bodyEmpty.success, true);
  const dataNo = bodyNo.data as Record<string, unknown>;
  const dataEmpty = bodyEmpty.data as Record<string, unknown>;
  assert.equal(dataEmpty.total, dataNo.total);
  assert.equal(dataEmpty.total, 2);
  const idsNo = (dataNo.users as Array<Record<string, unknown>>).map((u) => u.id).sort();
  const idsEmpty = (dataEmpty.users as Array<Record<string, unknown>>).map((u) => u.id).sort();
  assert.deepEqual(idsEmpty, idsNo);
  assert.ok(idsEmpty.includes(admin.id));
  assert.ok(idsEmpty.includes(petugas.id));
});

test("GET /api/users (C2): search whitespace -> hasil aktual (tidak di-trim, dipakai sebagai contains)", async () => {
  const admin = await createTestUser("ADMIN", "Admin SearchWs");
  await createTestUser("PETUGAS", "Petugas Ws");
  __setTestSession(makeSession(admin));

  const resWs = await getUsers(new NextRequest("http://localhost/api/users?search=%20%20%20"));

  assert.equal(resWs.status, 200);
  const bodyWs = await readJson(resWs);
  assert.equal(bodyWs.success, true);
  const data = bodyWs.data as Record<string, unknown>;
  assert.equal(data.total, 0);
  assert.equal(data.totalPages, 0);
  assert.deepEqual(data.users, []);
});

test("GET /api/users (C2): role tidak dikenal -> hasil aktual (filter role tidak diterapkan, semua user)", async () => {
  const admin = await createTestUser("ADMIN", "Admin UnknownRole");
  const petugas = await createTestUser("PETUGAS", "P1");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?role=SUPERADMIN&page=1&pageSize=10"));

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.page, 1);
  assert.equal(data.pageSize, 10);
  assert.equal(data.total, 2);
  assert.equal(data.totalPages, 1);
  const ids = (data.users as Array<Record<string, unknown>>).map((u) => u.id).sort();
  assert.deepEqual(ids, [admin.id, petugas.id].sort());
});

test("GET /api/users (C2): pencarian tanpa hasil -> data kosong & pagination sesuai perhitungan aktual", async () => {
  const admin = await createTestUser("ADMIN", "Admin NoResult");
  await createTestUser("PETUGAS", "P1");
  __setTestSession(makeSession(admin));

  const res = await getUsers(new NextRequest("http://localhost/api/users?search=tidak-ada-hasil-xyz&page=1&pageSize=10"));

  assert.equal(res.status, 200);
  const body = await readJson(res);
  assert.equal(body.success, true);
  const data = body.data as Record<string, unknown>;
  assert.equal(data.page, 1);
  assert.equal(data.pageSize, 10);
  assert.equal(data.total, 0);
  assert.equal(data.totalPages, 0);
  assert.deepEqual(data.users, []);
});

// =====================
// R1 — RBAC & Endpoint Access Regression (B1.3.3)
// KP-01: GET /api/reports/map wajib login
// KP-02: POST /api/reports hanya MASYARAKAT
// =====================

test("R1/KP-01 GET /api/reports/map tanpa session mengembalikan 401", async () => {
  __setTestSession(null);
  const res = await getReportsMap(new NextRequest("http://localhost/api/reports/map"));

  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.message, "Unauthorized");
});

test("R1/KP-01 GET /api/reports/map role ADMIN mengembalikan 200 dan struktur sukses", async () => {
  const admin = await createTestUser("ADMIN", "Admin Map");
  __setTestSession(makeSession(admin));

  const res = await getReportsMap(new NextRequest("http://localhost/api/reports/map"));

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
});

test("R1/KP-01 GET /api/reports/map role PETUGAS mengembalikan 200 dan struktur sukses", async () => {
  const petugas = await createTestUser("PETUGAS", "Petugas Map");
  __setTestSession(makeSession(petugas));

  const res = await getReportsMap(new NextRequest("http://localhost/api/reports/map"));

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
});

test("R1/KP-01 GET /api/reports/map role MASYARAKAT mengembalikan 200 dan struktur sukses", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Masyarakat Map");
  __setTestSession(makeSession(masyarakat));

  const res = await getReportsMap(new NextRequest("http://localhost/api/reports/map"));

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
});

test("R1/KP-02 POST /api/reports tanpa session mengembalikan 401 dan tidak ada mutasi/upload", async () => {
  __setTestSession(null);
  const uploadsBefore = snapshotUploadFiles();
  try {
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST" }));

    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Unauthorized");

    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

test("R1/KP-02 POST /api/reports role PETUGAS mengembalikan 403 sebelum upload dan mutasi DB", async () => {
  const petugas = await createTestUser("PETUGAS", "Petugas Create");
  __setTestSession(makeSession(petugas));
  const uploadsBefore = snapshotUploadFiles();
  try {
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST" }));

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Forbidden");

    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

test("R1/KP-02 POST /api/reports role ADMIN mengembalikan 403 sebelum upload dan mutasi DB", async () => {
  const admin = await createTestUser("ADMIN", "Admin Create");
  __setTestSession(makeSession(admin));
  const uploadsBefore = snapshotUploadFiles();
  try {
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST" }));

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Forbidden");

    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

test("R1/KP-02 POST /api/reports role MASYARAKAT melewati authorization gate (alternatif aman: validasi 422, tanpa mutasi/upload)", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Masyarakat Create");
  __setTestSession(makeSession(masyarakat));
  const uploadsBefore = snapshotUploadFiles();
  try {
    // Request multipart kosong/tidak valid: authz (401/403) harus sudah terlewati,
    // lalu handler gagal pada validasi payload (422) sebelum file/DB.
    // after() pipeline tidak tercapai karena tidak ada pembuatan laporan sukses.
    const form = new FormData();
    const res = await createReport(
      new NextRequest("http://localhost/api/reports", { method: "POST", body: form })
    );

    assert.notEqual(res.status, 401);
    assert.notEqual(res.status, 403);
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);

    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

// =====================
// R2.2 — POST /api/reports (MASYARAKAT) sukses & persistensi inti
// Menguji endpoint + persistensi inti (bukan pipeline). Scheduler no-op.
// =====================

interface CreatedReportResponse {
  id: string;
  title: string;
  description: string | null;
  facilityTypeId: string;
  address: string;
  status: string;
  userId: string;
}

const R2_INITIAL_UPLOAD_FILES = snapshotUploadFiles();

function createMinimalPngBytes(): Uint8Array<ArrayBuffer> {
  // PNG 1x1 RGBA transparan (valid)
  return Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 1, 0, 0, 0, 1,
    8, 6, 0, 0, 0, 31, 21, 196,
    137,
    0, 0, 0, 13, 73, 68, 65, 84,
    120, 156, 99, 0, 1, 0, 0, 5,
    0, 1, 13, 10, 45, 180,
    0, 0, 0, 0, 73, 69, 78, 68,
    174, 66, 96, 130,
  ]);
}

function createValidReportForm(facilityTypeId: string, overrides: Record<string, string | Blob> = {}) {
  const form = new FormData();
  form.set("title", "Jalan rusak parah");
  form.set("description", "Deskripsi kerusakan jalan cukup panjang untuk validasi.");
  form.set("facilityTypeId", facilityTypeId);
  form.set("address", "Jl. Contoh No. 123");
  form.set("latitude", "-6.732");
  form.set("longitude", "108.552");
  form.set("image", new File([createMinimalPngBytes()], "kerusakan.png", { type: "image/png" }));
  for (const [k, v] of Object.entries(overrides)) {
    if (v === "__DELETE__") form.delete(k);
    else form.set(k, v);
  }
  return form;
}

async function countNoopPipelineState() {
  // Pipeline (jika terpanggil) dapat membuat notifikasi/duplikat/outbox.
  return {
    notifications: await db.notification.count(),
    duplicates: await db.reportDuplicateAnalysis.count(),
    outbox: await db.whatsappOutbox.count(),
  };
}

function resolveUploadFsPath(imagePath: string) {
  const rel = imagePath.replace(/^\/+/, "");
  const full = path.resolve(process.cwd(), "public", rel);
  const base = path.resolve(process.cwd(), "public", "uploads", "reports");
  return { full, safe: full.toLowerCase().startsWith(base.toLowerCase() + path.sep) || full.toLowerCase() === base.toLowerCase() };
}

test("R2.2 POST /api/reports (MASYARAKAT, payload valid) -> 201, persistensi Report/Image/History, ownership, file, scheduler no-op", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Pelapor Sukses");
  const facilityType = await createFacilityType("JalanR2");
  __setTestSession(makeSession(masyarakat));

  let schedulerInvoked = false;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- no-op: callback pipeline sengaja tidak dijalankan
  __setReportPostSubmitScheduler((_task) => {
    // No-op: jangan menjalankan callback pipeline (task tidak dipanggil)
    schedulerInvoked = true;
  });

  const uploadsBefore = snapshotUploadFiles();
  const uploadCountBefore = uploadsBefore.size;
  let createdFileFullPath: string | null = null;

  try {
    const form = createValidReportForm(facilityType.id);
    const res = await createReport(
      new NextRequest("http://localhost/api/reports", { method: "POST", body: form })
    );

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.message, "Laporan berhasil dikirim!");
    assert.ok(body.data && typeof body.data === "object");
    assert.equal(body.aiQueued, false, "AI stub harus nonaktif (aiQueued false)");

    const data = body.data as CreatedReportResponse;
    assert.equal(typeof data.id, "string");
    assert.equal(data.title, "Jalan rusak parah");
    assert.equal(data.description, "Deskripsi kerusakan jalan cukup panjang untuk validasi.");
    assert.equal(data.facilityTypeId, facilityType.id);
    assert.equal(data.address, "Jl. Contoh No. 123");
    assert.equal(data.status, "MENUNGGU_VERIFIKASI");
    assert.equal(data.userId, masyarakat.id);

    // DB: Report
    const report = await db.report.findUnique({ where: { id: data.id } });
    assert.ok(report, "Report harus tersimpan");
    assert.equal(report.id, data.id);
    assert.equal(report.title, "Jalan rusak parah");
    assert.equal(report.description, "Deskripsi kerusakan jalan cukup panjang untuk validasi.");
    assert.equal(report.facilityTypeId, facilityType.id);
    assert.equal(report.address, "Jl. Contoh No. 123");
    assert.equal(report.status, "MENUNGGU_VERIFIKASI");
    assert.equal(report.userId, masyarakat.id);
    assert.ok(Math.abs((report.latitude ?? 0) - -6.732) < 0.0001);
    assert.ok(Math.abs((report.longitude ?? 0) - 108.552) < 0.0001);
    assert.equal(await db.report.count(), 1);

    // DB: ReportImage
    const images = await db.reportImage.findMany({ where: { reportId: data.id } });
    assert.equal(images.length, 1);
    const image = images[0];
    assert.equal(image.reportId, report.id);
    assert.equal(image.imageType, "KERUSAKAN");
    assert.equal(typeof image.imagePath, "string");
    assert.ok(image.imagePath.startsWith("/uploads/reports/"));
    // imageHash bergantung runtime/sharp; kontrak aktual: string|null (fail-open)
    assert.ok(image.imageHash === null || typeof image.imageHash === "string");

    // DB: ReportStatusHistory awal
    const histories = await db.reportStatusHistory.findMany({ where: { reportId: data.id } });
    assert.equal(histories.length, 1);
    const history = histories[0];
    assert.equal(history.reportId, report.id);
    assert.equal(history.status, "MENUNGGU_VERIFIKASI");
    assert.equal(history.note, "Laporan baru dibuat oleh masyarakat");
    assert.equal(history.updatedById, masyarakat.id);

    // Scheduler no-op: tugas pasca-submit dijadwalkan via seam tapi callback pipeline tidak dijalankan
    assert.equal(schedulerInvoked, true, "Scheduler override (seam) harus dipanggil pada jalur sukses");
    const side = await countNoopPipelineState();
    assert.equal(side.notifications, 0, "Callback pipeline tidak boleh membuat notifikasi");
    assert.equal(side.duplicates, 0, "Callback pipeline tidak boleh mempersist hasil duplikat");
    assert.equal(side.outbox, 0, "Callback pipeline tidak boleh membuat outbox WhatsApp");

    // Filesystem: file upload ada dan sesuai imagePath
    const resolved = resolveUploadFsPath(image.imagePath);
    assert.equal(resolved.safe, true, "imagePath harus berada dalam direktori upload yang diizinkan");
    createdFileFullPath = resolved.full;
    const { existsSync } = await import("node:fs");
    assert.equal(existsSync(createdFileFullPath), true, "File upload harus tersimpan di filesystem");
  } finally {
    // Hapus hanya file milik test (berdasarkan path yang tercatat dari DB/response)
    if (createdFileFullPath) {
      try {
        unlinkSync(createdFileFullPath);
      } catch {
        // fallback ke cleanup berbasis snapshot
      }
    }
    cleanupNewUploadFiles(uploadsBefore);
    __resetReportPostSubmitScheduler();
    __resetTestSession();
    // Verifikasi tidak ada file test tertinggal dan file existing terjaga
    const afterSet = snapshotUploadFiles();
    for (const name of R2_INITIAL_UPLOAD_FILES) {
      assert.ok(afterSet.has(name), `File existing tidak boleh hilang: ${name}`);
    }
    assert.equal(afterSet.size, R2_INITIAL_UPLOAD_FILES.size);
    assert.equal(uploadCountBefore, R2_INITIAL_UPLOAD_FILES.size);
  }
});

test("R2.2 POST /api/reports (MASYARAKAT) title tidak valid -> 422, tanpa mutasi DB/file", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Pelapor Title Invalid");
  const facilityType = await createFacilityType("JalanTitle");
  __setTestSession(makeSession(masyarakat));
  const uploadsBefore = snapshotUploadFiles();
  try {
    const form = createValidReportForm(facilityType.id, { title: "Abc" }); // < 5
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST", body: form }));
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

test("R2.2 POST /api/reports (MASYARAKAT) description tidak valid -> 422, tanpa mutasi DB/file", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Pelapor Desc Invalid");
  const facilityType = await createFacilityType("JalanDesc");
  __setTestSession(makeSession(masyarakat));
  const uploadsBefore = snapshotUploadFiles();
  try {
    const form = createValidReportForm(facilityType.id, { description: "Pendek" }); // < 10
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST", body: form }));
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

test("R2.2 POST /api/reports (MASYARAKAT) image tidak diberikan -> 422, tanpa mutasi DB/file", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Pelapor No Image");
  const facilityType = await createFacilityType("JalanNoImg");
  __setTestSession(makeSession(masyarakat));
  const uploadsBefore = snapshotUploadFiles();
  try {
    const form = createValidReportForm(facilityType.id);
    form.delete("image");
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST", body: form }));
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Foto kerusakan wajib diunggah");
    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

test("R2.2 POST /api/reports (MASYARAKAT) MIME image tidak diterima -> 422, tanpa mutasi DB/file", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Pelapor Bad Mime");
  const facilityType = await createFacilityType("JalanMime");
  __setTestSession(makeSession(masyarakat));
  const uploadsBefore = snapshotUploadFiles();
  try {
    const form = createValidReportForm(facilityType.id, {
      image: new File([createMinimalPngBytes()], "kerusakan.gif", { type: "image/gif" }),
    });
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST", body: form }));
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Format foto harus JPG atau PNG");
    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});

test("R2.2 POST /api/reports (MASYARAKAT) image melebihi 5MB -> 422, tanpa mutasi DB/file", async () => {
  const masyarakat = await createTestUser("MASYARAKAT", "Pelapor Big File");
  const facilityType = await createFacilityType("JalanBig");
  __setTestSession(makeSession(masyarakat));
  const uploadsBefore = snapshotUploadFiles();
  try {
    const big = new Uint8Array(5 * 1024 * 1024 + 1) as Uint8Array<ArrayBuffer>;
    const form = createValidReportForm(facilityType.id, {
      image: new File([big], "besar.png", { type: "image/png" }),
    });
    const res = await createReport(new NextRequest("http://localhost/api/reports", { method: "POST", body: form }));
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, "Ukuran foto maksimal 5MB");
    assert.equal(await db.report.count(), 0);
    assert.equal(await db.reportImage.count(), 0);
    assert.equal(await db.reportStatusHistory.count(), 0);
  } finally {
    cleanupNewUploadFiles(uploadsBefore);
  }
});
