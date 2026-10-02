# Backup Restore Runbook

Status: Sprint 44 operational baseline.

Dokumen ini menjelaskan cara membuat backup Cloudflare D1/R2, melakukan restore ke staging, dan mengaudit hasil restore. Jangan menyalin nilai `.env.local`, token, database id, atau secret ke dokumen, tiket, chat, atau log publik.

## Target Awal

- RPO: kehilangan data maksimal 24 jam.
- RTO: layanan pulih dalam 2-4 jam setelah target restore siap.
- Restore produksi langsung bukan prosedur normal. Default restore harus ke database/bucket staging atau restore khusus.

## Data Yang Dibackup

D1:

- `sites`
- `client_access`
- `site_quota_overrides`
- `projects`
- `project_narratives`
- `media_assets`
- `submissions`
- `ai_generations`
- `audit_logs`
- `app_kv`

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

## Backup D1

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

Catatan: file backup bisa berisi email buyer, password hash, token hash reset password, dan audit log. Folder `backups/` sudah di-ignore git.

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
- login client staging
- cek minimal 1 project published muncul
- cek cover/gallery/video dapat dimuat
- cek client access masih bisa login setelah reset password flow diuji ulang di staging

## Pass Criteria Sprint 44

Sprint 44 baru boleh dianggap lulus penuh jika:

- Backup D1 berhasil dibuat tanpa secret di log.
- R2 backup minimal memiliki manifest; untuk drill penuh, object media penting sudah di-copy atau bucket restore policy sudah dibuktikan.
- Restore D1 berhasil ke database staging/restore khusus.
- Minimal 1 dummy site lengkap dengan client access, project, cover/gallery/video bisa dibuka di staging.
- `restore:audit` tidak menghasilkan error.
- RPO/RTO di atas disetujui dan dapat diulang dari runbook ini.

Kalau hanya script dan dry-run yang lulus tetapi belum ada database staging, statusnya bukan "Completed"; status yang jujur adalah "Implemented / Blocked on staging restore target".
