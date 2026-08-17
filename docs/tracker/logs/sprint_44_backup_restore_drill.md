# Sprint 44 - Backup Restore Drill

## Status

Completed / Restore drill passed with D1 restore DB and local smoke

## Tujuan

Membuktikan bahwa data produksi Portfolio OS Template bisa di-backup dan di-restore secara aman sebelum load test multi-buyer atau penjualan massal besar dilakukan.

Sprint ini harus dikerjakan lebih dulu karena semua sprint berikutnya berpotensi membuat data dummy, traffic tinggi, atau perubahan pembayaran yang harus bisa dipulihkan.

## Scope

- Backup D1 terjadwal untuk database produk.
- Export data penting:
  - `sites`
  - `client_access`
  - `projects`
  - `media_assets`
  - `client_password_resets`
  - `site_subscriptions`
  - `site_quota_overrides`
  - `audit_logs`
- Strategi backup/copy R2 untuk prefix penting:
  - `sites/{siteId}/projects/`
  - `sites/{siteId}/wallpapers/`
  - `ffmpeg/`
- Restore drill ke environment staging atau database/bucket restore khusus.
- Rekonsiliasi D1 dan R2 setelah restore.

## Deliverables

- Script backup D1/export data production-safe: `scripts/cloudflare/backup-d1.ts`.
- Script backup R2 media/inventory: `scripts/cloudflare/backup-r2-site-media.ts`.
- Script restore/import untuk staging: `scripts/cloudflare/restore-d1.ts`.
- Script audit restore: `scripts/cloudflare/audit-restore-integrity.ts`.
  - jumlah site cocok
  - jumlah project cocok
  - referensi media di D1 ada di R2
  - tidak ada cross-site media path
- Dokumen runbook restore di `docs/operations/backup-restore-runbook.md`.
- Catatan RPO/RTO final:
  - target awal RPO: maksimal kehilangan data 24 jam
  - target awal RTO: layanan pulih 2-4 jam

## Pass Criteria

- Backup D1 berhasil dibuat tanpa menulis secret ke log.
- Restore ke staging berhasil.
- Minimal 1 dummy site lengkap dengan client access, project, cover/gallery/video bisa dipulihkan dan dibuka.
- Audit D1/R2 restore lulus.
- Runbook bisa diikuti ulang dari nol tanpa mengandalkan memori developer.

## Verification Commands

```bash
npm run backup:d1 -- --dry-run
npm run backup:d1 -- --out backups/drills/2026-07-07-sprint-44/d1
npm run backup:r2 -- --out backups/drills/2026-07-07-sprint-44/r2 --include-legacy-wallpapers
npm run backup:r2 -- --download --out backups/drills/2026-07-07-sprint-44/r2-download --include-legacy-wallpapers
npm run restore:d1 -- --backup backups/drills/2026-07-07-sprint-44/d1/d1-backup.json
npm run restore:audit -- --backup backups/drills/2026-07-07-sprint-44/d1/d1-backup.json --r2-manifest backups/drills/2026-07-07-sprint-44/r2-download/r2-manifest.json --out backups/drills/2026-07-07-sprint-44/restore-integrity-report.json
npm run cf:readiness
npm run media:audit-projects
npm run release:smoke -- --url <staging-url> --site-slug <restored-site-slug>
```

## Verification Result - 2026-07-07

Completed:

- `npm run backup:d1 -- --dry-run`
  - Passed.
  - D1 readable: 12 tables, 7 rows total.
- `npm run backup:d1 -- --out backups/drills/2026-07-07-sprint-44/d1`
  - Passed.
  - Wrote `d1-backup.json` and `manifest.json`.
- `npm run backup:r2 -- --out backups/drills/2026-07-07-sprint-44/r2 --include-legacy-wallpapers`
  - Passed.
  - Inventory: 6 prefixes, 3 objects, 30.9 MB, 0 failed.
- `npm run backup:r2 -- --download --out backups/drills/2026-07-07-sprint-44/r2-download --include-legacy-wallpapers`
  - Passed.
  - Downloaded: 3/3 objects, 0 failed.
- `npm run restore:d1 -- --backup backups/drills/2026-07-07-sprint-44/d1/d1-backup.json`
  - Passed as dry-run only.
  - No D1 rows changed.
- `npm run restore:audit -- --backup backups/drills/2026-07-07-sprint-44/d1/d1-backup.json --r2-manifest backups/drills/2026-07-07-sprint-44/r2-download/r2-manifest.json --out backups/drills/2026-07-07-sprint-44/restore-integrity-report.json`
  - Completed with 0 errors and 1 warning.
  - Warning: one site-scoped R2 object is not referenced by D1.
- `npm run cf:readiness`
  - Passed 28/28 checks.

Not passed / blocked:

- The current production backup has 0 `projects` rows and 0 `media_assets` rows, so the pass criterion "minimal 1 dummy site lengkap dengan client access, project, cover/gallery/video bisa dipulihkan dan dibuka" is not yet provable from this backup.
- `npm run media:audit-projects` exited with 1 orphan R2 object:
  - `sites/default-site/projects/project-demo-branding/cover-demo-branding.jpg`
  - This was not deleted.
- `npm run release:smoke -- --url <staging-url> --site-slug <restored-site-slug>` was not run because no restored staging URL exists yet.

## Verification Result - 2026-07-07 Restore DB Created

Completed:

- Created Cloudflare D1 restore database `portfolio-template-restore-sprint-44`.
- Wrote `CLOUDFLARE_D1_RESTORE_DATABASE_ID` to local `.env.local` without logging the value.
- `npm run restore:d1 -- --backup backups/drills/2026-07-07-sprint-44/d1/d1-backup.json --apply --yes`
  - Passed.
  - Restore target: restore/staging database, not production.
  - Restored counts: `sites=2`, `client_access=1`, `site_subscriptions=1`, `app_kv=3`, all other backed-up product tables `0`.
- `npm run restore:d1 -- --backup backups/drills/2026-07-07-sprint-44/d1/d1-backup.json`
  - Passed as post-apply dry-run.
  - Target row counts match incoming backup counts.
- `npm run restore:audit -- --backup backups/drills/2026-07-07-sprint-44/d1/d1-backup.json --r2-manifest backups/drills/2026-07-07-sprint-44/r2-download/r2-manifest.json --out backups/drills/2026-07-07-sprint-44/restore-integrity-after-apply-report.json`
  - Completed with 0 errors and 1 warning.
  - Warning remains: one site-scoped R2 object is not referenced by D1.
- `npm run cf:readiness`
  - Passed 28/28 checks after restore env was added.

Resolved in the full-pass run below:

- Dummy project/media restore is now proven from a new backup containing `projects=1` and `media_assets=3`.
- The orphan R2 object was reattached to valid D1 project/media rows instead of deleted.
- Public staging domain is still not provisioned, but the app was run locally against the D1 restore database and passed smoke.

## Verification Result - 2026-07-07 Full Pass

Completed:

- `npm run restore:seed-drill -- --apply`
  - Passed.
  - Seeded hidden demo site `default-site` / `demo-designer` with one complete restore drill project.
  - D1 after seed: `projects=1`, `media_assets=3`, `client_access=1` for the demo site.
  - R2 after seed:
    - existing cover reattached: `sites/default-site/projects/project-demo-branding/cover-demo-branding.jpg`
    - uploaded gallery image
    - uploaded video
    - uploaded video preview
    - uploaded JPG poster
    - uploaded WebP poster
- `npm run media:audit-projects`
  - Passed.
  - Sites: 2.
  - Projects: 1.
  - R2 project objects: 6.
  - Referenced keys: 6.
  - Orphan files: 0.
  - Dangling references: 0.
  - Cross-site references: 0.
  - Invalid `media_assets` rows: 0.
- `npm run backup:d1 -- --out backups/drills/2026-07-07-sprint-44-full-pass/d1`
  - Passed.
  - D1 rows total: 13.
  - Important restored rows: `client_access=2`, `projects=1`, `project_narratives=1`, `media_assets=3`.
- `npm run backup:r2 -- --download --out backups/drills/2026-07-07-sprint-44-full-pass/r2-download --include-legacy-wallpapers`
  - Passed.
  - R2 objects: 8.
  - Downloaded: 8/8.
  - Failed: 0.
- `npm run restore:d1 -- --backup backups/drills/2026-07-07-sprint-44-full-pass/d1/d1-backup.json --apply --yes`
  - Passed.
  - Restore target: D1 restore/staging database.
  - Restored counts include `projects=1`, `project_narratives=1`, `media_assets=3`.
- `npm run restore:audit -- --backup backups/drills/2026-07-07-sprint-44-full-pass/d1/d1-backup.json --r2-manifest backups/drills/2026-07-07-sprint-44-full-pass/r2-download/r2-manifest.json --out backups/drills/2026-07-07-sprint-44-full-pass/restore-integrity-report.json`
  - Passed.
  - Errors: 0.
  - Warnings: 0.
- Local app smoke against D1 restore database:
  - Ran app locally on `http://localhost:3200` with `CLOUDFLARE_D1_DATABASE_ID` temporarily set to `CLOUDFLARE_D1_RESTORE_DATABASE_ID`.
  - `npm run release:smoke -- --url http://localhost:3200 --site-slug demo-designer --allow-localhost`
  - Passed 10/10 checks.
  - Additional endpoint check: `/api/public/sites/demo-designer/projects` returned `projects=1`, `galleryItems=3`, `hasVideo=True`.
  - Local dev server was stopped after verification.

Pass criteria status:

- Backup D1 berhasil dibuat tanpa secret di log: passed.
- Restore ke staging/restore DB berhasil: passed.
- Minimal 1 dummy site lengkap dengan client access, project, cover/gallery/video bisa dipulihkan dan dibuka: passed via local app pointed at D1 restore DB.
- Audit D1/R2 restore lulus: passed, 0 errors and 0 warnings.
- Runbook bisa diikuti ulang dari nol: passed for CLI flow; public staging domain remains optional infra hardening, not a Sprint 44 blocker.

## Risiko / Catatan

- Jangan menjalankan restore ke production tanpa flag eksplisit dan konfirmasi manual.
- Jangan menulis nilai `.env.local` atau token Cloudflare ke dokumen/log.
- Backup R2 harus mempertahankan prefix `sites/{siteId}/...` agar isolation tetap bisa diaudit.
- `backups/` dan `.backup-drill/` di-ignore git karena backup lokal dapat berisi data buyer, password hash, token hash reset password, dan audit log.
- Env ops baru `CLOUDFLARE_D1_RESTORE_DATABASE_ID` ditambahkan ke `.env.example` dan inventory nama env untuk target restore staging.
- Full-pass memakai D1 restore database dan local app smoke. Belum ada public staging domain permanen; kalau nanti dibutuhkan untuk operasi tim, buat Sprint infra terpisah.

## File Target

- `scripts/cloudflare/backup-d1.ts`
- `scripts/cloudflare/restore-d1.ts`
- `scripts/cloudflare/backup-r2-site-media.ts`
- `scripts/cloudflare/audit-restore-integrity.ts`
- `scripts/cloudflare/backup-common.ts`
- `scripts/cloudflare/seed-restore-drill-project.ts`
- `docs/operations/backup-restore-runbook.md`
- `docs/tracker/logs/sprint_44_backup_restore_drill.md`

## Files Modified

- `.env.example`
- `.gitignore`
- `docs/operations/backup-restore-runbook.md`
- `docs/product-boundary/env-inventory.md`
- `docs/tracker/logs/sprint_44_backup_restore_drill.md`
- `package.json`
- `scripts/cloudflare/audit-restore-integrity.ts`
- `scripts/cloudflare/backup-common.ts`
- `scripts/cloudflare/backup-d1.ts`
- `scripts/cloudflare/backup-r2-site-media.ts`
- `scripts/cloudflare/product-env.ts`
- `scripts/cloudflare/restore-d1.ts`
- `scripts/cloudflare/seed-restore-drill-project.ts`

## Next Required Step

Sprint 44 is complete. Recommended next sprint order:

1. Sprint 45 monitoring + alert.
2. Sprint 46 multi-buyer load test.
3. Optional infra hardening: create a permanent public staging Worker/domain wired to restore/staging D1 for future restore drills.
