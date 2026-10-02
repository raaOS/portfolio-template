# Support Playbook

Status: Sprint 48 operational baseline.

Playbook ini ditujukan untuk operator support yang menangani buyer Portfolio OS Template. Semua langkah bisa diikuti tanpa membaca source code. Jangan menyalin nilai `.env.local`, token, password, API key, atau data personal buyer ke chat, tiket, atau dokumen publik.

## Prasyarat Operator

Sebelum menangani tiket support, pastikan:

- Akses admin tersedia: bisa login ke `/admin` atau punya `admin_token` cookie aktif.
- Akses Master Dashboard: `FEATURE_MASTER_DASHBOARD=true` di env production.
- CLI tersedia di mesin lokal yang sudah clone repo dan `.env.local` menunjuk ke production Cloudflare.
- Familiar dengan Cloudflare Dashboard untuk cek Worker logs dan D1/R2 status.

Tools CLI yang sering dipakai:

```bash
npm run monitoring:synthetic -- --url <production-url> --site-slug <slug>
npm run cf:readiness
npm run media:audit-projects
```

## 1. Client Tidak Bisa Login

### Gejala

Client melaporkan tidak bisa login di `/<siteSlug>/login` atau `/client/login`.

### Langkah Diagnosa

1. **Cek status site:**
   - Buka Master Dashboard → cari site client.
   - Jika status `suspended`, site tidak bisa diakses. Lihat bagian Suspend/Activate.

2. **Cek client access terdaftar:**
   - Buka Master Dashboard → klik site → bagian Client Access.
   - Pastikan email client terdaftar dan status `active`.
   - Jika belum ada, buat client access baru (lihat [buyer-onboarding-checklist.md](file:///c:/Users/USER/Documents/portfolio-template/docs/operations/buyer-onboarding-checklist.md)).

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
- Client access sudah benar tapi JWT token tetap tidak terbit.

## 2. Email Pembeli Tidak Masuk

### Gejala

Pembeli melaporkan tidak menerima email order (struk) atau email serah terima setelah pembayaran diverifikasi.

### Langkah Diagnosa

1. **Cek notification provider:**
   - Pastikan `NOTIFICATION_PROVIDER` terisi (harus `resend`).
   - Pastikan `NOTIFICATION_API_KEY` dan `NOTIFICATION_DEFAULT_FROM` terisi.
   - Tanpa ini, email tidak akan terkirim sama sekali.

2. **Cek spam/junk folder:**
   - Minta pembeli cek folder spam/junk/promotions.
   - Email dari Resend kadang masuk spam jika domain pengirim belum verified SPF/DKIM.

3. **Cek alamat email di order:**
   - Buka `/admin` → Orders → pastikan `buyer_email` tertulis benar.
   - Typo alamat membuat email terkirim tapi tidak pernah sampai.

4. **Cek status order:**
   - Email struk hanya dikirim saat order baru dibuat.
   - Email serah terima hanya dikirim setelah order berstatus `activated`.

5. **Verifikasi via Cloudflare logs:**
   - Filter Worker logs pada request keluar ke `api.resend.com`.
   - Jika request sukses tapi email tidak masuk, masalah ada di provider email (Resend delivery issue).

### Eskalasi

Eskalasi ke developer jika:
- Resend API sudah merespon sukses tapi email tidak pernah sampai setelah cek spam.
- Email struk/serah terima tidak terkirim sama sekali padahal env notifikasi sudah benar.

## 3. Upload Cover/Gallery/Video Gagal

### Gejala

Client melaporkan upload media gagal di Client Dashboard.

### Langkah Diagnosa

1. **Cek storage quota:**
   - Buka Master Dashboard → site client → lihat card Storage.
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
   - Bisa di-override via quota override Master Dashboard.

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
   - Buka Master Dashboard → site client → lihat card quota.
   - Bandingkan usage aktual vs limit efektif.

2. **Jenis quota:**
   - **Project limit**: jumlah project per site (default dari env `PROJECT_LIMIT`, bawaan 50).
   - **Storage (MB)**: total ukuran media per site (default dari env `STORAGE_MB`, bawaan 5000 MB).
   - **Media per project**: jumlah media per project (default dari env `MEDIA_PER_PROJECT`, bawaan 50).

3. **Solusi:**
   - **Quota override**: Master Dashboard → site → set custom quota per site (hanya menaikkan limit di atas default).
   - **Hapus media/project**: client bisa hapus draft project atau media yang tidak dipakai untuk mengurangi usage.

4. **Peringatan penurunan quota:**
   - Menurunkan quota hanya bisa jika usage aktual tidak melebihi limit baru.
   - Jika usage melebihi, usage harus dikurangi dulu sebelum limit diturunkan.

### Eskalasi

Tidak perlu eskalasi ke developer. Masalah quota bisa ditangani operator sepenuhnya via Master Dashboard.

## 5. Site Tidak Tampil di Public

### Gejala

Client melaporkan site mereka tidak bisa diakses di `/<siteSlug>`.

### Langkah Diagnosa

1. **Cek status site:**
   - Master Dashboard → pastikan status `active`, bukan `suspended`.

2. **Cek project published:**
   - Site tanpa project published akan menampilkan empty state.
   - Pastikan minimal 1 project sudah di-publish (bukan draft).

3. **Cek slug benar:**
   - URL public: `<production-domain>/<siteSlug>`.
   - Pastikan slug yang diakses sesuai dengan slug di Master Dashboard.

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

Gunakan Master Dashboard → site → ubah status ke `suspended`.

Atau via API:

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

## 8. Pembayaran / Refund (Placeholder)

Bagian ini akan dilengkapi setelah alur billing otomatis selesai.

Sementara, jika ada masalah pembayaran:

- Cek status order di panel Pesanan (Master Dashboard).
- Jika perlu aktivasi manual: aktifkan order dari panel, atau ubah status site ke `active` via Master Dashboard.
- Jangan ubah data pembayaran langsung di D1 tanpa melalui API/Dashboard.

## 9. Daftar Eskalasi

| Masalah | Operator Tangani Sendiri | Eskalasi ke Developer |
|---|---|---|
| Login gagal (password salah) | ✅ Reset password | — |
| Login gagal (CSRF) | ✅ Clear cookies | — |
| Login gagal (rate limit) | ✅ Tunggu cooldown | ❌ Jika cooldown tidak pulih |
| Email reset tidak masuk | ✅ Cek spam, kirim ulang | ❌ Jika Resend API `sent=true` tapi email tidak pernah sampai |
| Upload gagal (quota) | ✅ Upgrade/hapus media | — |
| Upload gagal (R2 error) | — | ❌ Selalu eskalasi |
| Site tidak tampil | ✅ Cek status + project | ❌ Jika health check gagal |
| Quota penuh | ✅ Override/upgrade | — |
| Suspend/activate | ✅ Via Master Dashboard | — |
| Restore | ✅ Jika ke staging | ❌ Jika ke production |
| Billing issue | ✅ Aktivasi manual sementara | ❌ Jika webhook/state machine error |

## 10. Larangan Operator

- **JANGAN** bagikan nilai `.env.local`, token JWT, API key, password hash, atau CSRF token ke siapapun termasuk buyer.
- **JANGAN** restore ke database production tanpa approval eksplisit.
- **JANGAN** hapus data R2 secara manual tanpa menjalankan audit terlebih dulu.
- **JANGAN** ubah `ADMIN_PASSWORD_SCRYPT` atau `JWT_SECRET` tanpa koordinasi dengan developer — ini akan invalidate semua session aktif.
- **JANGAN** share screenshot Cloudflare Dashboard yang menampilkan account ID, API token, atau billing info.
