# CirebonLapor — Sistem Pelaporan Fasilitas Umum

## 1. Identitas

| Keterangan            | Isi                                                                    |
| --------------------- | ---------------------------------------------------------------------- |
| **Nama**              | Dhamar Dwi Syahbani                                                    |
| **NIM**               | 41257098                                                               |
| **Kelompok**          | RPL-01                                                                 |
| **Tema**              | Smart City & Civic Technology                                          |
| **Topik**             | Sistem Pelaporan & Monitoring Fasilitas Umum Berbasis AI               |
| **Repositori GitHub** | https://github.com/dhamardwi/proyek-rpl-DhamarDwiSyahbani-CirebonLapor |
| **Link Video Demo**   | https://youtu.be/JPmSAc1cV1k                                           |

---

## 2. Deskripsi Aplikasi

CirebonLapor adalah aplikasi web pelaporan fasilitas umum di Kota Cirebon. Masyarakat dapat mengirim laporan kerusakan (jalan, jembatan, penerangan, drainase, dan lain-lain) lengkap dengan foto dan titik lokasi. Laporan kemudian diverifikasi oleh Admin, ditugaskan kepada Petugas, dan dikerjakan hingga status `SELESAI`. Seluruh perubahan status tercatat sebagai riwayat dan memicu notifikasi in-app serta WhatsApp (Fonnte) bagi penerima yang berhak.

### Fitur utama

- **Role & akses:** `MASYARAKAT` membuat laporan; `ADMIN` memverifikasi, menolak, menugaskan, dan mengubah prioritas; `PETUGAS` mengerjakan tugas dan mengunggah bukti perbaikan.
- **Peta sebaran laporan** dengan filter jenis fasilitas, status, prioritas, dan tingkat kerusakan (maksimal 500 titik).
- **Alur laporan:** `MENUNGGU_VERIFIKASI` → `DITERIMA` → `DITUGASKAN` → `SEDANG_DIPERBAIKI` → `SELESAI` (status `DITOLAK` tersedia untuk penolakan).
- **Upload gambar** dengan validasi tipe (JPG/PNG) dan ukuran maksimal 5 MB; foto disimpan di `public/uploads/reports`.
- **Notifikasi** in-app + WhatsApp via Fonnte dengan antrean (`whatsapp_outbox`), retry, deduplikasi, dan verifikasi OTP untuk penautan nomor.
- **Riwayat status** dan manajemen pengguna Admin.
- **Pengujian otomatis:** 7 suite / 150 test (RBAC, API, WhatsApp, AI config, chatbot) + GitHub Actions CI.

### Fitur AI

- **Deteksi laporan duplikat:** skor kemiripan lokal dari judul/deskripsi, kategori fasilitas, jarak koordinat (haversine), dan perceptual hash gambar (`sharp`). Hasil disimpan sebagai `ReportDuplicateAnalysis` untuk ditinjau Admin.
- **Konfigurasi AI (NVIDIA NIM):** halaman Admin untuk mengelola API key (terenkripsi), base URL, dan model; tersedia uji koneksi tanpa mengaktifkan modul lain.
- **Chatbot:** asisten berbasis aturan dan data dashboard, dengan jawaban yang dibatasi sesuai role pengguna.
- **Moderasi gambar otomatis:** saat ini **nonaktif (stub)** — laporan baru tetap masuk antrean **verifikasi manual**. Tidak ada provider AI yang dipanggil secara otomatis.

## 3. Petunjuk Instalasi Aplikasi (Setup Instruction)

### 3.1 Prasyarat

- **Node.js** 20.9+ (disarankan 24.x — digunakan pada CI)
- **npm**
- Git

### 3.2 Langkah instalasi

```bash
# 1. Clone repositori
git clone https://github.com/dhamardwi/proyek-rpl-DhamarDwiSyahbani-CirebonLapor.git
cd proyek-rpl-DhamarDwiSyahbani-cirebonlapor

# 2. Instal dependensi
npm ci

# 3. Buat file .env di root proyek (lihat daftar di bawah)

# 4. Buat/sinkronkan skema database Prisma (SQLite)
npx prisma db push

# 5. Isi data awal (jenis fasilitas & akun demo)
npm run db:seed

# 6. Jalankan aplikasi
npm run dev
```

Buka `http://localhost:3000`.

> Detail alur penautan nomor, OTP, dan outbox WhatsApp ada di [`docs/whatsapp-notifications.md`](docs/whatsapp-notifications.md).

### 3.3 Akun demo (dari seed)

| Role       | Email                      | Password         |
| ---------- | -------------------------- | ---------------- |
| Admin      | `admin@cirebonlapor.id`    | `Admin@123456`   |
| Petugas    | `petugas1@cirebonlapor.id` | `Petugas@123456` |
| Masyarakat | `warga1@example.com`       | `Warga@123456`   |

> Ganti password default sebelum digunakan di lingkungan produksi.

### 3.4 Perintah pengujian & build

```bash
npm run test        # seluruh suite pengujian (database test: prisma/test-whatsapp.db)
npm run lint        # ESLint
npx tsc --noEmit    # pengecekan tipe TypeScript
npm run build       # build produksi
npm start           # jalankan hasil build
```

### 3.5 Catatan database & penyimpanan

- Aplikasi memakai **SQLite** (`prisma/dev.db`) dan menyimpan foto laporan di **filesystem** (`public/uploads/reports`). Karena itu, deployment sebaiknya menggunakan **server/VPS dengan storage persisten**, bukan platform serverless dengan filesystem sementara.
- Seluruh pengujian otomatis hanya memakai `prisma/test-whatsapp.db` dan tidak menyentuh database development.
- Pipeline GitHub Actions (`.github/workflows/ci.yml`) menjalankan `lint`, `tsc`, `test`, dan `build` pada setiap push/pull request ke `main`.

---

## 4. Struktur Singkat

```
src/
├── app/
│   ├── api/            # endpoint Next.js (auth, reports, admin, tasks, settings, WA)
│   ├── (public)/       # halaman login, register, landing, peta
│   └── (dashboard)/    # dashboard Admin / Petugas / Masyarakat
├── components/         # komponen UI (admin, profile, tasks, map, settings, shared)
├── hooks/              # custom hook (user management, profile data)
└── lib/                # auth, db, notifikasi, WhatsApp, AI, duplicate, helper
prisma/                 # schema & seed
tests/                  # pengujian otomatis
scripts/                # runner test & persiapan database test
.github/workflows/      # CI GitHub Actions
```
