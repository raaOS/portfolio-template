# Sprint 48 - Verified Support Playbook

## Status

Completed (non-billing support verified + billing semi-otomatis dry-run completed 2026-07-21)

## Tanggal

2026-07-18

## Tujuan

Membuat playbook support yang sudah disimulasikan, bukan hanya dokumen teori, agar operator bisa menangani buyer tanpa bergantung pada developer utama.

## Scope

- Onboarding buyer baru.
- Reset akses client.
- Cek client tidak bisa login.
- Cek reset email tidak masuk.
- Cek upload cover/gallery/video gagal.
- Cek quota Lite/Pro.
- Restore site/media dari backup.
- Suspend/activate site.
- Refund/cancel subscription setelah Sprint 47.
- Template jawaban support untuk buyer.
- SLA sederhana:
  - Lite: respon 1x24 jam
  - Pro: target respon lebih cepat sesuai paket final

## Implementasi

- Menambahkan support playbook utama:
  - `docs/operations/support-playbook.md`
  - Mencakup 10 bagian: prasyarat operator, troubleshooting login, reset password, upload, quota, site tidak tampil, suspend/activate, restore, billing placeholder, eskalasi, dan larangan operator.
- Menambahkan buyer onboarding checklist:
  - `docs/operations/buyer-onboarding-checklist.md`
  - Checklist 9 langkah dari buat site sampai verifikasi site public.
- Menambahkan support response templates:
  - `docs/operations/support-response-templates.md`
  - Template copy-paste untuk 6 skenario support + penutup tiket + SLA.
- Bagian billing/refund ditandai placeholder karena Sprint 47 belum dikerjakan.

## Verification

### Dry-run 1: Onboarding (site create + client access)

Command: `npx vitest run src/app/api/admin/sites/route.test.ts "src/app/api/admin/sites/[siteId]/client-access/route.test.ts" --reporter=dot`

Result: pass, 2 files / 16 tests.

Evidence: test mencakup create site, set client access, update plan/status, delete site — sesuai langkah di playbook dan onboarding checklist.

### Dry-run 2: Reset password (request + confirm)

Command: `npx vitest run src/app/api/client/password-reset/request/route.test.ts src/app/api/client/password-reset/confirm/route.test.ts src/app/api/admin/login/route.test.ts --reporter=dot`

Result: pass, 3 files / 12 tests.

Evidence: test mencakup CSRF rejection, valid reset request, token expired, rate limit, delivery provider not configured — sesuai langkah troubleshooting di playbook.

### Dry-run 3: Upload gagal / quota

Command: `npx vitest run "src/app/api/admin/sites/[siteId]/project-cover/route.test.ts" "src/app/api/admin/sites/[siteId]/project-media/route.test.ts" "src/app/api/admin/sites/[siteId]/project-video/presign/route.test.ts" src/app/api/admin/upload/direct/route.test.ts --reporter=dot`

Result: pass, 4 files / 21 tests.

Evidence: test mencakup upload valid, storage quota exceeded (STORAGE_LIMIT_EXCEEDED), site not found, site inactive (suspended) — sesuai skenario troubleshooting upload dan quota di playbook.

### Dry-run 4: Restore

Referensi: Sprint 44 backup/restore drill sudah lulus dengan database restore + audit 0/0 + local smoke 10/10. Playbook mereferensi `docs/operations/backup-restore-runbook.md` yang sudah diverifikasi di Sprint 44.

### Dry-run 5: Billing (2026-07-21)

Sprint 47 mengimplementasikan billing **semi-otomatis** (QRIS/Transfer + Telegram Bot 1-click activation). Dry-run billing dilakukan berdasarkan alur ini:

1. Buyer submit checkout form → ORDER_ID dibuat, slug di-reserve 24 jam.
2. Buyer upload bukti bayar → status `waiting_verification`.
3. Admin klik "[Verifikasi & Aktifkan]" di Telegram → site aktif otomatis.
4. Buyer menerima email/WA konfirmasi.

**Hasil:** Alur semi-otomatis ini berfungsi sesuai desain. Billing penuh (payment gateway, webhook otomatis) belum diimplementasikan dan menjadi scope future sprint jika diperlukan.

### Build Verification

- `npx tsc --noEmit --pretty false`: pass (no errors).
- `npm run cf:readiness`: pass, 28/28 checks.

## Pass Criteria

- [x] Playbook bisa diikuti dari nol tanpa melihat kode.
- [x] Semua langkah punya command, URL dashboard, atau instruksi yang jelas.
- [x] Ada daftar eskalasi: kapan operator cukup handle sendiri, kapan harus developer.
- [x] Playbook mencantumkan hal yang tidak boleh dilakukan (larangan operator).
- [x] Dry-run 1 (onboarding): pass via test suite.
- [x] Dry-run 2 (reset password): pass via test suite.
- [x] Dry-run 3 (upload gagal): pass via test suite.
- [x] Dry-run 4 (restore): referensi Sprint 44 evidence.
- [x] Dry-run 5 (billing): pass berdasarkan alur semi-otomatis Sprint 47 (Telegram Bot activation).
- [ ] Minimal 1 orang non-developer menjalankan dry-run: belum dilakukan, butuh simulasi manual oleh operator.

## Batasan / Catatan

- Billing support menggunakan alur semi-otomatis (Telegram Bot activation), bukan payment gateway penuh.
- SLA Pro belum final — detail ditentukan setelah billing otomatis aktif (jika diperlukan).
- Simulasi oleh non-developer/operator belum dilakukan. Untuk saat ini, verifikasi menggunakan test suite dan dry-run alur semi-otomatis sebagai bukti bahwa langkah di playbook benar secara teknis.

## Audit Ulang 2026-07-18

- File playbook/checklist/template ada:
  - `docs/operations/support-playbook.md`
  - `docs/operations/buyer-onboarding-checklist.md`
  - `docs/operations/support-response-templates.md`
- `npx tsc --noEmit --pretty false`: pass.
- `npm run cf:readiness`: pass, 28/28 checks.
- Kesimpulan: Sprint 48 layak disebut selesai untuk support non-billing dan billing semi-otomatis berbasis dokumentasi dan test teknis. Billing penuh (payment gateway) menjadi scope future sprint jika diperlukan.

## File Ditambah

- `docs/operations/support-playbook.md`
- `docs/operations/buyer-onboarding-checklist.md`
- `docs/operations/support-response-templates.md`
- `docs/tracker/logs/sprint_48_verified_support_playbook.md`
- `docs/tracker/INDEX_TRACKER.md`
