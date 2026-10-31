/**
 * prisma/seed.ts
 * Seed data untuk: FacilityType, User (admin, petugas, masyarakat)
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ------------------------------------
// Seed Data: Facility Types
// ------------------------------------
const facilityTypes = [
  {
    name: "Jalan",
    description: "Jalan raya, gang, jalan desa, trotoar",
  },
  {
    name: "Jembatan",
    description: "Jembatan beton, jembatan kayu, jembatan gantung",
  },
  {
    name: "Penerangan",
    description: "Lampu jalan, lampu taman, penerangan umum",
  },
  {
    name: "Air Bersih",
    description: "Saluran PDAM, pipa air, sumur umum, reservoir",
  },
  {
    name: "Saluran Drainase",
    description: "Got, selokan, saluran irigasi, gorong-gorong",
  },
  {
    name: "Taman & RTH",
    description: "Taman bermain, ruang terbuka hijau, lapangan",
  },
  {
    name: "Fasilitas Olahraga",
    description: "Lapangan sepak bola, lapangan bulu tangkis, GOR",
  },
  {
    name: "Gedung Pemerintahan",
    description: "Balai desa, kantor kecamatan, posyandu, polindes",
  },
  {
    name: "Tempat Ibadah",
    description: "Masjid, musola, gereja, pura yang dikelola pemerintah desa",
  },
  {
    name: "Tempat Pembuangan Sampah",
    description: "TPS, TPA, bak sampah komunal",
  },
  {
    name: "Lainnya",
    description: "Fasilitas umum lain yang tidak termasuk kategori di atas",
  },
];

// ------------------------------------
// Seed Data: Users
// ------------------------------------
const SALT_ROUNDS = 12;

const seedUsers = [
  {
    name: "Admin",
    email: "admin@cirebonlapor.id",
    password: "Admin@123456",
    role: "ADMIN",
  },
  {
    name: "Petugas 1",
    email: "petugas1@cirebonlapor.id",
    password: "Petugas@123456",
    role: "PETUGAS",
  },
  {
    name: "Petugas 2",
    email: "petugas2@cirebonlapor.id",
    password: "Petugas@123456",
    role: "PETUGAS",
  },
  {
    name: "Warga 1",
    email: "warga1@example.com",
    password: "Warga@123456",
    role: "MASYARAKAT",
  },
  {
    name: "Warga 2",
    email: "warga2@example.com",
    password: "Warga@123456",
    role: "MASYARAKAT",
  },
];

async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function upsertUser(data: (typeof seedUsers)[number]) {
  const email = data.email.trim().toLowerCase();
  const password = await hashPassword(data.password);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: data.name,
      password,
      role: data.role,
      isActive: true,
    },
    create: {
      name: data.name,
      email,
      password,
      role: data.role,
    },
  });

  console.log(`  ✓ ${data.role.padEnd(8)} : ${user.email}`);
  return user;
}

async function main() {
  console.log("🌱 Starting database seed...\n");

  // ----------------------------------------
  // 1. Seed Facility Types (upsert)
  // ----------------------------------------
  console.log("📁 Seeding facility types...");
  for (const ft of facilityTypes) {
    const result = await prisma.facilityType.upsert({
      where: { name: ft.name },
      update: { description: ft.description },
      create: ft,
    });
    console.log(`  ✓ ${result.name}`);
  }

  // ----------------------------------------
  // 2. Seed Users (admin, petugas, masyarakat)
  // ----------------------------------------
  console.log("\n👤 Seeding users...");

  const usersByEmail = new Map<string, Awaited<ReturnType<typeof upsertUser>>>();

  for (const data of seedUsers) {
    const user = await upsertUser(data);
    usersByEmail.set(user.email, user);
  }

  const admin = usersByEmail.get("admin@cirebonlapor.id")!;
  const petugas1 = usersByEmail.get("petugas1@cirebonlapor.id")!;
  const warga1 = usersByEmail.get("warga1@example.com")!;
  const warga2 = usersByEmail.get("warga2@example.com")!;

  // ----------------------------------------
  // 3. Seed Sample Reports (untuk development)
  // ----------------------------------------
  console.log("\n📋 Seeding sample reports...");

  const jalan = await prisma.facilityType.findUnique({ where: { name: "Jalan" } });
  const drainase = await prisma.facilityType.findUnique({ where: { name: "Saluran Drainase" } });

  if (jalan && drainase) {
    const report1 = await prisma.report.upsert({
      where: { id: "seed-report-001" },
      update: {},
      create: {
        id: "seed-report-001",
        title: "Jalan Berlubang di Depan Pasar Desa",
        description:
          "Terdapat lubang besar di tengah jalan utama depan pasar desa. Berbahaya bagi pengendara, sudah ada 2 motor yang terperosok.",
        damageType: "Lubang aspal",
        damageLevel: "BERAT",
        priority: "TINGGI",
        address: "Jl. Pasar Desa No. 1, Desa Sukamaju",
        latitude: -6.7320,
        longitude: 108.5523,
        status: "MENUNGGU_VERIFIKASI",
        userId: warga1.id,
        facilityTypeId: jalan.id,
      },
    });

    // Tambah status history untuk report 1
    await prisma.reportStatusHistory.upsert({
      where: { id: "seed-history-001" },
      update: {},
      create: {
        id: "seed-history-001",
        reportId: report1.id,
        status: "MENUNGGU_VERIFIKASI",
        note: "Laporan baru diterima sistem",
        updatedById: warga1.id,
      },
    });

    console.log(`  ✓ Laporan: "${report1.title}"`);

    const report2 = await prisma.report.upsert({
      where: { id: "seed-report-002" },
      update: {},
      create: {
        id: "seed-report-002",
        title: "Saluran Drainase Tersumbat di RT 03",
        description:
          "Saluran got di RT 03 tersumbat sampah plastik, menyebabkan genangan air saat hujan dan bau tidak sedap.",
        damageType: "Tersumbat sampah",
        damageLevel: "SEDANG",
        priority: "SEDANG",
        address: "Gang Mawar RT 03 RW 01, Desa Sukamaju",
        latitude: -6.7345,
        longitude: 108.5501,
        status: "DITUGASKAN",
        userId: warga2.id,
        assignedTo: petugas1.id,
        facilityTypeId: drainase.id,
        aiAnalysis: JSON.stringify({
          category: "Saluran Drainase",
          damageLevel: "SEDANG",
          priority: "SEDANG",
          reasoning:
            "Berdasarkan foto, terlihat saluran tersumbat sampah plastik. Perlu pembersihan segera untuk mencegah banjir.",
          confidence: 0.87,
        }),
      },
    });

    // Status history untuk report 2
    const histories = [
      {
        id: "seed-history-002a",
        status: "MENUNGGU_VERIFIKASI",
        note: "Laporan baru diterima sistem",
        updatedById: warga2.id,
      },
      {
        id: "seed-history-002b",
        status: "DIPROSES_AI",
        note: "Laporan sedang dianalisis oleh sistem AI",
        updatedById: admin.id,
      },
      {
        id: "seed-history-002c",
        status: "DITERIMA",
        note: "Laporan telah diverifikasi dan disetujui",
        updatedById: admin.id,
      },
      {
        id: "seed-history-002d",
        status: "DITUGASKAN",
        note: "Ditugaskan ke Petugas 1 untuk penanganan",
        updatedById: admin.id,
      },
    ];

    for (const h of histories) {
      await prisma.reportStatusHistory.upsert({
        where: { id: h.id },
        update: {},
        create: { ...h, reportId: report2.id },
      });
    }

    console.log(`  ✓ Laporan: "${report2.title}"`);
  }

  // ----------------------------------------
  // Summary
  // ----------------------------------------
  const userCount = await prisma.user.count();
  const facilityTypeCount = await prisma.facilityType.count();
  const reportCount = await prisma.report.count();

  console.log("\n✅ Seed selesai!");
  console.log(`   👤 Users         : ${userCount}`);
  console.log(`   📁 Facility Types: ${facilityTypeCount}`);
  console.log(`   📋 Reports       : ${reportCount}`);
  console.log("\n🔑 Login credentials:");
  for (const user of seedUsers) {
    console.log(`   ${user.role.padEnd(10)}: ${user.email.padEnd(28)} | ${user.password}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
