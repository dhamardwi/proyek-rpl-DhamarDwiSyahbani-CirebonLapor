/**
 * Chatbot DB Context — read-only.
 *
 * Memberi AI asisten akses baca ke isi database AKTUAL (agregat + laporan
 * yang boleh dilihat user) TANPA mengubah kemampuan stabil yang sudah ada:
 * - Hanya SELECT, tidak pernah write.
 * - Fail-open: jika DB gagal, kembalikan "" agar chatbot tetap jalan dengan
 *   fallback/system prompt bawaan.
 * - Privasi per peran: MASYARAKAT hanya melihat laporannya sendiri,
 *   PETUGAS melihat tugasnya + agregat umum, ADMIN melihat agregat global.
 */

import db from "@/lib/db";
import { DELETED_USER_EMAIL } from "@/lib/constants";

const MAX_ITEMS = 5;
const MAX_CONTEXT_CHARS = 3000;

export type ChatbotRole = "MASYARAKAT" | "PETUGAS" | "ADMIN";

const ROLE_LABELS: Record<string, string> = {
  MASYARAKAT: "Masyarakat",
  PETUGAS: "Petugas",
  ADMIN: "Admin",
};

/** Pekerjaan chatbot untuk masing-masing peran. */
const CHATBOT_DUTIES: Record<ChatbotRole, string> = {
  ADMIN:
    "memantau seluruh laporan, memverifikasi laporan, menugaskan petugas, dan melihat data pengguna",
  PETUGAS:
    "melihat daftar tugas, status penanganan, dan prioritas tugas yang ditugaskan kepada Anda",
  MASYARAKAT:
    "membuat laporan, memantau status laporan Anda, dan melihat notifikasi",
};

export interface ChatbotDbItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  facility: string;
  assignee: string | null;
  createdAt: Date;
}

export interface ChatbotProfile {
  name: string;
  email: string;
  role: ChatbotRole;
  isActive: boolean;
  joinedAt: Date;
  reportCount: number;
  taskCount: number;
  unreadNotifications: number;
  /** Hanya relevan untuk MASYARAKAT; integrasi WhatsApp tidak tersedia untuk ADMIN/PETUGAS. */
  whatsappConnected?: boolean;
}

export interface ChatbotAdminStats {
  totalUsers: number;
  activeUsers: number;
  usersByRole: { role: string; count: number }[];
  verifiedUnassigned: number;
}

export interface ChatbotDbData {
  profile: ChatbotProfile | null;
  admin: ChatbotAdminStats | null;
  total: number;
  menunggu: number;
  selesai: number;
  kritis: number;
  /** Laporan milik user (MASYARAKAT). */
  mine: ChatbotDbItem[];
  /** Tugas milik petugas (PETUGAS). */
  tasks: ChatbotDbItem[];
  byStatus: { status: string; count: number }[];
  /** Jumlah laporan milik user per status (MASYARAKAT). */
  mineByStatus: { status: string; count: number }[];
  /** Jumlah tugas milik petugas per status (PETUGAS). */
  taskByStatus: { status: string; count: number }[];
  /** Jumlah laporan per prioritas (agregat global). */
  byPriority?: { priority: string; count: number }[];
  /** Jumlah laporan milik user per prioritas (MASYARAKAT). */
  mineByPriority?: { priority: string; count: number }[];
  /** Jumlah tugas milik petugas per prioritas (PETUGAS). */
  taskByPriority?: { priority: string; count: number }[];
  /** Jumlah laporan per jenis fasilitas (agregat global). */
  facilityTypes: { name: string; reports: number }[];
  /** Notifikasi terbaru milik user (MASYARAKAT). */
  myNotifications: { title: string; isRead: boolean }[];
  /** Laporan terbaru desa (hanya bila pesan user menanyakan data). */
  recent: { title: string; status: string; priority: string; damageLevel: string; facility: string }[] | null;
}

/**
 * Status "Sudah Diverifikasi" pada dashboard admin = laporan yang diterima
 * (lolos verifikasi). Konsisten dengan kartu "Sudah Diverifikasi" (DITERIMA).
 */
const VERIFIED_STATUSES = ["DITERIMA"];

/** Status "Sedang Diproses" pada dashboard admin = sedang diperbaiki. */
const IN_PROGRESS_STATUSES = ["SEDANG_DIPERBAIKI"];

/** Jumlahkan count untuk status tertentu dari hasil groupBy. */
function countStatuses(
  rows: { status: string; count: number }[],
  statuses: string[]
): number {
  return rows
    .filter((row) => statuses.includes(row.status))
    .reduce((sum, row) => sum + row.count, 0);
}

function countPriorities(
  rows: { priority: string; count: number }[],
  priorities: string[]
): number {
  return rows
    .filter((row) => priorities.includes(row.priority))
    .reduce((sum, row) => sum + row.count, 0);
}

function safeText(value: unknown, max = 120): string {
  if (typeof value !== "string") return "-";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

export function wantsDbData(message: string): boolean {
  return /lapor|status|berapa|statistik|data|tugas|kritis|berat|prioritas|progres|perkembangan|peta|fasilitas|punya|jumlah|total|rekap|notif|pemberitahuan|kategori|jenis|profil|nama|email|akun|pengguna|user|whatsapp/.test(
    message.toLowerCase()
  );
}

/** Ambil data DB terstruktur. Kembalikan null bila DB gagal (fail-open). */
export async function getChatbotDbData(
  userId: string,
  role: ChatbotRole,
  lastUserMessage: string
): Promise<ChatbotDbData | null> {
  try {
    const withRecent = wantsDbData(lastUserMessage);

    // --- Hitung total/menunggu/selesai/kritis berdasarkan role ---
    let total, menunggu, selesai, kritis;
    let byStatusRows: { status: string; count: number }[];

    if (role === "ADMIN") {
      total = await db.report.count();
      menunggu = await db.report.count({ where: { status: "MENUNGGU_VERIFIKASI" } });
      selesai = await db.report.count({ where: { status: "SELESAI" } });
      kritis = await db.report.count({ where: { priority: "KRITIS" } });
      byStatusRows = (await db.report.groupBy({ by: ["status"], _count: { status: true } })).map(
        (s) => ({ status: s.status, count: s._count.status })
      );
    } else if (role === "PETUGAS") {
      const assignedTo = userId;
      total = await db.report.count({ where: { assignedTo: assignedTo } });
      menunggu = await db.report.count({
        where: { assignedTo: assignedTo, status: "MENUNGGU_VERIFIKASI" },
      });
      selesai = await db.report.count({
        where: { assignedTo: assignedTo, status: "SELESAI" },
      });
      kritis = await db.report.count({
        where: { assignedTo: assignedTo, priority: "KRITIS" },
      });
      byStatusRows = (await db.report.groupBy({
        by: ["status"],
        where: { assignedTo: assignedTo },
        _count: { status: true },
      })).map((s) => ({ status: s.status, count: s._count.status }));
    } else {
      // Masyarakah
      total = await db.report.count({ where: { userId } });
      menunggu = await db.report.count({
        where: { userId, status: "MENUNGGU_VERIFIKASI" },
      });
      selesai = await db.report.count({
        where: { userId, status: "SELESAI" },
      });
      kritis = await db.report.count({
        where: { userId, priority: "KRITIS" },
      });
      byStatusRows = (await db.report.groupBy({
        by: ["status"],
        where: { userId },
        _count: { status: true },
      })).map((s) => ({ status: s.status, count: s._count.status }));
    }

    const [mine, tasks, recent, facilityTypes, myNotifications] = await Promise.all([
      role === "MASYARAKAT"
        ? db.report.findMany({
            where: { userId },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
              facilityType: { select: { name: true } },
              assignee: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: MAX_ITEMS,
          }).then((rows) =>
            rows.map((r) => ({
              id: r.id,
              title: r.title,
              status: r.status,
              priority: r.priority,
              facility: r.facilityType.name,
              assignee: r.assignee?.name ?? null,
              createdAt: r.createdAt,
            }))
          )
        : Promise.resolve([]),
      role === "PETUGAS"
        ? db.report.findMany({
            where: { assignedTo: userId },
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              createdAt: true,
              facilityType: { select: { name: true } },
              assignee: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: MAX_ITEMS,
          }).then((rows) =>
            rows.map((r) => ({
              id: r.id,
              title: r.title,
              status: r.status,
              priority: r.priority,
              facility: r.facilityType.name,
              assignee: r.assignee?.name ?? null,
              createdAt: r.createdAt,
            }))
          )
        : Promise.resolve([]),
      withRecent
        ? db.report.findMany({
            select: {
              title: true,
              status: true,
              priority: true,
              damageLevel: true,
              facilityType: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: MAX_ITEMS,
          })
        : Promise.resolve(null),
      db.facilityType.findMany({
        select: { name: true, _count: { select: { reports: true } } },
        orderBy: { name: "asc" },
      }),
      role === "MASYARAKAT"
        ? db.notification.findMany({
            where: { userId },
            select: { title: true, isRead: true },
            orderBy: { createdAt: "desc" },
            take: MAX_ITEMS,
          })
        : Promise.resolve([]),
    ]);

    const [mineByStatusRows, taskByStatusRows] = await Promise.all([
      role === "MASYARAKAT"
        ? (await db.report.groupBy({
            by: ["status"],
            where: { userId },
            _count: { status: true },
          })).map((s) => ({ status: s.status, count: s._count.status }))
        : Promise.resolve([]),
      role === "PETUGAS"
        ? (await db.report.groupBy({
            by: ["status"],
            where: { assignedTo: userId },
            _count: { status: true },
          })).map((s) => ({ status: s.status, count: s._count.status }))
        : Promise.resolve([]),
    ]);

    const [byPriority, mineByPriorityRows, taskByPriorityRows] = await Promise.all([
      (await db.report.groupBy({ by: ["priority"], _count: { priority: true } })).map(
        (s) => ({ priority: s.priority, count: s._count.priority })
      ),
      role === "MASYARAKAT"
        ? (await db.report.groupBy({
            by: ["priority"],
            where: { userId },
            _count: { priority: true },
          })).map((s) => ({ priority: s.priority, count: s._count.priority }))
        : Promise.resolve([]),
      role === "PETUGAS"
        ? (await db.report.groupBy({
            by: ["priority"],
            where: { assignedTo: userId },
            _count: { priority: true },
          })).map((s) => ({ priority: s.priority, count: s._count.priority }))
        : Promise.resolve([]),
    ]);

    const [profileRow, unreadNotifications] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          ...(role === "MASYARAKAT"
            ? { whatsappLink: { select: { id: true } } }
            : {}),
          _count: { select: { reports: true, assignments: true } },
        },
      }),
      db.notification.count({ where: { userId, isRead: false } }),
    ]);

    const profile: ChatbotProfile | null = profileRow
      ? {
          name: profileRow.name,
          email: profileRow.email,
          role,
          isActive: profileRow.isActive,
          joinedAt: profileRow.createdAt,
          reportCount: profileRow._count.reports,
          taskCount: profileRow._count.assignments,
          unreadNotifications,
          ...(role === "MASYARAKAT"
            ? {
                whatsappConnected: Boolean(
                  (profileRow as { whatsappLink?: { id: string } | null }).whatsappLink
                ),
              }
            : {}),
        }
      : null;

    const admin: ChatbotAdminStats | null =
      role === "ADMIN"
        ? await Promise.all([
            db.user.count({ where: { email: { not: DELETED_USER_EMAIL } } }),
            db.user.count({ where: { isActive: true, email: { not: DELETED_USER_EMAIL } } }),
            db.user.groupBy({
              by: ["role"],
              where: { isActive: true },
              _count: { role: true },
            }),
            db.report.count({ where: { status: "DITERIMA", assignedTo: null } }),
          ]).then(([totalUsers, activeUsers, usersByRole, verifiedUnassigned]) => ({
            totalUsers,
            activeUsers,
            usersByRole: usersByRole.map((row) => ({
              role: row.role,
              count: row._count.role,
            })),
            verifiedUnassigned,
          }))
        : null;

    return {
      profile,
      admin,
      total,
      menunggu,
      selesai,
      kritis,
      mine,
      tasks,
      byStatus: byStatusRows.map((s) => ({ status: s.status, count: s.count })),
      mineByStatus: mineByStatusRows.map((s) => ({
        status: s.status,
        count: s.count,
      })),
      taskByStatus: taskByStatusRows.map((s) => ({
        status: s.status,
        count: s.count,
      })),
      byPriority: byPriority.map((s) => ({
        priority: s.priority,
        count: s.count,
      })),
      mineByPriority: mineByPriorityRows.map((s) => ({
        priority: s.priority,
        count: s.count,
      })),
      taskByPriority: taskByPriorityRows.map((s) => ({
        priority: s.priority,
        count: s.count,
      })),
      facilityTypes: facilityTypes.map((f) => ({
        name: f.name,
        reports: f._count.reports,
      })),
      myNotifications,
      recent: recent
        ? recent.map((r) => ({
            title: r.title,
            status: r.status,
            priority: r.priority,
            damageLevel: r.damageLevel,
            facility: r.facilityType.name,
          }))
        : null,
    };
  } catch (error) {
    console.error("[CHATBOT_CONTEXT_ERROR]", error);
    return null;
  }
}

/** Format data terstruktur menjadi konteks teks untuk system prompt. */
export function formatDbContext(data: ChatbotDbData, role: ChatbotRole): string {
  const lines: string[] = [
    `[KONTEKS DATABASE AKTUAL - ${new Date().toLocaleString("id-ID")}]`,
  ];

  if (data.profile) {
    const p = data.profile;
    const whatsappInfo =
      p.role === "MASYARAKAT"
        ? ` | WhatsApp: ${p.whatsappConnected ? "terhubung" : "belum terhubung"}`
        : "";
    lines.push(
      "[PROFIL PENGGUNA]",
      `Nama: ${safeText(p.name, 80)}`,
      `Email: ${safeText(p.email, 120)}`,
      `Peran: ${ROLE_LABELS[p.role] ?? p.role}`,
      `Status akun: ${p.isActive ? "aktif" : "nonaktif"}`,
      `Bergabung sejak: ${p.joinedAt.toLocaleDateString("id-ID")}`,
      `Jumlah laporan dibuat: ${p.reportCount} | Tugas ditugaskan: ${p.taskCount}` +
        ` | Notifikasi belum dibaca: ${p.unreadNotifications}` +
        whatsappInfo +
        "."
    );
  }

  const ditolak = countStatuses(data.byStatus, ["DITOLAK"]);
  const diverifikasi = countStatuses(data.byStatus, VERIFIED_STATUSES);
  const diproses = countStatuses(data.byStatus, IN_PROGRESS_STATUSES);
  const prioritasTinggiGabungan = countPriorities(data.byPriority ?? [], ["TINGGI", "KRITIS"]);
  const prioritasTinggiSaja = countPriorities(data.byPriority ?? [], ["TINGGI"]);

  if (role === "PETUGAS") {
    const tugasBaru = countStatuses(data.byStatus, ["DITUGASKAN"]);
    const tugasAktif = Math.max(0, data.total - data.selesai);
    lines.push(
      `Total penugasan: ${data.total}. ` +
        `Tugas baru (DITUGASKAN): ${tugasBaru}. ` +
        `Sedang diproses (SEDANG_DIPERBAIKI): ${diproses}. ` +
        `Selesai: ${data.selesai}. ` +
        `Tugas aktif/belum selesai: ${tugasAktif}.`
    );
  } else {
    lines.push(
      `Total laporan: ${data.total}. ` +
        `Menunggu verifikasi: ${data.menunggu}. ` +
        `Sudah diverifikasi (DITERIMA): ${diverifikasi}. ` +
        `Sedang diproses (SEDANG_DIPERBAIKI): ${diproses}. ` +
        `Selesai: ${data.selesai}. ` +
        `Ditolak: ${ditolak}. ` +
        `Prioritas TINGGI: ${prioritasTinggiSaja}. ` +
        `Prioritas TINGGI+KRITIS (kartu Prioritas Tinggi): ${prioritasTinggiGabungan}.`
    );
  }

  if (role === "MASYARAKAT") {
    if (data.mine.length > 0) {
      lines.push(`Laporan milik user ini (${data.mine.length} terbaru):`);
      for (const r of data.mine) {
        lines.push(
          `- "${safeText(r.title, 80)}" | jenis=${r.facility} | status=${r.status} | prioritas=${r.priority}` +
            ` | petugas=${r.assignee ?? "belum ditugaskan"}` +
            ` | dibuat=${r.createdAt.toLocaleDateString("id-ID")}` +
            ` | id=${r.id.slice(-6).toUpperCase()}`
        );
      }
    } else {
      lines.push("User ini belum memiliki laporan.");
    }

    if (data.myNotifications.length > 0) {
      const unread = data.myNotifications.filter((n) => !n.isRead).length;
      lines.push(
        `Notifikasi terbaru user ini (${unread} belum dibaca): ` +
          data.myNotifications
            .map((n) => `"${safeText(n.title, 60)}"[${n.isRead ? "dibaca" : "baru"}]`)
            .join(", ") +
          "."
      );
    } else {
      lines.push("User ini belum memiliki notifikasi.");
    }
  } else if (role === "PETUGAS") {
    lines.push(
      data.tasks.length > 0
        ? `Tugas milik petugas ini (${data.tasks.length} terbaru): ${data.tasks.map((t) => `"${safeText(t.title, 60)}" [${t.status}]`).join("; ")}.`
        : "Petugas ini belum memiliki tugas."
    );
    lines.push(
      `Rincian status: ${data.byStatus.map((s) => `${s.status}=${s.count}`).join(", ")}.`
    );
  } else {
    lines.push(
      `Rincian status: ${data.byStatus.map((s) => `${s.status}=${s.count}`).join(", ")}.`
    );
    if (data.admin) {
      lines.push(
        `Pengguna: total ${data.admin.totalUsers}, aktif ${data.admin.activeUsers}` +
          (data.admin.usersByRole.length > 0
            ? ` (${data.admin.usersByRole.map((u) => `${u.role}=${u.count}`).join(", ")})`
            : "") +
          `. Laporan terverifikasi yang belum ditugaskan: ${data.admin.verifiedUnassigned}.`
      );
    }
  }

  if (data.recent && data.recent.length > 0) {
    lines.push("Laporan terbaru di desa:");
    for (const r of data.recent) {
      lines.push(
        `- "${safeText(r.title, 70)}" (${r.facility}) | ${r.status} | prioritas ${r.priority} | kerusakan ${r.damageLevel}`
      );
    }
  }

  if (data.facilityTypes.length > 0) {
    lines.push(
      "Jumlah laporan per jenis fasilitas: " +
        data.facilityTypes
          .map((f) => `${f.name}=${f.reports}`)
          .join(", ") +
        "."
    );
  }

  lines.push(
    `[PERAN CHATBOT] Kamu melayani pengguna dengan peran ${ROLE_LABELS[role] ?? role}. ` +
      "Jawab hanya pertanyaan yang sesuai peran tersebut dan jangan menampilkan data milik peran lain. " +
      "Jika pengguna menanyakan hal yang menjadi wewenang peran lain, katakan bahwa informasi itu hanya tersedia untuk peran terkait."
  );

  lines.push(
    "Gunakan konteks ini hanya untuk menjawab bagian data yang ditanyakan pengguna. " +
      "Email hanya boleh ditampilkan untuk pengguna yang sedang login ini; jangan pernah menampilkan email, id, password, token, atau Chat ID pengguna lain. " +
      "Jika data yang ditanyakan tidak ada di konteks, katakan terus terang bahwa datanya tidak tersedia."
  );

  return lines.join("\n").slice(0, MAX_CONTEXT_CHARS);
}

/**
 * Kompatibilitas: pemanggil lama tetap memakai fungsi ini.
 * Sama seperti sebelumnya — string konteks atau "" bila gagal.
 */
export async function buildChatbotDbContext(
  userId: string,
  role: ChatbotRole,
  lastUserMessage: string
): Promise<string> {
  const data = await getChatbotDbData(userId, role, lastUserMessage);
  if (!data) return "";
  return formatDbContext(data, role);
}

/** Kata kunci yang menandakan pertanyaan masih berkaitan dengan laporan/fasilitas. */
const REPORT_TOPIC_REGEX =
  /lapor|status|verifikasi|ditugaskan|diperbaiki|selesai|ditolak|diterima|prioritas|kerusakan|fasilitas|petugas|foto|gambar|unggah|upload|lokasi|peta|koordinat|progres|perkembangan|notifikasi|tiket|penanganan|perbaikan/;

export function isReportRelated(message: string): boolean {
  return REPORT_TOPIC_REGEX.test(message.toLowerCase());
}

/** Pertanyaan lanjutan yang relevan untuk ditampilkan sebagai tombol cepat. */
export function suggestQuestions(role: ChatbotRole): string[] {
  if (role === "ADMIN") {
    return [
      "Siapa nama dan email saya?",
      "Berapa laporan yang menunggu verifikasi?",
      "Berapa laporan yang belum ditugaskan?",
    ];
  }

  if (role === "PETUGAS") {
    return [
      "Siapa nama dan email saya?",
      "Apa tugas saya?",
      "Berapa tugas yang belum selesai?",
    ];
  }

  return [
    "Siapa nama dan email saya?",
    "Status laporan saya apa saja?",
    "Notifikasi saya apa saja?",
  ];
}

const STATUS_HELP: { key: RegExp; label: string; description: string }[] = [
  {
    key: /menunggu verifikasi/,
    label: "MENUNGGU_VERIFIKASI",
    description: "laporan sudah masuk dan sedang menunggu diperiksa admin.",
  },
  {
    key: /diproses ai/,
    label: "DIPROSES_AI",
    description: "laporan sedang dianalisis otomatis oleh sistem AI.",
  },
  {
    key: /diterima|disetujui/,
    label: "DITERIMA",
    description: "laporan sudah diverifikasi dan disetujui untuk ditindaklanjuti.",
  },
  {
    key: /ditolak/,
    label: "DITOLAK",
    description: "laporan tidak dapat diproses, misalnya data/foto kurang jelas atau bukan fasilitas umum.",
  },
  {
    key: /ditugaskan/,
    label: "DITUGASKAN",
    description: "laporan sudah diserahkan kepada petugas untuk diperbaiki.",
  },
  {
    key: /sedang diperbaiki/,
    label: "SEDANG_DIPERBAIKI",
    description: "petugas sedang melakukan perbaikan di lokasi.",
  },
  {
    key: /selesai/,
    label: "SELESAI",
    description: "perbaikan sudah selesai dan laporan ditutup.",
  },
];

function formatOwnReports(data: ChatbotDbData): string {
  return data.mine
    .map((r) => {
      const assignee = r.assignee ? `, ditangani ${r.assignee}` : "";
      return `• "${safeText(r.title, 80)}" (${r.facility}) — status ${r.status}, prioritas ${r.priority}${assignee}`;
    })
    .join("\n");
}

/** Topik yang hanya boleh dijawab untuk peran ADMIN. */
const ADMIN_ONLY_TOPIC =
  /(menunggu|belum|sudah|telah|perlu)?\s*(diverifikasi|verifikasi|terverifikasi)|belum ditugaskan|siap ditugaskan|pengguna aktif|user aktif|(jumlah|berapa|daftar|semua|statistik|rekap)\s+(pengguna|user|akun)|akun pengguna|semua laporan|seluruh laporan|laporan (masyarakat|pengguna|user) lain/;

/** Topik yang hanya boleh dijawab untuk peran PETUGAS. */
const PETUGAS_ONLY_TOPIC = /\b(tugas|kerjaan|penugasan)\b/;

/** Samakan penulisan terpisah seperti "di verifikasi" agar pola tetap cocok. */
function normalizeQuestion(message: string): string {
  return message
    .toLowerCase()
    .replace(/\bdi\s+verifikasi/g, "diverifikasi")
    .replace(/\bdi\s+tugaskan/g, "ditugaskan");
}

/** Pertanyaan tentang identitas pengguna yang sedang login ("siapa saya"). */
const SELF_IDENTITY_QUESTION =
  /^(siapa|siapakah)\s+(saya|aku)\b|^saya\s+siapa\b|^aku\s+siapa\b/;

/** Pertanyaan tentang identitas chatbot. */
const IDENTITY_QUESTION =
  /^(siapa|siapakah)\s+(kamu|anda|bot|chatbot|asisten)\b|\bnama\s+(kamu|bot|chatbot|asisten)\b|\bkamu\s+(siapa|bot|chatbot|asisten)\b|\bchatbot\s+(apa|siapa)\b|\bbot\s+(apa|siapa)\b|\bini\s+(bot|chatbot)\s+apa\b/;

/** Pertanyaan tentang kemampuan chatbot. */
const CAPABILITY_QUESTION =
  /\b(kamu|anda|chatbot|bot)\b.*\b(bisa apa|bisa apa saja|bisa melakukan apa|kemampuan|fungsi)\b|\bapa (saja )?yang bisa (kamu|anda) lakukan\b|\bapa tugas (kamu|chatbot|bot)\b/;

/**
 * Jawab identitas/kemampuan chatbot sesuai peran tempat chatbot dibuka.
 * Contoh: "Siapa saya?" di peran Admin → "Saya adalah chatbot Admin."
 */
export function answerChatbotIdentity(
  message: string,
  role: ChatbotRole
): string | null {
  const q = normalizeQuestion(message);
  const label = ROLE_LABELS[role] ?? role;

  if (SELF_IDENTITY_QUESTION.test(q)) {
    return `Kamu adalah ${label}.`;
  }

  if (IDENTITY_QUESTION.test(q)) {
    return `Saya adalah chatbot ${label}.`;
  }

  if (CAPABILITY_QUESTION.test(q)) {
    return `Saya adalah chatbot ${label}. Saya membantu ${CHATBOT_DUTIES[role]}.`;
  }

  return null;
}

/**
 * Kelompok status yang dapat ditanyakan. Urutan penting: kecocokan spesifik
 * (diproses AI, menunggu/belum diverifikasi) dicek sebelum kecocokan umum.
 */
const STATUS_COUNT_GROUPS: { key: RegExp; statuses: string[]; label: string }[] = [
  {
    key: /menunggu verifikasi|belum diverifikasi|perlu diverifikasi/,
    statuses: ["MENUNGGU_VERIFIKASI"],
    label: "menunggu verifikasi",
  },
  {
    key: /sudah diverifikasi|telah diverifikasi|lolos verifikasi|diverifikasi admin/,
    statuses: ["DITERIMA"],
    label: "sudah diverifikasi",
  },
  {
    key: /diproses ai/,
    statuses: ["DIPROSES_AI"],
    label: "sedang diproses AI",
  },
  {
    // Dashboard "Sedang Diproses" = SEDANG_DIPERBAIKI. "diperbaiki/dikerjakan/ditangani" juga cocok.
    key: /sedang diperbaiki|sedang diproses|sedang dikerjakan|sedang saya kerjakan|sedang ditangani|sedang saya tangani|dalam proses|tahap penanganan|dalam pengerjaan|saya tangani|\bdiproses\b|\bdiperbaiki\b|\bdikerjakan\b/,
    statuses: ["SEDANG_DIPERBAIKI"],
    label: "sedang diproses",
  },
  {
    key: /ditolak|tidak disetujui|penolakan/,
    statuses: ["DITOLAK"],
    label: "ditolak",
  },
  {
    key: /ditugaskan|belum dikerjakan/,
    statuses: ["DITUGASKAN"],
    label: "sudah ditugaskan",
  },
  { key: /diterima/, statuses: ["DITERIMA"], label: "diterima" },
  { key: /selesai/, statuses: ["SELESAI"], label: "sudah selesai" },
];

const STATUS_KEYWORD =
  /menunggu verifikasi|belum diverifikasi|perlu diverifikasi|sudah diverifikasi|telah diverifikasi|lolos verifikasi|diverifikasi|diproses ai|sedang diperbaiki|sedang diproses|dalam proses|sedang ditangani|sedang dikerjakan|sedang saya kerjakan|tahap penanganan|dalam pengerjaan|\bdiproses\b|\bdiperbaiki\b|ditolak|tidak disetujui|penolakan|ditugaskan|belum dikerjakan|belum saya kerjakan|belum ditindaklanjuti|perlu ditindaklanjuti|tugas baru|penugasan baru|\bbaru\b|diterima|selesai|belum selesai|tugas aktif|penugasan aktif/;

const PRIORITY_KEYWORD =
  /prioritas|kritis|tinggi|urgensi|penanganan segera|segera ditangani|\bsedang\b|\brendah\b/;

function isCountQuestion(q: string): boolean {
  return /berapa|jumlah|total|ada berapa|banyak/.test(q) || /^apakah ada\b/.test(q);
}

function formatCountAnswer(label: string, count: number, yesNo: boolean): string {
  if (yesNo) {
    return count > 0
      ? `Ya, ada ${count} ${label}.`
      : `Tidak ada, ${label} berjumlah 0.`;
  }
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ada ${count}.`;
}

export function answerStatusCountQuestion(
  message: string,
  data: ChatbotDbData,
  role: ChatbotRole
): string | null {
  const q = normalizeQuestion(message);

  if (!isCountQuestion(q)) return null;
  // Pertanyaan durasi/waktu bukan pertanyaan jumlah.
  if (/berapa lama|kapan|estimasi|berapa hari|sampai kapan|lamanya|prosesnya/.test(q)) {
    return null;
  }
  // "Belum ditugaskan" (antrian verifikasi yang belum punya petugas) adalah
  // metrik khusus admin; jangan salah tafsir sebagai status DITUGASKAN.
  if ((role === "ADMIN" || role === "PETUGAS") && /belum ditugaskan|siap ditugaskan|belum ada petugas/.test(q)) {
    return null;
  }
  // Pertanyaan "diverifikasi" yang ambigu (tanpa "sudah/menunggu/belum") perlu
  // klarifikasi di handler admin; jangan paksa salah tafsir.
  if (role === "ADMIN" && /\b(diverifikasi|verifikasi|terverifikasi)\b/.test(q) && !/sudah diverifikasi|telah diverifikasi|lolos verifikasi|diverifikasi admin|menunggu verifikasi|belum diverifikasi|perlu diverifikasi/.test(q)) {
    return null;
  }

  const yesNo = /^apakah ada\b/.test(q);

  const rows =
    role === "ADMIN"
      ? data.byStatus
      : role === "PETUGAS"
        ? data.taskByStatus
        : data.mineByStatus;
  const petugasTaskNoun =
    role === "PETUGAS" &&
    (/\b(tugas|penugasan)\b/.test(q) ||
      /saya kerjakan|saya tangani|tindak lanjuti|\bbaru\b|tugas aktif|penugasan aktif/.test(q));
  const noun = petugasTaskNoun
    ? "tugas"
    : role === "ADMIN"
      ? "laporan"
      : "laporan Anda";

  if (/belum selesai/.test(q)) {
    const total =
      role === "ADMIN"
        ? data.total
        : role === "PETUGAS"
          ? (data.profile?.taskCount ?? data.total)
          : (data.profile?.reportCount ?? data.total);
    const selesai = countStatuses(rows, ["SELESAI"]);
    const count = Math.max(0, total - selesai);
    return formatCountAnswer(`${noun} yang belum selesai`, count, yesNo);
  }

  // Petugas: "tugas baru / belum saya kerjakan / perlu ditindaklanjuti"
  // sesuai dashboard = status DITUGASKAN milik petugas login.
  if (
    role === "PETUGAS" &&
    /tugas baru|penugasan baru|\bbaru\b|belum dikerjakan|belum saya kerjakan|belum ditindaklanjuti|perlu ditindaklanjuti|perlu saya tindak lanjuti/.test(q)
  ) {
    const count = countStatuses(rows, ["DITUGASKAN"]);
    return formatCountAnswer("tugas baru", count, yesNo);
  }

  // Petugas: tugas aktif = belum selesai (DITUGASKAN + SEDANG_DIPERBAIKI).
  if (role === "PETUGAS" && /tugas aktif|penugasan aktif/.test(q)) {
    const count = Math.max(0, data.total - data.selesai);
    return formatCountAnswer("tugas aktif", count, yesNo);
  }

  // Petugas: "ditugaskan kepada saya / penugasan saya / tugas saya" bermakna
  // total penugasan milik petugas (bukan status DITUGASKAN).
  if (
    role === "PETUGAS" &&
    /total penugasan|semua (tugas|penugasan)|seluruh (tugas|penugasan)|penugasan saya|tugas saya|ditugaskan kepada saya|ditugaskan ke saya|ditugaskan untuk saya|laporan yang ditugaskan/.test(q)
  ) {
    const total = data.profile?.taskCount ?? data.total;
    const label = "total penugasan";
    if (yesNo) {
      return total > 0 ? `Ya, ada ${total} ${label}.` : `Tidak ada, ${label} berjumlah 0.`;
    }
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} ada ${total}.`;
  }

  for (const group of STATUS_COUNT_GROUPS) {
    if (group.key.test(q)) {
      const count = countStatuses(rows, group.statuses);
      return formatCountAnswer(`${noun} yang ${group.label}`, count, yesNo);
    }
  }

  // Pertanyaan lain (pengguna/akun/profil) → handler khusus.
  if (/pengguna|user|akun|profil/.test(q)) return null;

  // Jumlah per prioritas.
  const priorityRows =
    role === "ADMIN"
      ? (data.byPriority ?? [])
      : role === "PETUGAS"
        ? (data.taskByPriority ?? [])
        : (data.mineByPriority ?? []);
  const priorityNoun = role === "PETUGAS" && /\btugas\b/.test(q) ? "tugas" : noun;

  // "Prioritas tinggi" pada dashboard admin = TINGGI + KRITIS.
  const asksHighPriority =
    /prioritas tinggi|urgensi tinggi|penanganan segera|segera ditangani|membutuhkan penanganan/.test(q) ||
    (/\btinggi\b/.test(q) && /prioritas|urgensi/.test(q));
  if (asksHighPriority && !/\bkritis\b/.test(q)) {
    const count = countPriorities(priorityRows, ["TINGGI", "KRITIS"]);
    return formatCountAnswer(`${priorityNoun} dengan prioritas tinggi`, count, yesNo);
  }
  if (/\bkritis\b/.test(q) && /prioritas|urgensi|laporan|tugas|berapa|jumlah|ada/.test(q)) {
    const count = countPriorities(priorityRows, ["KRITIS"]);
    return formatCountAnswer(`${priorityNoun} dengan prioritas kritis`, count, yesNo);
  }
  if (/\bsedang\b/.test(q) && /prioritas|urgensi/.test(q)) {
    const count = countPriorities(priorityRows, ["SEDANG"]);
    return formatCountAnswer(`${priorityNoun} dengan prioritas sedang`, count, yesNo);
  }
  if (/\brendah\b/.test(q) && /prioritas|urgensi/.test(q)) {
    const count = countPriorities(priorityRows, ["RENDAH"]);
    return formatCountAnswer(`${priorityNoun} dengan prioritas rendah`, count, yesNo);
  }

  // Jika pertanyaan menyebut status/prioritas yang tidak dikenali, jangan
  // jatuh ke total laporan.
  if (STATUS_KEYWORD.test(q) || PRIORITY_KEYWORD.test(q)) return null;

  // Jumlah laporan/tugas tanpa status/prioritas spesifik → total milik scope.
  if (/\b(laporan|tugas|penugasan|data|statistik|rekap)\b/.test(q) || /berapa|jumlah|total|ada berapa|banyak/.test(q)) {
    const total =
      role === "ADMIN"
        ? data.total
        : role === "PETUGAS"
          ? (data.profile?.taskCount ?? data.total)
          : (data.profile?.reportCount ?? data.mine.length);
    const label = role === "PETUGAS" ? "total penugasan" : noun;
    if (yesNo) {
      return total > 0
        ? `Ya, ada ${total} ${label}.`
        : `Tidak ada, ${label} berjumlah 0.`;
    }
    return `${label.charAt(0).toUpperCase()}${label.slice(1)} ada ${total}.`;
  }

  return null;
}

/**
 * Hitungan status untuk user tertentu (sesuai peran):
 * - PETUGAS → tugas/penugasan milik user tersebut.
 * - Masyarakat/Admin → laporan milik user tersebut.
 * Dipakai ketika pengguna menanyakan sesuai nama card user tertentu.
 */
export async function answerUserStatusCount(
  message: string,
  role: ChatbotRole,
  userId: string,
  asPetugas: boolean
): Promise<string | null> {
  const q = normalizeQuestion(message);
  const noun =
    asPetugas ||
    (role === "PETUGAS" &&
      (/\b(tugas|penugasan)\b/.test(q) ||
        /saya kerjakan|saya tangani|tindak lanjuti|\bbaru\b|tugas aktif|penugasan aktif/.test(q)))
      ? "tugas"
      : role === "ADMIN"
        ? "laporan"
        : "laporan Anda";

  if (!isCountQuestion(q)) return null;
  if (/berapa lama|kapan|estimasi|berapa hari|sampai kapan|lamanya|prosesnya/.test(q)) {
    return null;
  }
  if (/belum ditugaskan|siap ditugaskan|belum ada petugas/.test(q)) {
    return null;
  }

  const yesNo = /^apakah ada\b/.test(q);

  const rows = asPetugas
    ? await db.report.groupBy({
        by: ["status"],
        where: { assignedTo: userId },
        _count: { status: true },
      })
    : await db.report.groupBy({ by: ["status"], where: { userId }, _count: { status: true } });
  const statusRows = rows.map((r) => ({ status: r.status, count: r._count.status }));

  const total = asPetugas
    ? await db.report.count({ where: { assignedTo: userId } })
    : await db.report.count({ where: { userId } });

  if (/belum selesai/.test(q)) {
    const selesai = countStatuses(statusRows, ["SELESAI"]);
    return formatCountAnswer(`${noun} yang belum selesai`, Math.max(0, total - selesai), yesNo);
  }

  if (
    asPetugas &&
    /tugas baru|penugasan baru|\bbaru\b|belum dikerjakan|belum saya kerjakan|belum ditindaklanjuti|perlu ditindaklanjuti|perlu saya tindak lanjuti/.test(q)
  ) {
    const count = countStatuses(statusRows, ["DITUGASKAN"]);
    return formatCountAnswer("tugas baru", count, yesNo);
  }

  if (asPetugas && /tugas aktif|penugasan aktif/.test(q)) {
    return formatCountAnswer("tugas aktif", Math.max(0, total - countStatuses(statusRows, ["SELESAI"])), yesNo);
  }

  for (const group of STATUS_COUNT_GROUPS) {
    if (group.key.test(q)) {
      return formatCountAnswer(`${noun} yang ${group.label}`, countStatuses(statusRows, group.statuses), yesNo);
    }
  }

  const priorityRows = asPetugas
    ? (await db.report.groupBy({
        by: ["priority"],
        where: { assignedTo: userId },
        _count: { priority: true },
      })).map((r) => ({ priority: r.priority, count: r._count.priority }))
    : (await db.report.groupBy({
        by: ["priority"],
        where: { userId },
        _count: { priority: true },
      })).map((r) => ({ priority: r.priority, count: r._count.priority }));

  const asksHighPriority =
    /prioritas tinggi|urgensi tinggi|penanganan segera|segera ditangani|membutuhkan penanganan/.test(q) ||
    (/\btinggi\b/.test(q) && /prioritas|urgensi/.test(q));
  if (asksHighPriority && !/\bkritis\b/.test(q)) {
    return formatCountAnswer(`${noun} dengan prioritas tinggi`, countPriorities(priorityRows, ["TINGGI", "KRITIS"]), yesNo);
  }
  if (/\bkritis\b/.test(q) && /prioritas|urgensi|laporan|tugas|berapa|jumlah|ada/.test(q)) {
    return formatCountAnswer(`${noun} dengan prioritas kritis`, countPriorities(priorityRows, ["KRITIS"]), yesNo);
  }
  if (/\bsedang\b/.test(q) && /prioritas|urgensi/.test(q)) {
    return formatCountAnswer(`${noun} dengan prioritas sedang`, countPriorities(priorityRows, ["SEDANG"]), yesNo);
  }
  if (/\brendah\b/.test(q) && /prioritas|urgensi/.test(q)) {
    return formatCountAnswer(`${noun} dengan prioritas rendah`, countPriorities(priorityRows, ["RENDAH"]), yesNo);
  }

  if (STATUS_KEYWORD.test(q) || PRIORITY_KEYWORD.test(q)) return null;

  const totalLabel = asPetugas ? "total penugasan" : noun;
  if (yesNo) {
    return total > 0 ? `Ya, ada ${total} ${totalLabel}.` : `Tidak ada, ${totalLabel} berjumlah 0.`;
  }
  return `${totalLabel.charAt(0).toUpperCase()}${totalLabel.slice(1)} ada ${total}.`;
}

/** Pola nama user/petugas + nomor, mis. "masyarakat 1", "petugas 2". */
const USER_REF_PATTERN =
  /(?:masyarakat|warga|user|orang|penduduk|pengguna|pemerintah desa|desa|petugas|operator|babinsa|tukang)\s+(\d+)/;

/**
 * Cari user/petugas berdasarkan nomor pada pertanyaan (mis. "masyarakat 1").
 * Dipakai agar statistik dijawab dari data user/petugas yang ditanyakan,
 * bukan dari data user yang sedang login (agar tidak bocor antar user).
 */
export async function resolveUserRef(
  message: string
): Promise<{ userId: string; asPetugas: boolean } | null> {
  const q = normalizeQuestion(message);
  const m = q.match(USER_REF_PATTERN);
  if (!m) return null;

  const n = Number(m[1]);
  const asPetugas = /petugas/.test(m[0]);
  const refRole = asPetugas ? "PETUGAS" : "MASYARAKAH";
  const users = await db.user.findMany({
    where: { role: refRole },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    skip: Math.max(0, n - 1),
    take: 1,
  });
  const user = users[0];
  if (!user) return null;

  return { userId: user.id, asPetugas };
}

/**
 * Batasi jawaban sesuai peran pengguna yang sedang login.
 * Mengembalikan pesan penolakan bila pertanyaan menyangkut peran lain,
 * atau null bila pertanyaan masih dalam lingkup peran tersebut.
 */
export function answerRoleScopeQuestion(
  message: string,
  role: ChatbotRole
): string | null {
  const q = normalizeQuestion(message);
  const ownScoped = /\b(saya|ku|aku|milik saya|punya saya)\b/.test(q);
  const ownRoleMention =
    role === "ADMIN"
      ? /\badmin\b/.test(q)
      : role === "PETUGAS"
        ? /\bpetugas\b/.test(q)
        : /\b(masyarakat|warga)\b/.test(q);

  if (ownRoleMention) return null;

  const roleLabel = ROLE_LABELS[role] ?? role;

  if (role !== "ADMIN" && !ownScoped && ADMIN_ONLY_TOPIC.test(q)) {
    return `Pertanyaan tentang verifikasi laporan dan data pengguna hanya dapat dijawab untuk peran Admin. Anda masuk sebagai ${roleLabel}.`;
  }

  if (role !== "PETUGAS" && PETUGAS_ONLY_TOPIC.test(q)) {
    return `Pertanyaan tentang tugas petugas hanya dapat dijawab untuk peran Petugas. Anda masuk sebagai ${roleLabel}.`;
  }

  return null;
}

/**
 * Jawaban lokal berbasis data DB saat AI utama tidak tersedia.
 * Menangani semua pertanyaan masyarakat seputar laporan; mengembalikan null
 * untuk pertanyaan di luar topik agar route menjawab "tidak tahu" dengan sopan.
 */
export function answerDataQuestion(
  message: string,
  data: ChatbotDbData,
  role: ChatbotRole
): string | null {
  const q = normalizeQuestion(message);

  // Identitas chatbot mengikuti peran tempat chatbot dibuka.
  const identityReply = answerChatbotIdentity(message, role);
  if (identityReply) return identityReply;

  // Batasi jawaban sesuai peran pengguna yang sedang login.
  const scopeReply = answerRoleScopeQuestion(message, role);
  if (scopeReply) return scopeReply;

  const asksOwn =
    /laporan\s?(saya|ku|gue|aku)|punya\s?laporan|laporanku|status.*lapor|cek.*lapor|progres|perkembangan/.test(q);
  const asksCount = /berapa|jumlah|total|statistik|semua|rekap|data/.test(q);
  const asksTask = /tugas|kerjaan|ditugaskan/.test(q);
  const asksNotif = /notif|pemberitahuan|pesan masuk/.test(q);
  const asksFacilityStats =
    /fasilitas|kategori|jenis/.test(q) &&
    /paling|banyak|sering|jumlah|berapa|data|statistik/.test(q);
  const asksFacilityList =
    /(jenis|kategori|daftar).*(fasilitas)|fasilitas.*(apa saja|apa aja|jenis|kategori)/.test(q);

  // 0. Informasi personal pengguna yang sedang login
  if (data.profile) {
    const p = data.profile;
    const roleLabel = ROLE_LABELS[p.role] ?? p.role;
    const asksName =
      /\bnama\b/.test(q) && /(saya|ku|aku|akun)/.test(q);
    const asksEmail =
      /email (saya|ku|akun)|alamat email|apa email|e-mail saya|surel saya/.test(
        q
      );

    if (
      p.role === "MASYARAKAT" &&
      /(whatsapp|nomor wa).*(saya|akun|terhubung|konek)|apakah.*whatsapp|status whatsapp|hubungkan whatsapp/.test(q)
    ) {
      return p.whatsappConnected
        ? "Nomor WhatsApp Anda sudah terhubung."
        : "Nomor WhatsApp Anda belum terhubung.";
    }

    if (asksName || asksEmail) {
      if (asksName && asksEmail) {
        return `Nama Anda ${p.name}, email Anda ${p.email}.`;
      }
      if (asksName) return `Nama Anda ${p.name}.`;
      return `Email Anda ${p.email}.`;
    }

    if (/profil|akun saya|data saya|identitas saya|status akun/.test(q)) {
      const whatsappLine =
        p.role === "MASYARAKAT"
          ? `\n- WhatsApp: ${p.whatsappConnected ? "terhubung" : "belum terhubung"}`
          : "";
      return (
        `Profil akun Anda:\n` +
        `- Nama: ${p.name}\n` +
        `- Email: ${p.email}\n` +
        `- Peran: ${roleLabel}\n` +
        `- Status akun: ${p.isActive ? "aktif" : "nonaktif"}\n` +
        `- Bergabung sejak: ${p.joinedAt.toLocaleDateString("id-ID")}\n` +
        `- Laporan dibuat: ${p.reportCount} | Tugas ditugaskan: ${p.taskCount}\n` +
        `- Notifikasi belum dibaca: ${p.unreadNotifications}` +
        whatsappLine
      );
    }

    if (/peran|role|jabatan|hak akses/.test(q)) {
      return `Peran akun Anda adalah ${roleLabel}.`;
    }

    if (/sejak kapan|kapan.*(daftar|bergabung|buat akun)|terdaftar|umur akun/.test(q)) {
      return `Akun Anda terdaftar sejak ${p.joinedAt.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}.`;
    }
  }

  // Hitungan spesifik per status laporan sesuai peran.
  const statusCountReply = answerStatusCountQuestion(message, data, role);
  if (statusCountReply) return statusCountReply;

  if (role === "ADMIN" && data.admin) {
    if (/belum ditugaskan|siap ditugaskan|belum ada petugas/.test(q)) {
      const count = data.admin.verifiedUnassigned;
      if (/^apakah ada\b/.test(q)) {
        return count > 0
          ? `Ya, ada ${count} laporan terverifikasi yang belum ditugaskan ke petugas.`
          : "Tidak ada, laporan terverifikasi yang belum ditugaskan berjumlah 0.";
      }
      return `Ada ${count} laporan terverifikasi yang belum ditugaskan ke petugas.`;
    }

    // Pertanyaan verifikasi yang ambigu → minta klarifikasi.
    if (
      /\b(diverifikasi|verifikasi|terverifikasi)\b/.test(q) &&
      !/sudah diverifikasi|telah diverifikasi|lolos verifikasi|diverifikasi admin|menunggu verifikasi|belum diverifikasi|perlu diverifikasi/.test(q)
    ) {
      return "Apakah maksud Anda laporan yang menunggu verifikasi atau laporan yang sudah diverifikasi (status DITERIMA)?";
    }

    if (/berapa.*(pengguna|user|akun)|jumlah.*(pengguna|user|akun)|pengguna aktif|user aktif/.test(q)) {
      const roles = data.admin.usersByRole
        .map((u) => `${ROLE_LABELS[u.role] ?? u.role}: ${u.count}`)
        .join(", ");
      return `Ada total ${data.admin.totalUsers} pengguna, ${data.admin.activeUsers} aktif${roles ? ` (${roles})` : ""}.`;
    }
  }

  // 1. Cara membuat laporan (kecuali pertanyaan spesifik foto/lokasi)
  const asksSpecificMedia =
    /foto|gambar|upload|unggah|dokumentasi|lokasi|peta|titik|koordinat/.test(q);
  if (
    !asksSpecificMedia &&
    /(cara|gimana|bagaimana|gmn|tutorial|langkah|prosedur|alur|syarat).*(buat|lapor|melapor)|(buat|lapor|melapor).*(cara|gimana|bagaimana|gmn|langkah|prosedur|syarat)|mau lapor|ingin lapor/.test(
      q
    )
  ) {
    return (
      "Cara membuat laporan:\n" +
      "1. Klik tombol \"Buat Laporan\".\n" +
      "2. Isi judul dan deskripsi kerusakan dengan jelas.\n" +
      "3. Pilih jenis fasilitas, lalu tulis alamat lokasi.\n" +
      "4. Unggah foto JPG/PNG (maksimal 5MB) dan tandai titik lokasi di peta.\n" +
      "5. Kirim laporan."
    );
  }

  // 2. Cara memantau/mengecek laporan
  if (
    /(cara|gimana|bagaimana|gmn).*(cek|lihat|pantau|lacak)|(cek|lihat|pantau|lacak).*(laporan|status)|di mana.*(lihat|cek)/.test(
      q
    )
  ) {
    if (role === "MASYARAKAT" && asksOwn && data.mine.length > 0) {
      return `Status laporan Anda:\n${formatOwnReports(data)}`;
    }
    return 'Laporan dapat dipantau di halaman "Laporan Saya".';
  }

  // 3. Arti status tertentu
  if (
    /apa itu|artinya|maksud|jelaskan|penjelasan|apa yang dimaksud|bedanya/.test(q) &&
    STATUS_HELP.some((s) => s.key.test(q))
  ) {
    const matched = STATUS_HELP.filter((s) => s.key.test(q));
    return matched
      .map((s) => `Status ${s.label}: ${s.description}`)
      .join("\n");
  }

  // 4. Laporan ditolak
  if (/ditolak|penolakan/.test(q)) {
    if (role === "MASYARAKAT" && /berapa|jumlah/.test(q)) {
      return `Anda memiliki ${countStatuses(data.mineByStatus, ["DITOLAK"])} laporan yang ditolak.`;
    }
    const rejected = data.mine.filter((r) => r.status === "DITOLAK");
    const base =
      "Laporan bisa ditolak jika deskripsi/foto kurang jelas, lokasi tidak valid, bukan fasilitas umum, atau laporan duplikat.";
    if (rejected.length > 0) {
      return `${base}\n\nLaporan Anda yang berstatus DITOLAK:\n${rejected
        .map((r) => `• "${safeText(r.title, 80)}" — ${r.facility}`)
        .join("\n")}`;
    }
    return base;
  }

  // 5. Estimasi waktu / kapan selesai
  if (
    !/\btugas\b/.test(q) &&
    /berapa lama|kapan.*selesai|estimasi|berapa hari|sampai kapan|belum selesai|lamanya|prosesnya/.test(
      q
    )
  ) {
    const active = data.mine.filter((r) => r.status !== "SELESAI" && r.status !== "DITOLAK");
    const list =
      active.length > 0
        ? `\n\nLaporan Anda yang masih diproses:\n${active
            .map((r) => `• "${safeText(r.title, 80)}" — ${r.status}`)
            .join("\n")}`
        : "";
    return (
      "Tidak ada patokan waktu pasti karena durasi bergantung pada verifikasi admin, ketersediaan petugas, dan tingkat kerusakan." +
      list
    );
  }

  // 6. Petugas yang menangani
  if (
    /siapa.*(petugas|menangani|memperbaiki|perbaikan)|petugas.*siapa|ditangani siapa|tukang/.test(
      q
    )
  ) {
    const assigned = data.mine.filter((r) => r.assignee);
    if (assigned.length > 0) {
      return `Laporan Anda yang sudah ditangani petugas:\n${assigned
        .map((r) => `• "${safeText(r.title, 80)}" — ditangani ${r.assignee} (status ${r.status})`)
        .join("\n")}`;
    }
    return (
      "Belum ada petugas yang ditugaskan pada laporan Anda."
    );
  }

  // 7. Foto/dokumentasi
  if (/foto|gambar|upload|unggah|dokumentasi/.test(q)) {
    return "Foto laporan harus berformat JPG atau PNG dengan ukuran maksimal 5MB.";
  }

  // 8. Lokasi/peta
  if (/lokasi|peta|titik|koordinat|alamat/.test(q)) {
    return "Saat membuat laporan, tulis alamat lengkap (jalan, RT/RW, desa) lalu tandai titik lokasi pada peta.";
  }

  // 9. Prioritas/tingkat kerusakan
  if (
    /prioritas|tingkat kerusakan|ringan|sedang|berat|kritis/.test(q) &&
    /\bapa\b|\barti\b|maksud|bedanya|jelaskan|tingkat|prioritas/.test(q)
  ) {
    return (
      "Tingkat kerusakan: RINGAN (kosmetik, masih berfungsi), SEDANG (fungsi terganggu sebagian), " +
      "BERAT (berbahaya jika digunakan), KRITIS (butuh penanganan darurat). " +
      "Prioritas mengikuti tingkat kerusakan: RENDAH, SEDANG, TINGGI, atau KRITIS."
    );
  }

  // 10. Notifikasi user
  if (role === "MASYARAKAT" && asksNotif) {
    if (data.myNotifications.length === 0) {
      return "Anda belum memiliki notifikasi.";
    }
    const unread = data.myNotifications.filter((n) => !n.isRead).length;
    const list = data.myNotifications
      .map((n) => `• ${safeText(n.title, 80)} — ${n.isRead ? "sudah dibaca" : "belum dibaca"}`)
      .join("\n");
    return `Notifikasi terbaru Anda (${unread} belum dibaca):\n${list}`;
  }

  // 11. Daftar jenis fasilitas / statistik fasilitas
  if (asksFacilityList || asksFacilityStats) {
    if (data.facilityTypes.length === 0) {
      return "Data jenis fasilitas belum tersedia di database.";
    }
    const sorted = [...data.facilityTypes].sort((a, b) => b.reports - a.reports);
    const list = sorted
      .map((f) => `• ${f.name}: ${f.reports} laporan`)
      .join("\n");
    return `Jenis fasilitas dan jumlah laporannya:\n${list}`;
  }

  // 12. Tugas petugas (daftar/detail; pertanyaan jumlah ditangani oleh answerStatusCountQuestion)
  if (role === "PETUGAS" && (asksOwn || asksTask)) {
    const totalTasks = data.profile?.taskCount ?? data.total;
    if (totalTasks === 0) {
      return "Anda belum memiliki tugas/penugasan.";
    }
    if (data.tasks.length === 0) {
      const selesai = countStatuses(data.taskByStatus, ["SELESAI"]);
      const baru = countStatuses(data.taskByStatus, ["DITUGASKAN"]);
      const diproses = countStatuses(data.taskByStatus, ["SEDANG_DIPERBAIKI"]);
      return `Total penugasan Anda ${totalTasks} (tugas baru: ${baru}, sedang diproses: ${diproses}, selesai: ${selesai}).`;
    }
    const selesai = countStatuses(data.taskByStatus, ["SELESAI"]);
    const baru = countStatuses(data.taskByStatus, ["DITUGASKAN"]);
    const diproses = countStatuses(data.taskByStatus, ["SEDANG_DIPERBAIKI"]);
    const list = data.tasks
      .map(
        (t) =>
          `• "${safeText(t.title, 80)}" (${t.facility}) — status ${t.status}, prioritas ${t.priority}` +
          (t.assignee ? `, petugas ${t.assignee}` : "")
      )
      .join("\n");
    return (
      `Ringkasan tugas Anda: total ${totalTasks}, tugas baru ${baru}, sedang diproses ${diproses}, selesai ${selesai}.\n` +
      `Daftar tugas terbaru:\n${list}`
    );
  }

  // 13. Laporan milik user
  if (role === "MASYARAKAT" && asksOwn) {
    if (data.mine.length === 0) {
      return "Anda belum memiliki laporan.";
    }
    if (/berapa|jumlah|total/.test(q)) {
      if (/sudah diverifikasi|terverifikasi|diverifikasi/.test(q)) {
        return `Anda memiliki ${countStatuses(data.mineByStatus, VERIFIED_STATUSES)} laporan yang sudah diverifikasi.`;
      }
      if (/selesai/.test(q)) {
        return `Anda memiliki ${countStatuses(data.mineByStatus, ["SELESAI"])} laporan yang sudah selesai.`;
      }
      if (/menunggu/.test(q)) {
        return `Anda memiliki ${countStatuses(data.mineByStatus, ["MENUNGGU_VERIFIKASI"])} laporan yang menunggu verifikasi.`;
      }
      return `Anda memiliki ${data.profile?.reportCount ?? data.mine.length} laporan.`;
    }
    return `Laporan Anda:\n${formatOwnReports(data)}`;
  }

  // 14. Statistik umum
  if (asksCount || (role === "ADMIN" && asksOwn)) {
    const rincian =
      data.byStatus.length > 0
        ? data.byStatus.map((s) => `${s.status}: ${s.count}`).join(", ")
        : "belum ada rincian";
    return (
      `Total ${data.total} laporan — ` +
      `menunggu verifikasi ${data.menunggu}, selesai ${data.selesai}, prioritas KRITIS ${data.kritis}. ` +
      `Rincian status: ${rincian}.`
    );
  }

  // 15. Pertanyaan laporan yang belum spesifik → minta klarifikasi
  if (isReportRelated(message)) {
    return "Pertanyaan Anda kurang spesifik. Apakah yang Anda maksud status laporan, cara membuat laporan, atau notifikasi?";
  }

  return null;
}
