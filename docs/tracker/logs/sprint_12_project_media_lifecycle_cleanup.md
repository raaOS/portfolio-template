# Tracker Log: Sprint 12 - Project Media Lifecycle Cleanup

**Status:** Completed
**Mulai:** 2026-06-30
**Selesai:** 2026-06-30

## Tujuan (Objective)
- Menutup kebocoran storage R2 project media setelah project dihapus atau media diganti.
- Membersihkan hanya object R2 project yang site-scoped ke prefix `sites/{siteId}/projects/...`.
- Menjaga cleanup bersifat best-effort dan tidak menghapus URL eksternal, legacy `assets/`, media site lain, atau file yang masih dipakai project lain di site yang sama.

## Task List
- [x] Audit gap cleanup dari Sprint 11 untuk cover/gallery metadata.
- [x] Perluas ekstraksi asset project agar mencakup `gallery`, `galleryItems.poster`, dan `galleryGroups.items.poster`.
- [x] Tambah helper ekstraksi key R2 site-scoped untuk `sites/{siteId}/projects/...`.
- [x] Tambah cleanup stale media saat project update dan cleanup semua media project saat delete.
- [x] Tambah guard referensi antar-project agar file shared tidak terhapus.
- [x] Tambah test helper cleanup dan wiring service SQL.
- [x] Verifikasi TypeScript dan lint targeted.
- [x] Unit test Vitest dan Cloudflare build diverifikasi ulang pada Sprint 13 setelah environment mengizinkan spawn native.

## File yang Dimodifikasi (Modified Files)
- `src/lib/services/project/projectStorage.ts` -> Menambah ekstraksi gallery/poster, parser key site-scoped, side-car video awareness, dan helper cleanup stale media.
- `src/lib/services/project/projectStorage.test.ts` -> Test safety prefix site, dedupe, side-car video, stale cleanup, dan skip saat R2 belum configured.
- `src/lib/services/project/projectSqlService.ts` -> Menghubungkan cleanup media R2 pada `updateProjectSql()` dan `deleteProjectSql()`.
- `src/lib/services/project/projectSqlService.test.ts` -> Test service memanggil cleanup saat update/delete project SQL.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 12.
- `docs/tracker/logs/sprint_12_project_media_lifecycle_cleanup.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Project cover/gallery hasil upload Sprint 9-11 bisa tertinggal di R2 saat project dihapus.
  - **Penyebab:** `deleteProjectSql()` hanya membersihkan `media_assets.r2_key`, sementara cover/gallery client dashboard disimpan sebagai metadata.
  - **Perbaikan:** `deleteProjectSql()` sekarang mengambil object project lengkap dan memanggil `purgeSiteProjectMediaAssets(siteId, project, mediaKeys)`.

- **Bug 2:** Media lama bisa tetap dihitung quota setelah client mengganti cover/gallery.
  - **Penyebab:** `updateProjectSql()` belum membandingkan media sebelum/sesudah update.
  - **Perbaikan:** Tambah `purgeUnreferencedSiteProjectMediaAssets()` untuk menghapus key lama yang tidak ada lagi pada project terbaru.

- **Bug 3:** Cleanup project berisiko terlalu luas jika memakai URL parsing legacy.
  - **Penyebab:** Parser lama berorientasi `assets/` dan tidak punya batas `site_id`.
  - **Perbaikan:** Cleanup baru hanya menerima key yang diawali `sites/{siteId}/projects/` dan mengabaikan path site lain, URL eksternal, dan legacy `assets/`.

- **Bug 4:** Media R2 yang sama bisa dipakai lebih dari satu project jika URL ditempel manual.
  - **Penyebab:** Cleanup stale project-local belum mengecek referensi project lain.
  - **Perbaikan:** Service SQL sekarang mengumpulkan key media project lain dalam site yang sama sebagai `retainedKeys` sebelum purge.

## Verifikasi
- `npx tsc --noEmit --pretty false` -> pass.
- `npx eslint src/lib/services/project/projectStorage.ts src/lib/services/project/projectStorage.test.ts src/lib/services/project/projectSqlService.ts src/lib/services/project/projectSqlService.test.ts` -> pass.
- `npx vitest run src/lib/services/project/projectStorage.test.ts src/lib/services/project/projectSqlService.test.ts` -> pass, 8 tests. Diverifikasi ulang pada Sprint 13 setelah blocker `spawn EPERM` hilang.
- `npm run cf:build` -> pass. Diverifikasi ulang pada Sprint 13 setelah blocker `spawn EPERM` hilang.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Cleanup R2 project media sekarang aman untuk image cover/gallery metadata, mengecek referensi project lain, dan mengenali side-car video konvensional (`.mp4`, `-preview.mp4`, `.jpg`, `.webp`) jika fitur video gallery ditambahkan nanti.
- Fungsi delete langsung R2 tidak diekspor sebagai API publik dari `projectStorage`; pemanggil luar harus lewat helper yang memfilter `siteId`.
- Verifikasi Vitest dan Cloudflare build sudah diulang pada Sprint 13 di shell yang mengizinkan spawn native (`vite`/`esbuild`).
- Sprint berikutnya yang logis: gallery video direct upload/presign dengan poster/preview site-scoped, atau audit script baru untuk prefix `sites/*/projects/`.
