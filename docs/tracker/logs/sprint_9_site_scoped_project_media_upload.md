# Tracker Log: Sprint 9 - Site-Scoped Project Media Upload

**Status:** Completed
**Mulai:** 2026-06-29
**Selesai:** 2026-06-29

## Tujuan (Objective)
- Menambahkan upload cover project dari Client Dashboard tanpa memakai pipeline upload legacy yang belum site-scoped.
- Mengunci key media project di R2 ke format `sites/{siteId}/projects/covers/...`.
- Menjaga full Cloudflare: upload memakai R2 adapter binding/fallback yang sudah disiapkan, bukan Vercel.
- Menjaga Lite/Pro self-service: client bisa upload cover sendiri dari dashboard.

## Task List
- [x] Audit helper R2 dan route upload lama agar tidak mengubah flow wallpaper/admin besar.
- [x] Tambah endpoint admin `POST /api/admin/sites/[siteId]/project-cover`.
- [x] Validasi admin + CSRF, site aktif, tipe gambar, ukuran file, dan path storage server-side.
- [x] Tambah test endpoint untuk auth, R2 env, site missing/inactive, validasi file, dan key R2 site-scoped.
- [x] Integrasikan upload cover di `ClientDashboardPanel` dengan preview dan fallback input URL.
- [x] Verifikasi unit test, lint targeted, TypeScript, Cloudflare build, dan browser QA.

## File yang Dimodifikasi (Modified Files)
- `src/app/api/admin/sites/[siteId]/project-cover/route.ts` -> Endpoint upload cover project khusus dashboard client, scoped ke `sites/{siteId}/projects/covers/`.
- `src/app/api/admin/sites/[siteId]/project-cover/route.test.ts` -> Test endpoint upload cover site-scoped.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Menambah upload cover image, preview, validasi client-side, dan sinkronisasi hasil upload ke `Cover URL`.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 9.
- `docs/tracker/logs/sprint_9_site_scoped_project_media_upload.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Client Dashboard hanya bisa input `Cover URL`, belum bisa upload cover sendiri.
  - **Penyebab:** Sprint 8 sengaja menunda upload media karena route upload legacy belum mengunci path per `site_id`.
  - **Perbaikan:** Tambah endpoint kecil khusus cover project yang membuat key R2 dari server dan selalu memakai prefix `sites/{siteId}/projects/covers/`.

- **Bug 2:** Risiko client memilih path storage arbitrer jika upload lama langsung dipakai.
  - **Penyebab:** Flow upload lama dibuat untuk portfolio tunggal/wallpaper dan memakai folder legacy seperti `assets/...`.
  - **Perbaikan:** Endpoint baru tidak menerima folder/key dari client. Client hanya mengirim file, server validasi site dan membentuk key aman.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/[siteId]/project-cover/route.test.ts src/app/api/admin/sites/route.test.ts src/app/api/projects/route.test.ts src/app/api/projects/[id]/route.test.ts src/app/api/projects/bulk/route.test.ts` -> pass, 49 tests.
- `npx eslint src/app/admin/client-dashboard/ClientDashboardPanel.tsx src/app/api/admin/sites/[siteId]/project-cover/route.ts src/app/api/admin/sites/[siteId]/project-cover/route.test.ts` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build` -> pass. Route `/api/admin/sites/[siteId]/project-cover` masuk output Cloudflare build.
- Browser QA fallback Playwright:
  - Login admin development dengan CSRF -> pass.
  - `/admin/client-dashboard` deep-link terbuka.
  - Klik `Project Baru` menampilkan `Cover image`, tombol `Upload`, preview, `Cover URL`, dan `Simpan`.
  - `POST /api/admin/sites/default-site/project-cover` dengan file non-image -> 415 sesuai validasi.
  - Console/page errors -> none.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Upload cover project sudah site-scoped. Jangan pindahkan kembali ke route upload legacy tanpa memastikan key tetap `sites/{siteId}/...`.
- Endpoint ini baru untuk cover image kecil, max 10 MB, tipe JPG/PNG/WebP/AVIF. Gallery/multiple media project belum dibuat.
- Storage aggregate quota `storageMb` Lite/Pro belum dihitung terhadap total R2 per site; Sprint lanjutan perlu audit/list usage R2 per prefix `sites/{siteId}/`.
- Browser plugin gagal dipakai karena runtime mengembalikan error metadata sandbox; QA memakai Playwright langsung sebagai fallback.
- Dev server sudah dinyalakan ulang di `http://localhost:3000`.
