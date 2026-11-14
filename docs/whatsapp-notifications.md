# Integrasi Notifikasi WhatsApp (Fonnte)

Dokumen ini menjelaskan kanal notifikasi eksternal CirebonLapor setelah migrasi
dari Telegram ke WhatsApp melalui Fonnte API.

## Prinsip

- WhatsApp adalah satu-satunya kanal notifikasi eksternal.
- Setiap `createNotification()` tetap menyimpan notifikasi in-app terlebih
  dahulu, lalu mengantrekan pesan WhatsApp hanya bila pengguna memiliki nomor
  yang sudah **terverifikasi dan aktif**.
- Pengiriman WhatsApp tidak pernah memblokir atau membatalkan transaksi bisnis.
  Pesan masuk ke `whatsapp_outbox`, diproses setelah response selesai memakai
  `after()` dari Next.js, dengan retry dan deduplikasi.
- Notifikasi WhatsApp mengikuti aturan lama: hanya untuk role `MASYARAKAT`
  (pelapor). Admin dan petugas tetap menerima notifikasi in-app.
- Persetujuan administrator dan verifikasi OTP adalah dua status terpisah.

## Struktur modul

| File | Tanggung jawab |
| --- | --- |
| `src/lib/whatsapp/config.ts` | Env Fonnte, normalisasi nomor, masking, URL aplikasi |
| `src/lib/whatsapp/fonnte-service.ts` | HTTP client Fonnte, timeout, validasi respons, sanitasi error |
| `src/lib/whatsapp/messages.ts` | Format pesan WhatsApp dan OTP |
| `src/lib/whatsapp/linking.ts` | Pengajuan nomor, persetujuan, OTP, verifikasi, ganti nomor, pemutusan |
| `src/lib/whatsapp/outbox.ts` | Antrean, retry, deduplikasi, pemrosesan background |
| `src/app/api/settings/whatsapp/route.ts` | GET status, POST pengajuan, DELETE putuskan |
| `src/app/api/settings/whatsapp/verify/route.ts` | Verifikasi OTP |
| `src/app/api/settings/whatsapp/resend/route.ts` | Kirim ulang OTP oleh pengguna |
| `src/app/api/admin/whatsapp/registrations/route.ts` | Daftar, setujui, tolak, kirim ulang OTP (Admin) |
| `src/app/api/profile/route.ts` | Status WhatsApp pada profil |
| `src/app/(dashboard)/settings/whatsapp/page.tsx` | Halaman pengaturan pengguna |
| `src/app/(dashboard)/admin/whatsapp/page.tsx` | Halaman persetujuan administrator |
| `src/components/settings/WhatsAppSettings.tsx` | UI pengajuan, status, OTP, ganti nomor |
| `src/components/profile/WhatsAppLinkSection.tsx` | Ringkasan integrasi pada profil |
| `prisma/schema.prisma` | `WhatsappLink`, `WhatsappRegistration`, `WhatsappOtp`, `WhatsappOutbox` |
| `src/lib/notification-service.ts` | Deduplikasi event + enqueue WhatsApp fail-open |
| `src/lib/report-notification-service.ts` | Penerima dan isi pesan per event laporan |

## Alur pendaftaran dan verifikasi

1. Pengguna membuka `/settings/whatsapp` dan mengirim nomor.
2. Nomor dinormalisasi ke format internasional (mis. `0812...` → `62812...`).
3. Pengajuan disimpan dengan status `PENDING`.
4. Administrator membuka `/admin/whatsapp`, lalu menyetujui atau menolak.
5. Saat disetujui, status menjadi `APPROVED` dan OTP 6 digit dibuat.
6. OTP dikirim melalui Fonnte. Yang disimpan hanya hash bcrypt, bukan OTP asli.
7. Pengguna memasukkan OTP. Sistem memeriksa masa berlaku (10 menit), batas
   percobaan (5 kali), dan status sekali pakai.
8. Jika benar, `WhatsappLink` dibuat/diperbarui dan pengajuan menjadi
   `VERIFIED`. Nomor lama baru dihapus pada transaksi yang sama.
9. Jika administrator menolak, status menjadi `REJECTED` dan pengguna dapat
   mengajukan nomor lagi.

### Ganti nomor

Nomor lama tetap aktif selama nomor baru masih `PENDING`/`APPROVED`. Nomor lama
hanya dilepas setelah OTP nomor baru berhasil diverifikasi.

## Status

| Status | Arti |
| --- | --- |
| `PENDING` | Menunggu persetujuan administrator |
| `APPROVED` | Disetujui, menunggu verifikasi OTP |
| `REJECTED` | Ditolak administrator |
| `VERIFIED` | Nomor berhasil diverifikasi dan aktif |
| `CANCELLED` | Pengajuan dibatalkan karena ada pengajuan baru |

## Environment

```env
FONNTE_API_TOKEN="token-device-fonnte"
FONNTE_API_URL="https://api.fonnte.com/send"
FONNTE_COUNTRY_CODE="62"
```

Opsional:

```env
# Set false untuk menonaktifkan kanal WhatsApp tanpa menghapus konfigurasi.
FONNTE_NOTIFICATIONS_ENABLED="true"

# Set false saat tes agar outbox tidak diproses otomatis.
WHATSAPP_AUTO_PROCESS="true"
```

Token hanya dibaca di server (`src/lib/whatsapp/*`) dan tidak pernah dikirim ke
komponen client, body pesan, atau log. Error yang dicatat sudah disanitasi.

## Database

Schema memakai SQLite + Prisma. Proyek ini menggunakan `prisma db push` (bukan
folder migrations). Setelah mengubah schema:

```bash
npm run db:push
```

Tabel Telegram lama (`telegram_links`, `telegram_link_tokens`,
`telegram_outbox`) dihapus karena hanya berisi data penautan Telegram. Tabel
pengguna, laporan, notifikasi internal, dan transaksi lain tidak diubah.

## Event notifikasi eksternal

Event bisnis dipertahankan dari implementasi sebelumnya:

- Laporan berhasil dibuat.
- Laporan diverifikasi admin.
- Laporan ditolak admin.
- Petugas ditugaskan.
- Prioritas tugas diperbarui.
- Status penanganan berubah.
- Laporan selesai ditangani.

Penerima eksternal tetap hanya pelapor (`MASYARAKAT`) yang nomornya aktif.

## Pengujian

```bash
npm test
```

Tes memakai database SQLite terpisah (`prisma/test-whatsapp.db`) yang dibuat
ulang setiap kali tes dijalankan, dan mem-mock Fonnte API. Cakupan:

- normalisasi dan masking nomor;
- format pesan dan tautan aman;
- pengajuan `PENDING`, persetujuan, penolakan;
- pengiriman OTP, OTP salah, kedaluwarsa, batas percobaan;
- ganti nomor tanpa memutus nomor lama lebih awal;
- idempotensi, retry, batas percobaan, dan deduplikasi outbox;
- notifikasi in-app tetap berjalan;
- admin/petugas tidak menerima WhatsApp.

Untuk pengujian integrasi nyata, isi `FONNTE_API_TOKEN` dengan token device yang
aktif dan gunakan nomor WhatsApp yang benar-benar dapat menerima pesan.

## Operasional

- Pantau jumlah baris `whatsapp_outbox` berstatus `FAILED` dan `last_error`.
- Jika token device berubah, perbarui `FONNTE_API_TOKEN` lalu restart server.
- OTP tidak pernah masuk ke outbox maupun log, sehingga tidak dapat dipulihkan
  dari database. Gunakan tombol **Kirim Ulang OTP** bila pengguna tidak
  menerimanya.
