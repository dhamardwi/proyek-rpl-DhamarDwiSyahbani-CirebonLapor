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
  telegramConnected: boolean;
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
  /** Jumlah laporan per jenis fasilitas (agregat global). */
  facilityTypes: { name: string; reports: number }[];
  /** Notifikasi terbaru milik user (MASYARAKAT). */
  myNotifications: { title: string; isRead: boolean }[];
  /** Laporan terbaru desa (hanya bila pesan user menanyakan data). */
  recent: { title: string; status: string; priority: string; damageLevel: string; facility: string }[] | null;
}

/** Status laporan yang sudah lolos verifikasi (diterima dan seterusnya). */
const VERIFIED_STATUSES = ["DITERIMA", "DITUGASKAN", "SEDANG_DIPERBAIKI", "SELESAI"];

/** Jumlahkan count untuk status tertentu dari hasil groupBy. */
function countStatuses(
  rows: { status: string; count: number }[],
  statuses: string[]
): number {
  return rows
    .filter((row) => statuses.includes(row.status))
    .reduce((sum, row) => sum + row.count, 0);
}

function safeText(value: unknown, max = 120): string {
  if (typeof value !== "string") return "-";
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length > max ? `${cleaned.slice(0, max)}…` : cleaned;
}

export function wantsDbData(message: string): boolean {
  return /lapor|status|berapa|statistik|data|tugas|kritis|berat|prioritas|progres|perkembangan|peta|fasilitas|punya|jumlah|total|rekap|notif|pemberitahuan|kategori|jenis|profil|nama|email|akun|pengguna|user|telegram/.test(
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

    const [total, menunggu, selesai, kritis, byStatus] = await Promise.all([
      db.report.count(),
      db.report.count({ where: { status: "MENUNGGU_VERIFIKASI" } }),
      db.report.count({ where: { status: "SELESAI" } }),
      db.report.count({ where: { priority: "KRITIS" } }),
      db.report.groupBy({ by: ["status"], _count: { status: true } }),
    ]);

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
        ? db.report.groupBy({
            by: ["status"],
            where: { userId },
            _count: { status: true },
          })
        : Promise.resolve([]),
      role === "PETUGAS"
        ? db.report.groupBy({
            by: ["status"],
            where: { assignedTo: userId },
            _count: { status: true },
          })
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
          telegramLink: { select: { id: true } },
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
          telegramConnected: Boolean(profileRow.telegramLink),
        }
      : null;

    const admin: ChatbotAdminStats | null =
      role === "ADMIN"
        ? await Promise.all([
            db.user.count(),
            db.user.count({ where: { isActive: true } }),
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
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
      mineByStatus: mineByStatusRows.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      taskByStatus: taskByStatusRows.map((s) => ({
        status: s.status,
        count: s._count.status,
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
    lines.push(
      "[PROFIL PENGGUNA]",
      `Nama: ${safeText(p.name, 80)}`,
      `Email: ${safeText(p.email, 120)}`,
      `Peran: ${ROLE_LABELS[p.role] ?? p.role}`,
      `Status akun: ${p.isActive ? "aktif" : "nonaktif"}`,
      `Bergabung sejak: ${p.joinedAt.toLocaleDateString("id-ID")}`,
      `Jumlah laporan dibuat: ${p.reportCount} | Tugas ditugaskan: ${p.taskCount}` +
        ` | Notifikasi belum dibaca: ${p.unreadNotifications}` +
        ` | Telegram: ${p.telegramConnected ? "terhubung" : "belum terhubung"}.`
    );
  }

  lines.push(
    `Total laporan: ${data.total} | Menunggu verifikasi: ${data.menunggu} | Selesai: ${data.selesai} | Prioritas KRITIS: ${data.kritis}.`
  );

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
 * Hitungan spesifik per status laporan, disesuaikan dengan peran:
 * ADMIN = seluruh laporan, PETUGAS = laporan yang ditugaskan kepadanya,
 * MASYARAKAT = laporan miliknya.
 */
const STATUS_COUNT_GROUPS: { key: RegExp; statuses: string[]; label: string }[] = [
  {
    key: /menunggu verifikasi|belum diverifikasi/,
    statuses: ["MENUNGGU_VERIFIKASI"],
    label: "menunggu verifikasi",
  },
  {
    key: /sedang diperbaiki|diperbaiki/,
    statuses: ["SEDANG_DIPERBAIKI"],
    label: "sedang diperbaiki",
  },
  {
    key: /diproses ai/,
    statuses: ["DIPROSES_AI"],
    label: "sedang diproses AI",
  },
  { key: /ditolak/, statuses: ["DITOLAK"], label: "ditolak" },
  {
    key: /ditugaskan|belum dikerjakan/,
    statuses: ["DITUGASKAN"],
    label: "sudah ditugaskan",
  },
  { key: /diterima/, statuses: ["DITERIMA"], label: "diterima" },
  { key: /selesai/, statuses: ["SELESAI"], label: "sudah selesai" },
];

export function answerStatusCountQuestion(
  message: string,
  data: ChatbotDbData,
  role: ChatbotRole
): string | null {
  const q = normalizeQuestion(message);

  if (!/berapa|jumlah|total/.test(q)) return null;
  // Pertanyaan durasi/waktu bukan pertanyaan jumlah.
  if (/berapa lama|kapan|estimasi|berapa hari|sampai kapan|lamanya|prosesnya/.test(q)) {
    return null;
  }
  // Ditangani khusus oleh jawaban admin (bukan status tunggal).
  if (/belum ditugaskan|siap ditugaskan|sudah diverifikasi|telah diverifikasi|terverifikasi/.test(q)) {
    return null;
  }

  const rows =
    role === "ADMIN"
      ? data.byStatus
      : role === "PETUGAS"
        ? data.taskByStatus
        : data.mineByStatus;
  const noun =
    role === "PETUGAS" && /\btugas\b/.test(q)
      ? "Tugas"
      : role === "ADMIN"
        ? "Laporan"
        : "Laporan Anda";

  if (/belum selesai/.test(q)) {
    const total =
      role === "ADMIN"
        ? data.total
        : role === "PETUGAS"
          ? (data.profile?.taskCount ?? 0)
          : (data.profile?.reportCount ?? 0);
    const selesai = countStatuses(rows, ["SELESAI"]);
    return `${noun} yang belum selesai ada ${total - selesai}.`;
  }

  for (const group of STATUS_COUNT_GROUPS) {
    if (group.key.test(q)) {
      return `${noun} yang ${group.label} ada ${countStatuses(rows, group.statuses)}.`;
    }
  }

  return null;
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

    if (/(telegram|chat id).*(saya|akun|terhubung|konek)|apakah.*telegram|status telegram|hubungkan telegram/.test(q)) {
      return p.telegramConnected
        ? "Akun Telegram Anda sudah terhubung."
        : "Akun Telegram Anda belum terhubung.";
    }

    if (asksName || asksEmail) {
      if (asksName && asksEmail) {
        return `Nama Anda ${p.name}, email Anda ${p.email}.`;
      }
      if (asksName) return `Nama Anda ${p.name}.`;
      return `Email Anda ${p.email}.`;
    }

    if (/profil|akun saya|data saya|identitas saya|status akun/.test(q)) {
      return (
        `Profil akun Anda:\n` +
        `- Nama: ${p.name}\n` +
        `- Email: ${p.email}\n` +
        `- Peran: ${roleLabel}\n` +
        `- Status akun: ${p.isActive ? "aktif" : "nonaktif"}\n` +
        `- Bergabung sejak: ${p.joinedAt.toLocaleDateString("id-ID")}\n` +
        `- Laporan dibuat: ${p.reportCount} | Tugas ditugaskan: ${p.taskCount}\n` +
        `- Notifikasi belum dibaca: ${p.unreadNotifications}\n` +
        `- Telegram: ${p.telegramConnected ? "terhubung" : "belum terhubung"}`
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
      return `Ada ${data.admin.verifiedUnassigned} laporan terverifikasi yang belum ditugaskan ke petugas.`;
    }

    if (/menunggu verifikasi|belum diverifikasi|perlu verifikasi/.test(q)) {
      return `Ada ${data.menunggu} laporan yang menunggu verifikasi.`;
    }

    if (/sudah diverifikasi|telah diverifikasi|terverifikasi|verified/.test(q)) {
      const verified = countStatuses(data.byStatus, VERIFIED_STATUSES);
      return `Ada ${verified} laporan yang sudah diverifikasi.`;
    }

    if (/ditolak|penolakan/.test(q)) {
      const rejected = countStatuses(data.byStatus, ["DITOLAK"]);
      return `Ada ${rejected} laporan yang ditolak.`;
    }

    if (/verifikasi/.test(q)) {
      return "Apakah maksud Anda laporan yang menunggu verifikasi atau laporan yang sudah diverifikasi?";
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

  // 12. Tugas petugas
  if (role === "PETUGAS" && (asksOwn || asksTask)) {
    if (data.tasks.length === 0) {
      return "Anda belum memiliki tugas perbaikan.";
    }
    const totalTasks = data.profile?.taskCount ?? data.tasks.length;
    const selesai = countStatuses(data.taskByStatus, ["SELESAI"]);
    if (/berapa|jumlah/.test(q)) {
      if (/belum selesai/.test(q)) {
        return `Anda memiliki ${totalTasks - selesai} tugas yang belum selesai.`;
      }
      if (/selesai/.test(q)) {
        return `Anda memiliki ${selesai} tugas yang sudah selesai.`;
      }
      if (/sedang diperbaiki|dikerjakan|proses/.test(q)) {
        return `Anda memiliki ${countStatuses(data.taskByStatus, ["SEDANG_DIPERBAIKI"])} tugas yang sedang diperbaiki.`;
      }
      if (/ditugaskan|belum dikerjakan/.test(q)) {
        return `Anda memiliki ${countStatuses(data.taskByStatus, ["DITUGASKAN"])} tugas yang belum dikerjakan.`;
      }
    }
    const list = data.tasks
      .map((t) => `• "${safeText(t.title, 80)}" — status ${t.status}, prioritas ${t.priority}`)
      .join("\n");
    const unfinished = totalTasks - selesai;
    return `Jumlah total tugas Anda ${totalTasks}; dari ${data.tasks.length} tugas terbaru, ${unfinished} belum selesai.\n${list}`;
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
