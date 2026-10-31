# Integrasi Notifikasi Telegram

Dokumen ini menjelaskan implementasi notifikasi Telegram pada CirebonLapor
(Next.js 16 App Router, Prisma 5, SQLite, NextAuth v4).

## Ringkasan arsitektur

- Notifikasi in-app yang sudah ada tetap menjadi sumber utama (`Notification`).
- Telegram adalah kanal tambahan. Setiap `createNotification()` menyimpan
  notifikasi in-app, lalu mengantrekan pesan Telegram hanya bila pengguna
  sudah menautkan chat yang terverifikasi.
- Pengiriman Telegram tidak pernah memblokir atau membatalkan transaksi bisnis.
  Pesan masuk ke `telegram_outbox`, diproses setelah response selesai memakai
  `after()` dari Next.js, dan dapat di-retry oleh cron.
- Chat ID tidak pernah diterima dari input pengguna. Chat ID hanya disimpan
  setelah token pengaitan diverifikasi lewat webhook Telegram.
- Token pengaitan disimpan sebagai hash SHA-256, berlaku 10 menit, sekali pakai,
  dan hanya berlaku untuk akun yang membuatnya.

Alur pengaitan:

1. Pengguna login lalu membuka `/settings/telegram`.
2. `POST /api/settings/telegram` membuat token acak dan mengembalikan deep link
   `https://t.me/<bot>?start=<token>` (token mentah tidak dikirim terpisah).
3. Pengguna menekan Start di bot.
4. Telegram mengirim update ke `POST /api/telegram/webhook`.
5. Webhook memvalidasi `X-Telegram-Bot-Api-Secret-Token`, lalu menukar token
   dengan Chat ID. Hanya hash token yang dicocokkan di database.
6. `telegram_links` menyimpan relasi satu-ke-satu akun aplikasi dan Chat ID.
7. Pengguna dapat memutus koneksi dari halaman pengaturan atau `/disconnect`.

## File baru

| File | Fungsi |
| --- | --- |
| `src/lib/telegram/config.ts` | Konfigurasi env, URL aplikasi, validasi deep link |
| `src/lib/telegram/bot-service.ts` | Klien Bot API, timeout, sanitasi error |
| `src/lib/telegram/messages.ts` | Escape HTML dan format pesan per role |
| `src/lib/telegram/linking.ts` | Token pengaitan, konsumsi token, status, pemutusan |
| `src/lib/telegram/outbox.ts` | Antrean, retry, deduplikasi, pemrosesan background |
| `src/lib/telegram/webhook-auth.ts` | Perbandingan secret constant-time |
| `src/lib/report-notification-service.ts` | Penentuan penerima per role dan penyusunan pesan laporan |
| `src/app/api/settings/telegram/route.ts` | GET status, POST buat deep link, DELETE putuskan |
| `src/app/api/telegram/webhook/route.ts` | Penerima update Telegram |
| `src/app/api/telegram/worker/route.ts` | Endpoint cron retry outbox (opsional) |
| `src/app/settings/telegram/page.tsx` | Halaman pengaturan Telegram |
| `src/components/settings/TelegramSettings.tsx` | UI koneksi, status, dan instruksi |
| `scripts/telegram-set-webhook.ts` | Registrasi/hapus webhook |
| `scripts/telegram-check.ts` | Diagnostik token, secret, URL, dan webhook terdaftar |
| `scripts/load-env.ts` | Memuat `.env` untuk script CLI (sebelumnya tidak termuat) |
| `scripts/prepare-test-db.mjs` | Menyiapkan database tes terpisah |
| `tests/*.test.ts` | Tes integrasi Telegram |

## File lama yang diubah

| File | Perubahan |
| --- | --- |
| `prisma/schema.prisma` | `TelegramLink`, `TelegramLinkToken`, `TelegramOutbox`, `Notification.eventKey` |
| `src/lib/notification-service.ts` | Deduplikasi event + enqueue Telegram fail-open |
| `src/app/api/reports/route.ts` | Notifikasi pembuatan laporan (masyarakat, admin, petugas) |
| `src/app/api/admin/reports/[id]/route.ts` | Verifikasi, penolakan, penugasan, prioritas |
| `src/app/api/tasks/[id]/status/route.ts` | Status pengerjaan dan penyelesaian |
| `src/components/shared/Navbar.tsx` | Tautan ke pengaturan Telegram |
| `src/proxy.ts` | Proteksi route `/settings` |
| `.gitignore` | Pengecualian `.env.example` dan DB tes |
| `package.json` | Script tes dan webhook |
| `.env.example` | Variabel Telegram |

## Database

Tabel baru:

- `telegram_links` — `chat_id` unik, `user_id` unik, `telegram_username`,
  `connected_at`. Satu akun aplikasi hanya punya satu chat, dan satu chat tidak
  dapat ditautkan ke dua akun.
- `telegram_link_tokens` — `token_hash` unik, `expires_at`, `used_at`,
  `user_id` dengan foreign key cascade.
- `telegram_outbox` — `dedupe_key` unik, `chat_id`, `message`, `status`,
  `attempts`, `last_error`, `next_attempt_at`, `sent_at`, `user_id`.

Kolom baru:

- `notifications.event_key` (unik, nullable) untuk idempotensi per penerima.

Proyek ini memakai `prisma db push` (bukan folder migrasi). Jalankan:

```bash
npm run db:push
```

Jika Prisma meminta konfirmasi karena penambahan unique constraint:

```bash
npx prisma db push --accept-data-loss
```

Aman untuk data lama karena semua nilai `event_key` yang sudah ada bernilai
`NULL` dan SQLite mengizinkan banyak `NULL` pada kolom unik.

## Konfigurasi environment

Salin `.env.example` lalu isi:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="string-acak-panjang"

APP_URL="http://localhost:3000"

TELEGRAM_BOT_TOKEN="123456789:token-dari-botfather"
TELEGRAM_BOT_USERNAME="NamaBotAnda_bot"
TELEGRAM_NOTIFICATIONS_ENABLED="true"

TELEGRAM_WEBHOOK_SECRET="secret-acak-minimal-32-karakter"
TELEGRAM_WORKER_SECRET="secret-acak-lain-untuk-cron"
```

Catatan:

- `TELEGRAM_BOT_TOKEN` tidak boleh muncul di frontend, log, atau pesan error.
- `TELEGRAM_BOT_USERNAME` tanpa awalan `@`.
- `APP_URL` dipakai untuk deep link dan tautan detail laporan.
- `TELEGRAM_WORKER_SECRET` opsional. Bila kosong, endpoint worker nonaktif.

## Membuat bot melalui BotFather

1. Buka Telegram, cari `@BotFather`, lalu kirim `/newbot`.
2. Isi nama bot dan username yang diakhiri `bot`.
3. Salin token ke `TELEGRAM_BOT_TOKEN` dan username ke `TELEGRAM_BOT_USERNAME`.
4. Opsional: atur deskripsi dan foto bot melalui BotFather.
5. Jangan pernah membagikan token bot.

## Menjalankan webhook

Implementasi ini memakai **webhook** (bukan polling), sehingga tidak ada dua
proses yang saling berebut `getUpdates`.

Produksi (wajib HTTPS):

```bash
npm run telegram:webhook
# atau tanpa mengubah .env:
npm run telegram:webhook -- --url https://domain-anda
```

Periksa konfigurasi kapan saja (token tidak dicetak):

```bash
npm run telegram:check
```

Jika bot tidak membalas `/start`, penyebab paling umum adalah webhook belum
terdaftar, `TELEGRAM_WEBHOOK_SECRET` kosong, atau `APP_URL` masih localhost.
Endpoint webhook akan mengembalikan 503 bila secret kosong dan Telegram tidak
dapat memanggil `http://localhost`. Untuk localhost, gunakan mode polling
(`TELEGRAM_USE_POLLING="true"`).

Script memanggil `setWebhook` dengan:

- `url = ${APP_URL}/api/telegram/webhook`
- `secret_token = TELEGRAM_WEBHOOK_SECRET`
- `allowed_updates = ["message"]`

Hapus webhook:

```bash
npm run telegram:webhook:delete
```

Pengembangan lokal: Telegram memerlukan URL HTTPS publik. Gunakan tunnel
seperti ngrok/cloudflared, lalu set `APP_URL` ke URL tunnel tersebut sebelum
menjalankan script webhook. Contoh:

```bash
ngrok http 3000
npm run telegram:webhook -- --url https://xxxx.ngrok-free.app
npm run telegram:check -- --url https://xxxx.ngrok-free.app
```

Tunnel harus tetap berjalan selama pengujian. Jika URL tunnel berubah,
daftarkan ulang webhook dengan URL baru.

Jika `APP_URL` atau secret berubah, daftarkan ulang webhook.

## Mode polling (pengembangan lokal)

Untuk pengembangan tanpa tunnel HTTPS, aktifkan:

```env
TELEGRAM_USE_POLLING="true"
```

Saat `npm run dev` atau `next start` dijalankan, `src/instrumentation.ts`
menyalakan polling `getUpdates` di background selama server hidup. Webhook
tidak perlu didaftarkan dan `TELEGRAM_WEBHOOK_SECRET` tidak wajib. Saat polling
dimulai, webhook lama dihapus otomatis agar `getUpdates` tidak gagal dengan
error 409.

Catatan:

- Hanya jalankan satu instance aplikasi per token bot pada mode polling.
- Kembali ke mode webhook dengan `TELEGRAM_USE_POLLING="false"`, lalu daftarkan
  ulang webhook memakai `npm run telegram:webhook`.
- Endpoint `GET /api/telegram/poll` tetap tersedia untuk memicu satu putaran
  polling secara manual (mis. untuk diagnostik).

## Retry dan background worker

- Setelah response, `after()` memproses outbox secara otomatis.
- Outbox memakai klaim atomik (`PROCESSING`) agar beberapa worker tidak
  mengirim pesan yang sama.
- Maksimal 3 percobaan dengan jeda 30 detik, 2 menit, lalu 5 menit.
- Pesan untuk pengguna yang sudah memutus koneksi ditandai gagal tanpa dikirim.
- Untuk deployment yang sering tidur (serverless), buat cron setiap 1 menit:

```bash
curl -X POST https://domain-anda/api/telegram/worker \
  -H "Authorization: Bearer $TELEGRAM_WORKER_SECRET"
```

Endpoint mengembalikan ringkasan `{ sent, failed, retried }`.

## Pemicu notifikasi

### Masyarakat

- Laporan berhasil dibuat (termasuk hasil verifikasi/penolakan otomatis AI).
- Laporan ditolak, beserta alasan dari admin.
- Laporan diverifikasi.
- Petugas ditugaskan.
- Status penanganan berubah menjadi `SEDANG_DIPERBAIKI`.
- Laporan selesai (`SELESAI`).

### Admin

- Laporan baru masuk / menunggu pemeriksaan (dikirim ke semua akun `ADMIN`
  aktif, sesuai kebijakan akses global admin pada proyek ini).
- Laporan terverifikasi dan siap ditugaskan.
- Laporan selesai ditangani petugas (informasi; sistem tidak memiliki tahap
  verifikasi ulang setelah `SELESAI`).

### Petugas

- Penugasan laporan baru (`ASSIGN`).
- Laporan terverifikasi yang siap ditugaskan (semua petugas aktif).
- Perubahan prioritas pada tugas yang sudah ditugaskan.

Catatan workflow yang tidak diubah: proyek belum memiliki status revisi
masyarakat, pembatalan tugas, pengalihan tugas, atau fitur catatan instruksi
admin pada penugasan. Karena itu fitur tersebut tidak dibuat dan tidak ada
status baru yang dikarang. Alasan penolakan admin tetap dikirim sebagai
catatan pada notifikasi penolakan.

## Format dan keamanan pesan

- Parse mode HTML. Semua nilai dinamis di-escape (`escapeHtml`).
- Tautan hanya menerima path internal; URL eksternal/open redirect ditolak.
- Pesan memuat nomor referensi laporan dengan konvensi UI yang ada
  (`#` + enam karakter terakhir ID), judul, status, waktu, catatan, dan tautan
  setelah login.
- Chat ID lengkap tidak ditampilkan di frontend (hanya `••••` + 4 digit akhir).
- Log tidak memuat token bot, token pengaitan, Chat ID, atau isi pesan.
- Error dari Bot API disanitasi dan dipotong sebelum disimpan.

## Pengujian otomatis

```bash
npm test
```

Tes memakai database SQLite terpisah (`prisma/test-telegram.db`) yang dibuat
ulang setiap kali tes dijalankan, dan mem-mock Telegram Bot API. Cakupan:

- token valid, token kedaluwarsa, token dipakai ulang;
- chat yang sudah terhubung ke akun lain ditolak;
- pemutusan koneksi hanya untuk akun sendiri;
- Chat ID tidak bocor penuh;
- notifikasi laporan baru hanya ke pelapor, admin aktif, dan (untuk hasil AI)
  petugas aktif;
- verifikasi, penolakan, penugasan, perubahan prioritas, dan penyelesaian
  dikirim ke penerima yang tepat serta tidak ke pengguna lain;
- admin/petugas nonaktif tidak menerima notifikasi;
- deduplikasi event dan antrean;
- kegagalan Telegram tidak membatalkan notifikasi/data utama;
- retry berhenti setelah batas percobaan;
- webhook menolak secret yang salah/kosong;
- pesan Telegram meng-escape HTML dan menolak tautan berbahaya.

Total: 37 tes otomatis (termasuk 6 tes konteks chatbot: profil personal per
peran, tugas petugas, statistik admin, dan saran pertanyaan).

Pemeriksaan tambahan:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Uji manual

1. Jalankan `npm run dev`.
2. Login sebagai masyarakat, buka ikon pengaturan di navbar.
3. Klik **Hubungkan Telegram**, buka deep link, tekan Start.
4. Pastikan status berubah menjadi **Terhubung** dan Chat ID tampil tersamar.
5. Buat laporan baru; bot harus mengirim notifikasi.
6. Login admin, verifikasi/tolak/tugaskan laporan; cek notifikasi masyarakat
   dan petugas.
7. Login petugas, mulai dan selesaikan tugas; cek notifikasi masyarakat dan
   admin.
8. Klik **Putuskan Koneksi**; pastikan notifikasi Telegram berhenti.

## Catatan produksi

- Wajib HTTPS untuk webhook Telegram.
- Simpan token dan secret di secret manager platform, bukan di repository.
- Jalankan cron worker bila proses server dapat berhenti sebelum `after()`
  selesai.
- Pastikan worker dan webhook hanya berjalan pada satu deployment ID yang
  memakai database yang sama.
- Pantau jumlah baris `telegram_outbox` berstatus `FAILED` dan `last_error`.
