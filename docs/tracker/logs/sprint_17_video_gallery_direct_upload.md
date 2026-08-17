# Tracker Log: Sprint 17 - Video Gallery Direct Upload

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Menambahkan upload video gallery project langsung ke R2.
- Menjaga upload video tetap site-scoped dan quota-aware.
- Menyediakan key poster/preview site-scoped untuk pipeline lanjutan.

## Task List
- [x] Tambah endpoint `POST /api/admin/sites/[siteId]/project-video/presign`.
- [x] Tambah alias client `POST /api/client/sites/[siteId]/project-video/presign`.
- [x] Perluas direct upload Worker endpoint untuk signed token video project.
- [x] Tambah alias client untuk upload image cover/gallery.
- [x] Update admin Client Dashboard agar gallery menerima image dan video.
- [x] Update client dashboard agar gallery menerima image dan video.
- [x] Simpan media project sebagai `galleryItems` dengan `kind: image | video`.
- [x] Tambah coverage unit test untuk video presign.

## File yang Dimodifikasi (Modified Files)
- `src/app/api/admin/sites/[siteId]/project-video/presign/route.ts` -> Presign/direct URL video R2 site-scoped.
- `src/app/api/admin/sites/[siteId]/project-video/presign/route.test.ts` -> Coverage video presign.
- `src/app/api/client/sites/[siteId]/project-video/presign/route.ts` -> Alias client untuk video presign.
- `src/app/api/client/sites/[siteId]/project-cover/route.ts` -> Alias client untuk cover image upload.
- `src/app/api/client/sites/[siteId]/project-media/route.ts` -> Alias client untuk gallery image upload.
- `src/app/api/admin/upload/direct/route.ts` -> Direct upload signed-token whitelist untuk `sites/{siteId}/projects/videos|video-posters|video-previews/`.
- `src/middleware/constants.ts` -> Menjadikan `/api/admin/upload/direct` public dari auth admin, tetap dilindungi CSRF middleware dan signed token.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Tombol upload video gallery dan preview video.
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` -> Upload video direct-to-R2 untuk client.
- `src/lib/mappers/projectMapper.ts` -> Mengenali `.mov` sebagai video.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Gallery project hanya mendukung image upload.
  - **Penyebab:** Sprint 11 hanya mengerjakan image gallery.
  - **Perbaikan:** Tambah presign video, direct upload, validasi tipe/ukuran, dan preview video di UI.

- **Bug 2:** Endpoint direct upload berada di bawah `/api/admin`, sehingga client akan ditolak middleware admin.
  - **Penyebab:** Direct upload awal dibuat untuk wallpaper admin.
  - **Perbaikan:** Route direct upload dibuat signed-token based dan path-nya di-allowlist auth admin middleware; CSRF global tetap berlaku untuk internal Worker upload.

- **Bug 3:** S3-compatible presigned URL eksternal bisa gagal jika dikirimi cookie/CSRF tambahan.
  - **Penyebab:** Header tambahan hanya valid untuk internal Worker direct endpoint.
  - **Perbaikan:** UI hanya mengirim `x-csrf-token` dan credentials ketika `uploadUrl` internal (`/...`).

## Verifikasi
- `npx vitest run src/app/api/admin/sites/[siteId]/project-video/presign/route.test.ts` -> pass.
- `npx vitest run src/app/api/admin/sites/[siteId]/project-cover/route.test.ts` -> pass.
- `npx vitest run src/app/api/admin/sites/[siteId]/project-media/route.test.ts` -> pass.
- Regression suite API terdampak -> pass, 59 tests.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Endpoint presign mengembalikan `posterKey/posterUrl` dan `previewKey/previewUrl`, tetapi pembuatan poster/preview otomatis belum diimplementasikan.
- Browser video compression tetap membutuhkan `NEXT_PUBLIC_FFMPEG_BASE_URL` bila memakai FFmpeg WASM di production.
- Direct upload internal tetap wajib mengirim `x-csrf-token`; URL eksternal S3 presigned jangan dikirimi header CSRF.
