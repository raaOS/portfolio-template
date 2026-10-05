# Backup Restore Runbook

Status: Sprint 44 operational baseline.

Dokumen ini menjelaskan cara membuat backup Cloudflare D1/R2, melakukan restore ke staging, dan mengaudit hasil restore. Jangan menyalin nilai `.env.local`, token, database id, atau secret ke dokumen, tiket, chat, atau log publik.

## Target Awal

- RPO: kehilangan data maksimal 24 jam.
- RTO: layanan pulih dalam 2-4 jam setelah target restore siap.
- Restore produksi langsung bukan prosedur normal. Default restore harus ke database/bucket staging atau restore khusus.

## Data Yang Dibackup

D1 (daftar gabungan dua berkas DDL yang hidup; `client_access` sudah `DROP TABLE`):

Dari `src/crud/shared/db/schema.ts` (skema yang dipasang portal onboarding):

- `sites`
- `site_users`
- `projects`
- `media_assets`
- `site_settings`
- `audit_logs`
- `rate_limits`
- `app_kv`
- `portfolio_templates`
- `site_template_entitlements`

Dari `src/lib/d1-schema.ts` (skema bootstrap produk; `sites`, `projects`, `media_assets`,
`audit_logs` sudah tercantum di atas):

- `site_quota_overrides`
- `project_narratives`
- `submissions`
- `ai_generations`
- `orders`
- `site_custom_domains`
- `site_analytics`
- `platform_settings`

> **Catatan verifikasi (2026-10-04, DIPERBARUI 2026-10-05 — sudah diperbaiki atas izin owner):**
> `DEFAULT_D1_BACKUP_TABLES` dan `RESTORE_TABLE_ORDER` di `scripts/cloudflare/backup-common.ts`
> kini memuat **18 tabel gabungan dua skema** (daftar di atas) tanpa `client_access`.
> `restore-d1.ts` `bootstrapTarget()` juga menjalankan `SHARED_SCHEMA_QUERIES` supaya tabel
> skema bersama (`site_users`, `site_settings`, `rate_limits`, `portfolio_templates`,
> `site_template_entitlements`) ikut tercipta di target staging. Verifikasi nyata 2026-10-05:
> `backup:d1 --dry-run` → 18 tabel / 77 rows / missing kosong; backup → restore dry-run
> validasi 18/18 tabel cocok. `client_access` dihapus dari daftar karena sudah `DROP TABLE`.

R2:

- `sites/{siteId}/projects/`
- `sites/{siteId}/wallpapers/`
- `ffmpeg/`
- Opsional: `assets/wallpapers/` untuk data legacy yang masih aktif.

## Prasyarat

Pastikan `.env.local` lokal berisi konfigurasi Cloudflare produk yang benar. Jangan print nilainya.

Untuk restore staging, siapkan database D1 restore khusus lalu set salah satu:

```bash
CLOUDFLARE_D1_RESTORE_DATABASE_ID=<staging-or-restore-d1-id>
```

Atau pass langsung saat command:

```bash
--target-database-id <staging-or-restore-d1-id>
```

Jangan gunakan database produksi sebagai target restore kecuali sedang prosedur disaster recovery yang disetujui manual.

## Backup Otomatis Harian (v1.3.22)

Sejak v1.3.22 ada jalur backup **runtime** di aplikasi (terpisah dari script CLI di atas):

- **Jadwal:** ikut cron `0 18 * * *` UTC (= **01:00 WIB**) di `/api/cron/daily`, setelah sweep order.
- **Isi:** seluruh tabel D1 (daftar dibaca langsung dari `sqlite_master` — tidak bergantung `DEFAULT_D1_BACKUP_TABLES`), 1 file JSON berformat `D1BackupFile` (kompatibel `npm run restore:d1`).
- **Lokasi:** R2 `sites/{siteId}/backups/d1/<ISO>.json`, **retensi 7 terbaru**, guard idempoten <20 jam.
- **Panel admin:** `Sistem & Tampilan → Backup Database` (`/admin/system/backup`) — tombol _Backup Sekarang_, daftar, dan _Unduh_. Unduh lewat `/api/admin/backup/download?key=...` (admin login + validasi key ketat), bukan lewat `/api/r2/[...key]` (prefix `backups/` diblokir `isAllowedKey`).
- **Restore:** unduh file-nya, lalu pakai jalur CLI `npm run restore:d1 -- --backup <file>` seperti bagian _Restore D1 Ke Staging_ di bawah. Belum ada tombol restore otomatis di panel.

## Backup D1 (CLI / drill)

Dry-run untuk melihat jumlah row:

```bash
npm run backup:d1 -- --dry-run
```

Backup aktual ke folder lokal:

```bash
npm run backup:d1 -- --out backups/drills/<tanggal>/d1
```

Output utama:

- `d1-backup.json`
- `manifest.json`

Catatan: file backup bisa berisi email buyer, password hash, dan audit log. Folder `backups/` sudah di-ignore git.

## Backup R2

Inventory metadata-only:

```bash
npm run backup:r2 -- --out backups/drills/<tanggal>/r2
```

Download actual object bodies:

```bash
npm run backup:r2 -- --download --out backups/drills/<tanggal>/r2
```

Kalau masih ada wallpaper legacy aktif:

```bash
npm run backup:r2 -- --download --include-legacy-wallpapers --out backups/drills/<tanggal>/r2
```

Output utama:

- `r2-manifest.json`
- `objects/...` hanya ada kalau `--download` dipakai.

## Restore D1 Ke Staging

Validasi dry-run:

```bash
npm run restore:d1 -- --backup backups/drills/<tanggal>/d1/d1-backup.json --target-database-id <staging-or-restore-d1-id>
```

Apply ke staging:

```bash
npm run restore:d1 -- --backup backups/drills/<tanggal>/d1/d1-backup.json --target-database-id <staging-or-restore-d1-id> --apply
```

Untuk automation non-interactive setelah target dipastikan staging:

```bash
npm run restore:d1 -- --backup backups/drills/<tanggal>/d1/d1-backup.json --target-database-id <staging-or-restore-d1-id> --apply --yes
```

Guard produksi:

- `--apply` ke current `CLOUDFLARE_D1_DATABASE_ID` ditolak default.
- Jika benar-benar disaster recovery ke production, harus pakai `--allow-current-database` dan `--i-understand-this-can-overwrite-production`.
- Jangan pakai flag bahaya untuk drill biasa.

## Audit Restore Integrity

Audit backup D1 terhadap manifest R2:

```bash
npm run restore:audit -- --backup backups/drills/<tanggal>/d1/d1-backup.json --r2-manifest backups/drills/<tanggal>/r2/r2-manifest.json
```

Audit langsung ke R2 live:

```bash
npm run restore:audit -- --backup backups/drills/<tanggal>/d1/d1-backup.json --live-r2
```

Audit memeriksa:

- semua row site-scoped merujuk `site_id` yang ada
- `media_assets.project_id` dan `project_narratives.project_id` valid
- referensi R2 di D1 ada di manifest/live R2
- path media `sites/{siteId}/...` tidak menunjuk site lain
- side-car video seperti `-preview.mp4`, `.jpg`, dan `.webp` dilaporkan sebagai warning kalau hilang

## Verifikasi Staging Setelah Restore

Minimal:

```bash
npm run cf:readiness
npm run media:audit-projects
npm run release:smoke -- --url <staging-url> --site-slug <restored-site-slug>
```

Manual check:

- buka public site staging
- login panel `/admin` di staging
- cek minimal 1 project published muncul
- cek cover/gallery/video dapat dimuat
- cek login panel masih bisa setelah reset password owner-assisted diuji di staging

## Pass Criteria Sprint 44

Sprint 44 baru boleh dianggap lulus penuh jika:

- Backup D1 berhasil dibuat tanpa secret di log.
- R2 backup minimal memiliki manifest; untuk drill penuh, object media penting sudah di-copy atau bucket restore policy sudah dibuktikan.
- Restore D1 berhasil ke database staging/restore khusus.
- Minimal 1 dummy site lengkap dengan admin user (`site_users`), project, cover/gallery/video bisa dibuka di staging.
- `restore:audit` tidak menghasilkan error.
- RPO/RTO di atas disetujui dan dapat diulang dari runbook ini.

Kalau hanya script dan dry-run yang lulus tetapi belum ada database staging, statusnya bukan "Completed"; status yang jujur adalah "Implemented / Blocked on staging restore target".
