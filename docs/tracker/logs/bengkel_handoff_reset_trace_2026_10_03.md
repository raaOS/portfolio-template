# Log: Hapus Jejak Fitur Reset Password + Sambungkan Kasir ke Bengkel (v1.3.16)

Tanggal: 2026-10-03
Status: 🟢 Selesai (tsc 0, eslint 0, `114 file / 881 test PASS`); **belum di-deploy**
Cabang: `fix/security-audit-2026-09-29`

Permintaan owner (3 poin):
1. Lanjutkan pembersihan database (point 1).
2. Tentukan nasib `release:sale-readiness` yang gagal (point 2) → owner pilih **"Hapus semua jejaknya"**.
3. Sambungkan kasir ke bengkel (point 3) → owner pilih **"Pakai versi rekonstruksi"**.

---

## 1. Pembersihan database — dry-run SUKSES, `--apply` masih ditahan

Dijalankan dari direktori repo utama (worktree tidak punya `.env.local`):

```
npx tsx <worktree>/scripts/cloudflare/remove-plan-columns.ts
```

Hasil (terverifikasi langsung ke D1 produksi, semua `[ada]`):

```
[ada ] ALTER TABLE sites      DROP COLUMN plan
[ada ] ALTER TABLE orders     DROP COLUMN plan
[ada ] DROP TABLE  site_subscriptions
[ada ] DROP INDEX idx_site_subscriptions_site
[ada ] DROP TABLE client_password_resets      <- ditambahkan di sesi ini
```

**`--apply` TIDAK dijalankan.** Alasan non-IT: panel admin & kasir yang tayang sekarang
masih *membaca* kolom `plan`; kalau kolomnya dibuang hari ini, halaman order dan form
tambah situs langsung error. Urutan wajib: **deploy v1.3.16 dulu → baru `--apply`.**

Baris `DROP TABLE client_password_resets` **baru ditambahkan** di sesi ini (fitur reset
password self-service sudah dihapus dari kode sejak lama, tapi tabelnya masih ada di
produksi — terkonfirmasi `[ada]`).

---

## 2. Hapus jejak fitur reset password

**Bukti fitur benar-benar mati** (bukan rusak):
- `grep PASSWORD_RESET|password-reset|clientPasswordReset` di seluruh `src/` = **0 match**.
- Tabel `client_password_resets` sudah tidak ada di `src/lib/d1-schema.ts`.
- Riwayat: `bed0e19` menambah, `686f762` menghapus (lihat log
  `activation_handoff_email_2026_10_02.md`).

**Sisa jejak yang dibersihkan (29 file, `src/` aplikasi tidak diubah sama sekali):**

| Kelompok | File |
|---|---|
| Cek audit | `scripts/release/audit-sale-readiness.js` (5 cek mati: 4 file + 1 tabel + frasa env/`/client/reset-password`), `scripts/release/audit-release-package.js` (2 frasa + 2 key env) |
| Cek produksi | `scripts/cloudflare/production-readiness.ts` (`checkClientPasswordReset` → `checkNotificationProvider`), `scripts/cloudflare/product-env.ts` (2 key wajib) |
| Monitoring/smoke | `scripts/monitoring/synthetic-production-check.js` (cek `/client/reset-password`), `scripts/release/smoke-production.js` |
| Env | `.env.example` (2 baris), `docs/product-boundary/env-inventory.md` |
| Backup/restore | `scripts/cloudflare/backup-common.ts` (2 list tabel), `scripts/cloudflare/audit-restore-integrity.ts` |
| Uji beban | `scripts/load/multi-buyer-load-test.js` (`--password-reset-mode` + pemanggilan endpoint yang sudah 404), `scripts/load/load-test-config.example.json` |
| Dokumen aktif | `README.md`, `RELEASE_CHECKLIST.md`, `CLIENT_OPERATIONS.md`, `BUYER_ONBOARDING.md`, `PRODUCTION_DEPLOY_RUNBOOK.md`, `support-playbook.md` (bagian "Email Reset Password" → "Email Pembeli Tidak Masuk"), `support-response-templates.md`, `buyer-onboarding-checklist.md`, `monitoring-runbook.md`, `backup-restore-runbook.md`, `02_BACKEND_D1_CONTEXT.md`, `05_UI_TEMPLATE_CONTEXT.md`, `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` (FAQ kini menunjuk CLI `reset-customer-password.ts` yang memang masih hidup) |

**Sengaja TIDAK dihapus** (bukan jejak fitur yang sama):
- `scripts/cloudflare/reset-customer-password.ts` — CLI owner-assisted untuk mereset
  password `/admin/login` klien; ini jalur reset yang masih dipakai, bukan fitur
  self-service yang dihapus.
- Arsip `docs/tracker/logs/*`, entri INDEX lama, `CHANGELOG` lama.

### Hasil gate audit

| Perintah | Sebelum (HEAD) | Sesudah |
|---|---|---|
| `npm run release:sale-readiness` | **17/22 (EXIT 1)** | **13/13 (EXIT 0)** |
| `npm run release:audit` | EXIT 1, 3 gagal | EXIT 1, **2 gagal** (60/62) |

2 kegagalan pre-existing `release:audit` (sudah diverifikasi ada di `HEAD`):
1. `.env.example` masih memuat `TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_CHAT_ID`/`TELEGRAM_BOT_SECRET`
   yang masuk daftar `forbiddenEnvPatterns` — padahal fitur Telegram aktif order **memang**
   butuh ketiganya. Perlu keputusan owner: hapus dari `.env.example` atau longgarkan polanya.
2. Frasa wajib `'manual invoice'` tidak pernah ada di `docs/` mana pun.

---

## 3. Sambungkan kasir ke bengkel (v1.3.16)

**Masalah yang ditemukan:** order `activated` = uang sudah masuk, tapi **owner tidak
pernah menerima apa pun**. Pesan Telegram yang ada hanya *meng-edit* tombol aktivasi
menjadi "✅ STATUS: ACTIVATED" + URL. Langkah kerja berikutnya (Gmail, akun Cloudflare,
provisioning, deploy) seluruhnya di luar sistem dan tidak tercatat di mana pun.

**Solusi (2 bagian):**

1. **Tiket kerja Telegram** — `sendWorkshopTicket()` baru di
   `src/lib/services/orderService.ts`, dipanggil sekali di akhir `activateOrder`
   setelah email serah-terima. Isi: ID order, slug, nama/WA/email pembeli, URL, plus
   6 langkah bengkel. **Best-effort** (memakai `sendTelegramMessage` yang sudah
   try/catch + guard token); kalau Telegram belum dikonfigurasi, aktivasi tetap sukses
   dan tidak ada request keluar.
2. **Runbook** `docs/operations/BENGKEL_HANDOFF.md` — 6 langkah operasional yang
   dirujuk tiket, disusun dari fakta kode: menu yang benar-benar ada di
   `PENGELOLA_KLIEN.bat` (Pendaftaran Klien Baru / Status Klien / Custom Domain /
   Update Versi), API portal `/api/verify` (cek Account ID + API Token izin D1, Pages,
   R2), `/api/provision`, `/api/deploy-client`, penyimpanan `arsip-klien/<folder>/config.env`,
   dan CLI reset password owner-assisted.

**Test baru (2):** tiket terkirim ke `sendMessage` dengan isi yang benar; dan aktivasi
tetap sukses tanpa Telegram (0 request keluar). Test lama tetap hijau karena env Telegram
tidak pernah di-set di test.

---

## Gate

- `npx tsc --noEmit` → **0 error**
- `npx eslint src` → **0 error**
- `npx vitest run` → **114 file / 881 test PASS** (879 → 881)
- `npm run release:sale-readiness` → **13/13 PASS**
- `npm run release:audit` → 60/62 (2 pre-existing)

## Handoff / Keputusan Tertunda

1. **Deploy v1.3.16 → baru `npx tsx scripts/cloudflare/remove-plan-columns.ts --apply`**
   (urutan wajib; 5 statement sudah terverifikasi `[ada]` di produksi).
2. Merge ke `main` + `pre-deploy` masih menunggu AI lain selesai (2 file bentrok).
3. **Sisa jejak sistem login klien (v1.3.14) di dokumen & skrip** — di luar lingkup
   sesi ini, perlu keputusan owner: `docs/operations/support-playbook.md:28`,
   `docs/agent-context/05_UI_TEMPLATE_CONTEXT.md:28`, `docs/release/CLIENT_OPERATIONS.md:12,27`,
   `docs/release/BUYER_ONBOARDING.md:184-185,199,227-228`, `docs/release/RELEASE_CHECKLIST.md:76,133`,
   `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md:55`, dan `scripts/load/multi-buyer-load-test.js:686-688`
   (uji beban masih memanggil `POST /api/client/login` yang sudah tidak ada → skrip itu
   tidak akan bisa jalan sampai dirombak).
4. 2 kegagalan `release:audit` pre-existing (lihat bagian 2).
5. Masih menunggu keputusan: cron harian Wrangler + pemindahan rahasia ke Worker secrets.
