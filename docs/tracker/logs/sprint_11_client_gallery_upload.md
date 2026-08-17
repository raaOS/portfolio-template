# Tracker Log: Sprint 11 - Client Gallery Image Upload

**Status:** Completed
**Mulai:** 2026-06-29
**Selesai:** 2026-06-29

## Tujuan (Objective)
- Menambahkan upload gallery image multi-file dari Client Dashboard.
- Menjaga semua gallery media site-scoped ke R2 prefix `sites/{siteId}/projects/gallery/...`.
- Menegakkan storage quota `storageMb` sebelum menulis file gallery ke R2.
- Menyimpan gallery ke payload project tanpa mengubah cover otomatis.

## Task List
- [x] Audit schema project, mapper SQL, dan service SQL untuk field `gallery`.
- [x] Tambah endpoint `POST /api/admin/sites/[siteId]/project-media` untuk gallery image.
- [x] Validasi admin + CSRF, site aktif, tipe image, ukuran file, dan quota storage.
- [x] Integrasikan multi-upload gallery image di `ClientDashboardPanel`.
- [x] Simpan URL gallery ke `draft.gallery` dan payload `gallery`.
- [x] Tambah mapper SQL agar metadata `gallery` keluar lagi ke response project.
- [x] Tambah test endpoint dan verifikasi TypeScript, lint, Cloudflare build, browser QA.

## File yang Dimodifikasi (Modified Files)
- `src/app/api/admin/sites/[siteId]/project-media/route.ts` -> Endpoint upload gallery image scoped ke `sites/{siteId}/projects/gallery/`.
- `src/app/api/admin/sites/[siteId]/project-media/route.test.ts` -> Test auth, R2 env, site inactive, tipe/ukuran file, quota storage, dan key R2 site-scoped.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Menambah state `gallery`, multi-upload gallery image, thumbnail list, remove action, dan payload save `gallery`.
- `src/lib/mappers/projectMapper.ts` -> Mengembalikan metadata `gallery` ke object `Project` dan membersihkan type `any` menjadi `ProjectMetadata`.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 11.
- `docs/tracker/logs/sprint_11_client_gallery_upload.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Client Dashboard belum bisa menambah gallery project sendiri.
  - **Penyebab:** Sprint 9 hanya mengaktifkan upload cover. Field gallery belum ada di draft/payload dashboard.
  - **Perbaikan:** Tambah multi-upload gallery image dan simpan URL ke `gallery`.

- **Bug 2:** Metadata `gallery` yang tersimpan di SQL tidak keluar lagi dari mapper.
  - **Penyebab:** `mapSqlToProject()` belum memetakan `metadata.gallery`.
  - **Perbaikan:** Tambah `gallery: metadata.gallery` pada project hasil mapper.

- **Bug 3:** Risiko gallery upload menulis ke path R2 bebas.
  - **Penyebab:** Tidak ada endpoint gallery site-scoped.
  - **Perbaikan:** Endpoint baru membuat key server-side dan hanya memakai prefix `sites/{siteId}/projects/gallery/`.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/[siteId]/project-media/route.test.ts` -> pass, 7 tests.
- `npx vitest run src/app/api/admin/sites/[siteId]/project-media/route.test.ts src/app/api/admin/sites/[siteId]/project-cover/route.test.ts src/app/api/admin/sites/route.test.ts src/app/api/projects/route.test.ts src/app/api/projects/[id]/route.test.ts src/app/api/projects/bulk/route.test.ts src/lib/product/siteStorageUsage.test.ts` -> pass, 62 tests.
- `npx tsc --noEmit --pretty false` -> pass.
- Targeted `npx eslint` untuk file Sprint 11 -> pass.
- `npm run cf:build` -> pass. Route `/api/admin/sites/[siteId]/project-media` masuk output Cloudflare build.
- Browser QA:
  - Browser plugin gagal dengan error metadata sandbox `missing field sandboxPolicy`, jadi QA memakai Playwright langsung.
  - `/admin/client-dashboard` membuka form `Project Baru`.
  - Section `Gallery images` tampil dengan multi-file input dan empty state.
  - `POST /api/admin/sites/default-site/project-media` dengan video `mp4` ditolak 415.
  - Console/page errors -> none.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Sprint 11 hanya mendukung gallery image kecil: JPG, PNG, WebP, AVIF, max 10 MB per file.
- Video gallery belum diaktifkan karena perlu direct upload/presign dan pipeline poster/preview yang site-scoped.
- Gallery disimpan sebagai array `gallery` di metadata project, bukan `galleryItems`, agar cover project tidak berubah otomatis oleh `cover_media_id`.
- Cleanup R2 untuk gallery images ketika project dihapus belum ditangani karena file disimpan di metadata, bukan `media_assets`. Sprint lanjutan perlu media manifest/asset cleanup site-scoped.
- Dev server sudah dinyalakan ulang di `http://localhost:3000`.
