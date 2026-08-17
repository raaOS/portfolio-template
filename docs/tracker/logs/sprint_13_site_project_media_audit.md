# Tracker Log: Sprint 13 - Site Project Media Audit

**Status:** Completed
**Mulai:** 2026-06-30
**Selesai:** 2026-06-30

## Tujuan (Objective)
- Menambahkan audit tool untuk media project multi-site di R2 prefix `sites/{siteId}/projects/...`.
- Membandingkan referensi project D1 SQL dengan object R2 tanpa mengandalkan path legacy `assets/projects/`.
- Menyediakan report orphan, dangling reference, invalid media row, dan cross-site reference sebelum fitur video gallery ditambahkan.

## Task List
- [x] Audit script legacy `audit-orphan-projects.ts` dan schema SQL relasional.
- [x] Tambah script `scripts/cloudflare/audit-site-project-media.ts`.
- [x] Baca `sites`, `projects`, dan `media_assets` dari D1 SQL.
- [x] Scan object R2 prefix `sites/*/projects/` atau satu site via `--site-id`.
- [x] Deteksi orphan R2 object, dangling D1 reference, cross-site reference, invalid media row, dan unknown site object.
- [x] Tambah mode `--json`, `--delete-orphans`, `--yes`, dan safety guard sebelum delete.
- [x] Tambah npm script `media:audit-projects`.
- [x] Update dokumentasi script.
- [x] Verifikasi TypeScript, ESLint, help command, audit read-only, Vitest media cleanup, dan Cloudflare build.

## File yang Dimodifikasi (Modified Files)
- `scripts/cloudflare/audit-site-project-media.ts` -> Audit D1/R2 project media multi-site dengan default report-only dan guarded deletion.
- `scripts/cloudflare/product-bootstrap.ts` -> Seed demo sekarang memastikan cover demo R2 dibuat jika belum ada.
- `src/lib/r2Storage.ts` -> Fallback S3-compatible R2 dibuat lazy dan non-bundled tanpa memicu warning critical dependency.
- `package.json` -> Menambahkan script `media:audit-projects`.
- `scripts/README.md` -> Menambahkan instruksi audit media project Cloudflare.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 13 dan memperbarui status Sprint 12.
- `docs/tracker/logs/sprint_12_project_media_lifecycle_cleanup.md` -> Memperbarui status verifikasi yang sebelumnya blocked.
- `docs/tracker/logs/sprint_13_site_project_media_audit.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Belum ada alat audit untuk prefix media project baru `sites/{siteId}/projects/...`.
  - **Penyebab:** Script lama hanya mengecek `assets/projects/` dan membaca service legacy.
  - **Perbaikan:** Script baru membaca SQL relational D1 dan scan R2 prefix multi-site.

- **Bug 2:** Risiko orphan cleanup lintas tenant jika audit tidak memahami site boundary.
  - **Penyebab:** Produk sekarang multi-site, tetapi audit legacy tidak memvalidasi `site_id`.
  - **Perbaikan:** Script baru memvalidasi key `sites/{siteId}/projects/...`, melaporkan cross-site references, dan menolak delete jika ada data issue.

- **Bug 3:** Sprint 12 belum bisa diverifikasi penuh karena environment `spawn EPERM`.
  - **Penyebab:** Shell sebelumnya menolak spawn native untuk Vite/esbuild.
  - **Perbaikan:** Setelah environment berubah, `vitest` targeted dan `cf:build` berhasil dijalankan.

- **Bug 4:** `npm run media:audit-projects` menemukan dangling reference demo.
  - **Penyebab:** `cf:seed-demo` membuat row D1 untuk dua cover demo, tetapi belum membuat object R2-nya.
  - **Perbaikan:** `product-bootstrap.ts` sekarang generate dan upload JPEG cover demo ke R2 secara idempotent.

- **Bug 5:** Build menampilkan warning `Critical dependency: the request of a dependency is an expression` dari `src/lib/r2Storage.ts`.
  - **Penyebab:** Fallback S3-compatible untuk Node/script memakai dynamic import expression agar AWS SDK tidak ikut bundle Worker.
  - **Perbaikan:** Import fallback tetap lazy dan `webpackIgnore`, tetapi module path dibuat sebagai ekspresi runtime deterministik supaya Webpack tidak membuat context dependency dan OpenNext/esbuild tidak mencoba resolve `r2StorageS3` sebagai import statis.

## Verifikasi
- `npx tsc --noEmit --pretty false` -> pass.
- `npx eslint --no-ignore scripts/cloudflare/audit-site-project-media.ts` -> pass.
- `npx eslint --no-ignore scripts/cloudflare/product-bootstrap.ts` -> pass.
- `npx tsx scripts/cloudflare/audit-site-project-media.ts --help` -> pass.
- `npm run media:audit-projects` sebelum hotfix seed demo -> pass secara runtime/read-only, exit code 1 karena audit menemukan temuan nyata:
  - Sites: 1.
  - Projects: 2.
  - R2 project objects: 0.
  - Referenced keys: 2.
  - Orphan files: 0.
  - Dangling references: 4 entries pointing to 2 missing demo project keys.
  - Invalid media rows: 0.
  - Cross-site references: 0.
- `npm run cf:seed-demo` -> pass; upload 2 cover demo ke R2.
- `npm run media:audit-projects` setelah hotfix -> pass, exit code 0:
  - Sites: 1.
  - Projects: 2.
  - R2 project objects: 2.
  - Referenced keys: 2.
  - Orphan files: 0.
  - Dangling references: 0.
  - Invalid media rows: 0.
  - Cross-site references: 0.
- `npx vitest run src/lib/services/project/projectStorage.test.ts src/lib/services/project/projectSqlService.test.ts` -> pass, 8 tests.
- `npm run cf:build` -> pass. Warning lama tetap muncul: OpenNext Windows compatibility, middleware convention deprecation, FFmpeg public URL/R2 note, dan esbuild duplicate/suspicious warnings.
- `npx eslint src/lib/r2Storage.ts` -> pass.
- `npm run cf:build` setelah hotfix `r2Storage.ts` -> pass; warning `Critical dependency` dari `src/lib/r2Storage.ts` sudah hilang. Warning tersisa: OpenNext Windows compatibility, middleware convention deprecation, FFmpeg public URL/R2 note, dan esbuild duplicate/suspicious warnings.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- `npm run media:audit-projects` sengaja exit code 1 jika menemukan orphan/dangling/data issue. Itu bukan crash.
- Kondisi data demo sudah bersih setelah hotfix: 2 referensi D1 demo punya 2 object R2 yang sesuai.
- Delete orphan hanya bisa lewat `--delete-orphans`; script akan abort jika D1 tidak punya reference valid, orphan ratio terlalu tinggi, ada invalid media row, atau ada cross-site reference.
- Sprint berikutnya yang logis: perbaiki demo media dangling hasil audit, lalu lanjut Sprint 14 gallery video direct upload/presign dengan poster/preview.
