# Support Playbook

Status: Sprint 48 operational baseline.

Playbook ini ditujukan untuk operator support yang menangani buyer Portfolio OS Template. Semua langkah bisa diikuti tanpa membaca source code. Jangan menyalin nilai `.env.local`, token, password, API key, atau data personal buyer ke chat, tiket, atau dokumen publik.

## Kebiasaan Wajib: Mutasi → Baca Ulang → Laporkan

Berlaku untuk SEMUA tindakan yang mengubah data (status order, suspend site, reset
password, ubah harga, deploy, hapus file). Sebelum mengatakan "selesai" ke klien atau
owner:

1. **Catat** perintah/tombol apa yang Anda jalankan.
2. **Baca ulang hasilnya** lewat jalur baca yang independen — GET API, query SELECT,
   atau buka halamannya di browser — dan cocokkan dengan yang dijanjikan.
3. **Laporkan dengan bukti**: sebut nilai yang terbaca (mis. `status = active`, kode
   respons, tangkapan layar) — bukan sekadar "sudah".
4. Baca ulang tidak cocok? **Jangan dilaporkan sukses** — ulangi, lalu eskalasi (§9)
   bila tetap gagal.

Contoh: setelah `PUT /api/admin/sites` → jalankan `GET /api/admin/sites` dan pastikan
kolom `status` benar-benar berubah. Setelah deploy → buka URL-nya dari browser, jangan
hanya melihat log `wrangler` sukses.

## Prasyarat Operator

Sebelum menangani tiket support, pastikan:

- Akses admin tersedia: bisa login ke `/admin` di situs klien (kredensial ada di `arsip-klien/<slug>/config.env` dan di API portal `/api/clients`).
- Akses portal onboarding `PENGELOLA_KLIEN.bat` (web `localhost:4567`) untuk provisioning dan status klien. Tidak ada panel pusat multi-klien — panel `clientDashboard`/`paymentConfig` sudah dibuang dari registry admin; panel **Pesanan** (`/admin/system/orders`, v1.3.29) milik site owner sendiri, bukan panel klien.
- CLI tersedia di mesin lokal yang sudah clone repo dan `.env.local` menunjuk ke production Cloudflare.
- Familiar dengan Cloudflare Dashboard untuk cek Worker logs dan D1/R2 status.

Tools CLI yang sering dipakai:

```bash
npm run monitoring:synthetic -- --url <production-url> --site-slug <slug>
npm run cf:readiness
npm run media:audit-projects
```

## 0. Alur Order & Pembayaran (Chat-First) — dibaca dulu sebelum sentuh order

**Alur utama sejak v1.3.40 adalah chat-first:** pembeli menghubungi owner lewat WhatsApp
dulu, deal, **lalu owner membuat order dari panel Pesanan** dan menyalin link checkout ke
pembeli. Form checkout publik (`/checkout`) tetap terbuka untuk pembeli yang mengisi
sendiri — keduanya memakai mesin order yang sama.

Alur owner (ringkas):

1. Chat dengan pembeli → sepakati harga, template, dan slug.
2. `/admin/system/orders` → **Buat Pesanan** → isi nama, email, WA, slug, template.
3. **Salin link checkout** dari kotak hijau yang muncul → kirim ke pembeli via WhatsApp.
   ⚠️ Link hanya tampil **sekali** saat pembuatan (token tidak disimpan mentah di server).
   Pembeli yang kehilangan link bisa dibantu lewat email struk (ada tautan yang sama).
4. Pembeli bayar + upload bukti → notifikasi Telegram masuk.
5. **Cek mutasi rekening → baru klik Aktifkan** (lihat kotak peringatan di bawah).
6. Lanjut ke Bengkel 6 langkah (deploy) → serah terima.

### ⚠️ Kebiasaan wajib: Cek Mutasi → Aktifkan → Deploy

Tiga langkah ini **berurutan dan tidak boleh dilompati**:

- **Notifikasi Telegram / bukti terunggah BUKAN izin deploy.** Bukti bayar bisa berupa
  gambar hasil suntingan. Satu-satunya bukti nyata adalah **mutasi di rekening Anda sendiri**
  dengan nominal yang cocok (kolom `amount` di panel = kode unik yang harus persis masuk).
- Urutan benar: **cek mutasi → klik Aktifkan di panel (atau tombol Telegram) → deploy.**
- Terlanjur ada yang minta "langsung saja"? Order tetap bisa diaktifkan telat
  (aksi Aktifkan pada order `expired`, otomatis pakai `allowExpired`) — jangan pernah
  deploy dari order yang belum `activated`.

### Pembeli bayar telat (order sudah kedaluwarsa)

Gejala: pembeli bilang "sudah saya transfer" padahal ordernya `expired`/`canceled`, atau
link checkout sudah mati (24 jam).

1. **Jangan minta transfer ulang.** Minta ID ordernya, lalu cek mutasi Anda sendiri —
   nominal unik menunjuk ordernya mana.
2. Uang benar masuk → **Buka Kembali** order (tombol di panel, atau tombol Telegram
   "Buka Kembali Order"). Dari `canceled` bukti lama sudah dibersihkan → pembeli diminta
   upload ulang bukti.
3. Kalau order sudah `expired` dan buktinya jelas → **Aktifkan** (aktivasi telat).
4. Orderan kedaluwarsa memang sengaja dilepas otomatis 24 jam supaya nominal unik tidak
   terkunci — ini perilaku normal, bukan gangguan.

### Jangan ubah langsung database

Jangan pernah mengubah `status`/`amount`/`payment_proof_url` di D1 lewat SQL manual.
Semua transisi status lewat panel Pesanan, tombol Telegram, atau API-nya —
agar jejak audit (`audit_logs`) tetap utuh dan race condition tetap terkunci.

## 1. Client Tidak Bisa Login

### Gejala

Client melaporkan tidak bisa login di `/admin/login` (tidak ada halaman login per-site).

### Langkah Diagnosa

1. **Cek status site:**
   - Cek kolom `status` pada tabel `sites` di D1 klien — bisa lewat API `GET /api/admin/sites`
     (cookie admin situs klien) atau query D1 langsung.
   - Jika status `suspended`, site tidak bisa diakses. Lihat bagian Suspend/Activate.

2. **Cek akun panel client:**
   - Portal onboarding sudah men-seed email + password admin — datanya ada di
     `arsip-klien/<slug>/config.env` dan di API portal `/api/clients`. `/setup` bukan bagian
     alur normal (`POST /api/setup` membalas 400 kalau admin sudah ada).
   - Kalau kredensial hilang, reset password dari komputermu:
     `npx tsx scripts/cloudflare/reset-customer-password.ts <folder-arsip> --email admin@klien.com --generate`

3. **Cek rate limit:**
   - Login endpoint dilindungi rate limit.
   - Jika client terlalu banyak gagal login, mereka akan di-block sementara.
   - Tunggu cooldown (biasanya beberapa menit), lalu coba lagi.

4. **CSRF error (403):**
   - Suruh client clear cookies browser untuk domain site.
   - Refresh halaman login.
   - Coba lagi.

5. **Password salah:**
   - Jangan minta password client.
   - Tidak ada reset password self-service — password klien direset manual oleh owner.

### Eskalasi

Eskalasi ke developer jika:
- Rate limit tidak bisa di-reset setelah cooldown.
- Error selain 400/403/429 muncul di Cloudflare Worker logs.
- Kredensial sudah benar tapi JWT token tetap tidak terbit.

## 2. Email Pembeli Tidak Masuk

### Gejala

Pembeli melaporkan tidak menerima email order (struk), email konfirmasi pembayaran
("✅ Pembayaran Terverifikasi — Website Sedang Disiapkan"), atau email portal
("🎉 Website Anda Sudah Online").

### Langkah Diagnosa

1. **Cek notification provider:**
   - Pastikan `NOTIFICATION_PROVIDER` terisi (harus `resend`).
   - Pastikan `NOTIFICATION_API_KEY` dan `NOTIFICATION_DEFAULT_FROM` terisi.
   - Tanpa ini, email tidak akan terkirim sama sekali.

2. **Cek spam/junk folder:**
   - Minta pembeli cek folder spam/junk/promotions.
   - Email dari Resend kadang masuk spam jika domain pengirim belum verified SPF/DKIM.

3. **Cek alamat email di order:**
   - Cek kolom `buyer_email` di tabel `orders` (D1) atau lewat API `GET /api/admin/orders`
     — panel Pesanan di `/admin` sudah dihapus.
   - Typo alamat membuat email terkirim tapi tidak pernah sampai.

4. **Cek status order:**
   - Email struk hanya dikirim saat order baru dibuat.
   - Email "Pembayaran Terverifikasi" dikirim saat order berstatus `activated`
     (berisi janji online maksimal 1×24 jam — tanpa link website).
   - Email "Website Sudah Online" (dengan URL `https://<slug>.workers.dev`) dikirim
     portal onboarding setelah deploy sukses (`scripts/onboarding/server.ts`).

5. **Verifikasi via Cloudflare logs:**
   - Filter Worker logs pada request keluar ke `api.resend.com`.
   - Jika request sukses tapi email tidak masuk, masalah ada di provider email (Resend delivery issue).

### Eskalasi

Eskalasi ke developer jika:
- Resend API sudah merespon sukses tapi email tidak pernah sampai setelah cek spam.
- Email struk/konfirmasi pembayaran/sudah-online tidak terkirim sama sekali padahal env notifikasi sudah benar.

## 3. Upload Cover/Gallery/Video Gagal

### Gejala

Client melaporkan upload media gagal di panel `/admin` situs klien.

### Langkah Diagnosa

1. **Cek storage quota:**
   - Login ke `/admin` situs klien → popout status di menubar menampilkan pemakaian storage
     (endpoint `GET /api/admin/storage-stats`).
   - Jika usage mendekati atau melebihi limit, upload akan ditolak.
   - Solusi: tambah quota override atau minta client hapus media yang tidak dipakai.

2. **Cek batas ukuran file:**
   - Cover image: maksimal 30 MB.
   - Gallery image: maksimal 30 MB.
   - Audio: maksimal 25 MB.
   - Video kecil (FormData): maksimal 60 MB.
   - Video besar (presign/direct upload): tergantung konfigurasi R2.

3. **Cek format file:**
   - Image: JPEG, PNG, WebP, AVIF.
   - Video: MP4 (direkomendasikan).
   - Jika client upload format lain, suruh konversi dulu.

4. **Cek batas media per project:**
   - Default dari env `MEDIA_PER_PROJECT` (bawaan 50 media per project).
   - Bisa di-override per site lewat `PUT /api/admin/sites` (field `quotaOverride`, tersimpan di
     tabel `site_quota_overrides`).

5. **Video presign gagal:**
   - Cek Cloudflare R2 env: `CLOUDFLARE_R2_BUCKET`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`.
   - Cek CORS policy di R2 bucket Cloudflare Dashboard.
   - Filter Worker logs: `event=r2.upload status=failure`.

6. **Upload timeout:**
   - File besar + koneksi lambat bisa timeout.
   - Sarankan client gunakan koneksi stabil atau kompres file sebelum upload.

### Eskalasi

Eskalasi ke developer jika:
- R2 storage error (bukan quota) muncul berulang di Worker logs.
- Presign URL error yang bukan masalah env.

## 4. Quota Site Penuh

### Gejala

Client mendapat pesan quota penuh saat upload media atau buat project baru.

### Langkah Diagnosa

1. **Cek usage vs limit:**
   - `GET /api/admin/sites` (dengan cookie admin situs klien) memuat `quota` (usage+limit
     efektif) dan `quotaOverride` untuk setiap site di D1 itu.
   - Bandingkan usage aktual vs limit efektif.

2. **Jenis quota:**
   - **Project limit**: jumlah project per site (default dari env `PROJECT_LIMIT`, bawaan 50).
   - **Storage (MB)**: total ukuran media per site (default dari env `STORAGE_MB`, bawaan 5000 MB).
   - **Media per project**: jumlah media per project (default dari env `MEDIA_PER_PROJECT`, bawaan 50).

3. **Solusi:**
   - **Quota override**: `PUT /api/admin/sites` dengan field `quotaOverride` — set custom quota per site (hanya menaikkan limit di atas default).
   - **Hapus media/project**: client bisa hapus draft project atau media yang tidak dipakai untuk mengurangi usage.

4. **Peringatan penurunan quota:**
   - Menurunkan quota hanya bisa jika usage aktual tidak melebihi limit baru.
   - Jika usage melebihi, usage harus dikurangi dulu sebelum limit diturunkan.

### Eskalasi

Tidak perlu eskalasi ke developer. Masalah quota bisa ditangani operator sepenuhnya via `PUT /api/admin/sites` (field `quotaOverride`).

## 5. Site Tidak Tampil di Public

### Gejala

Client melaporkan site mereka tidak bisa diakses di alamat website milik klien
(`https://<slug>.workers.dev` atau custom domainnya).

### Langkah Diagnosa

1. **Cek status site:**
   - `GET /api/admin/sites` → pastikan status `active`, bukan `suspended`.

2. **Cek project published:**
   - Site tanpa project published akan menampilkan empty state.
   - Pastikan minimal 1 project sudah di-publish (bukan draft).

3. **Cek alamat benar:**
   - URL public: `https://<slug>.workers.dev` (atau custom domain klien) — deployment ini
     khusus untuk 1 klien, semua halaman ada di root tanpa prefix path apa pun.
   - Pastikan slug yang diakses sesuai dengan slug yang tercatat di `arsip-klien/<slug>/`.

4. **Cek production health:**
   ```bash
   npm run monitoring:synthetic -- --url <production-url> --site-slug <slug>
   ```
   Jika health check gagal, masalah ada di infrastructure.

### Eskalasi

Eskalasi ke developer jika:
- Health check production gagal berulang.
- Site status `active` dan project published tapi tetap 404/500.

## 6. Suspend / Activate Site

### Suspend Site

Tidak ada panel pusat — ubah status site lewat API (cookie admin situs klien):

```bash
curl -X PUT <production-url>/api/admin/sites \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=<token>" \
  -H "x-csrf-token: <csrf>" \
  -d '{"id":"<site-id>","status":"suspended"}'
```

Impact suspend:
- Site public tidak bisa diakses (404 atau halaman suspended).
- Client login ditolak.
- Data tidak dihapus — bisa di-activate kembali.

### Activate Site

Sama seperti suspend, ubah status ke `active`.

```bash
curl -X PUT <production-url>/api/admin/sites \
  -H "Content-Type: application/json" \
  -H "Cookie: admin_token=<token>" \
  -H "x-csrf-token: <csrf>" \
  -d '{"id":"<site-id>","status":"active"}'
```

### Kapan Suspend

- Payment gagal setelah grace period (setelah Sprint 47).
- Buyer melanggar terms of service.
- Permintaan buyer sendiri untuk menonaktifkan sementara.

## 7. Restore Site dari Backup

Ikuti langkah di [backup-restore-runbook.md](file:///c:/Users/USER/Documents/portfolio-template/docs/operations/backup-restore-runbook.md).

Ringkasan singkat:

1. Backup D1: `npm run backup:d1 -- --out backups/drills/<tanggal>/d1`
2. Backup R2: `npm run backup:r2 -- --download --out backups/drills/<tanggal>/r2`
3. Restore D1 ke staging: `npm run restore:d1 -- --backup <path> --target-database-id <staging-id> --apply`
4. Audit integrity: `npm run restore:audit -- --backup <path> --live-r2`
5. Verifikasi staging: `npm run release:smoke -- --url <staging-url> --site-slug <slug>`

Jangan restore ke production database tanpa approval eksplisit dan flag `--allow-current-database --i-understand-this-can-overwrite-production`.

## 8. Pembayaran / Refund

> **Disetujui owner** (rencana v1.3.27, 2026-10-07) — kebijakan di bawah resmi berlaku
> dan boleh dijanjikan ke klien.

### Kebijakan refund

1. **Sebelum aktivasi (order pending / menunggu verifikasi):** pembeli boleh membatalkan
   kapan saja lewat halaman order atau hubungi owner. Sudah bayar tetapi order batal →
   uang dikembalikan penuh; potongan hanya biaya transfer/QRIS yang benar-benar terpakai
   (jika ada), dengan bukti mutasi.
2. **Setelah aktivasi, dalam 7 hari:** refund penuh bila situs tidak sesuai deskripsi
   pesanan ATAU rusak teknis yang tidak berhasil diperbaiki dalam 3×24 jam
   (3 kali percobaan perbaikan, dicatat di `audit_logs`).
3. **Setelah aktivasi, lewat 7 hari:** tanpa refund uang. Kompensasi berupa perbaikan,
   penyesuaian konten, atau kredit layanan sesuai kasus (keputusan owner).
4. **Pelanggaran konten (melanggar hukum / ketentuan layanan):** tanpa refund; site dapat
   disuspend (jalur `PUT /api/admin/sites`).
5. **SLA respons:** balasan ≤ 1×24 jam pada hari kerja; penyelesaian kasus teknis
   ≤ 3 hari kerja.

### Retensi bukti bayar (diverifikasi dari kode, 2026-10-08)

| Momen | File bukti di R2 (`orders/{id}/proof-*`) | Kolom `payment_proof_url` |
|---|---|---|
| Diunggah / diganti pembeli | file baru dibuat (nama ber-timestamp); versi lama tertinggal di folder yang sama sampai order dibersihkan | menunjuk versi terbaru |
| Menunggu verifikasi | disimpan | terisi |
| Dibatalkan admin | **dihapus seluruhnya** (`cleanupOrderProofObjects`) | `NULL` |
| Dibatalkan otomatis 7 hari (sweep) | **dihapus seluruhnya** | `NULL` |
| Dibuka kembali (reopen) | dari `canceled`: sudah bersih → pembeli wajib upload ulang; dari `failed`: bukti lama (jika masih ada) dipakai ulang | `NULL` / terisi sesuai asal |
| Diaktifkan | disimpan sebagai bukti verifikasi | tetap |

Alasan penghapusan = audit keamanan 29 Sep 2026: PII bukti transfer tidak boleh
tertinggal di R2 setelah order batal. `amount` dan `access_token_hash` tetap
dipertahankan (rekonsiliasi bayar telat + pembeli masih bisa membuka halaman order).

### Prosedur operasional (berlaku sekarang)

- Cek status order lewat panel **Pesanan** (`/admin/system/orders`) atau `GET /api/admin/orders` — keduanya menampilkan data tabel `orders` yang sama.
- Jika perlu aktivasi manual: aktifkan ordernya lewat jalur yang tersedia (API/Telegram), atau ubah status site ke `active` via `PUT /api/admin/sites`.
- Jangan ubah data pembayaran langsung di D1 tanpa melalui API/portal.
- Refund hanya diproses **owner** (tidak ada tombol otomatis di sistem): catat keputusan +
  alasan ke `audit_logs`, lalu proses pengembalian dana di kanal pembayaran yang dipakai
  (QRIS/transfer manual). Order `activated` tidak bisa dibatalkan lewat flow sederhana —
  penonaktifan site lewat suspend/downgrade terpisah.

## 9. Daftar Eskalasi

| Masalah | Operator Tangani Sendiri | Eskalasi ke Developer |
|---|---|---|
| Login gagal (password salah) | ✅ Reset manual via `reset-customer-password.ts` | — |
| Login gagal (CSRF) | ✅ Clear cookies | — |
| Login gagal (rate limit) | ✅ Tunggu cooldown | ❌ Jika cooldown tidak pulih |
| Upload gagal (quota) | ✅ Upgrade/hapus media | — |
| Upload gagal (R2 error) | — | ❌ Selalu eskalasi |
| Site tidak tampil | ✅ Cek status + project | ❌ Jika health check gagal |
| Quota penuh | ✅ Override/upgrade | — |
| Suspend/activate | ✅ Via API `PUT /api/admin/sites` | — |
| Restore | ✅ Jika ke staging | ❌ Jika ke production |
| Billing issue | ✅ Aktivasi manual sementara | ❌ Jika webhook/state machine error |

## 10. Larangan Operator

- **JANGAN** bagikan nilai `.env.local`, token JWT, API key, password hash, atau CSRF token ke siapapun termasuk buyer.
- **JANGAN** restore ke database production tanpa approval eksplisit.
- **JANGAN** hapus data R2 secara manual tanpa menjalankan audit terlebih dulu.
- **JANGAN** ubah `ADMIN_PASSWORD_SCRYPT` atau `JWT_SECRET` tanpa koordinasi dengan developer — ini akan invalidate semua session aktif.
- **JANGAN** share screenshot Cloudflare Dashboard yang menampilkan account ID, API token, atau billing info.
