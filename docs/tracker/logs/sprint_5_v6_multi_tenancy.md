# Tracker Log: Sprint 5 - V6 Multi-tenancy & SQL Loader Migration

**Status:** 🟢 Completed  
**Mulai:** 2026-06-28  
**Selesai:** 2026-06-28  

## 🎯 Tujuan (Objective)
- Menyelesaikan seluruh gap audit dari "V6 Completion Audit", khususnya integrasi multi-tenancy di database D1 & KV, migrasi project loaders ke D1 SQL relational, dan dynamic routing `/api/public` serta UI `/[siteSlug]`.
- Memastikan compiler TS check dan unit tests lulus 100% serta build Cloudflare (`npm run cf:build`) sukses.

## 📋 Task List
- [x] Scoping multi-tenant `siteId` di database/KV reads & writes.
- [x] Migrasi homepage projects loaders ke relational D1 SQL queries.
- [x] Penambahan public API endpoints (`/api/public/sites/[siteSlug]`).
- [x] Pembuatan dynamic routing layout & page UI di `src/app/[siteSlug]`.
- [x] Memperbaiki unit test assertion yang patah pada delete project mock.
- [x] Mengunggah file FFmpeg WASM ke Cloudflare R2 bucket dan mengonfigurasi `NEXT_PUBLIC_FFMPEG_BASE_URL` di env.
- [x] Memperbaiki URL FFmpeg agar tidak bergantung pada public R2 domain yang timeout; sekarang lewat app proxy `/r2/ffmpeg`.

## 📂 File yang Dimodifikasi (Modified Files)
- `src/lib/services/contentService.ts` -> Penerapan scope key database `content_${siteId}/[nodeName]`.
- `src/lib/services/aboutService.ts` -> Signature method disesuaikan agar menerima optional `siteId`.
- `src/lib/services/experienceService.ts` -> Penerimaan optional `siteId` untuk multi-tenant query.
- `src/lib/services/hardSkillService.ts` -> Penerimaan optional `siteId` untuk multi-tenant query.
- `src/lib/services/testimonialService.ts` -> Penerimaan optional `siteId` untuk multi-tenant query.
- `src/lib/loaders.ts` -> Mengubah data loader project untuk memakai query D1 SQL relasional.
- `src/lib/projects.ts` -> Mengubah `getProjects` dan query project lainnya ke D1 SQL relasional.
- `src/app/api/projects/route.ts` & `src/app/api/projects/[id]/route.ts` -> API CRUD menerima `siteId` dinamis dari payload/header.
- `src/lib/adapters/siteDataAdapter.ts` -> Resolver data publik untuk profile, settings, dan projects berdasarkan slug tenant.
- `src/app/[siteSlug]/page.tsx` & `layout.tsx` -> Virtual OS dynamic simulator page untuk tenant custom.
- `src/app/api/projects/[id]/route.test.ts` -> Memperbaiki mock parameter delete project.
- `.env.local` -> Penambahan `NEXT_PUBLIC_FFMPEG_BASE_URL` R2 dev URL.
- `src/app/api/r2/[...key]/route.ts` -> Allowlist read-only untuk `ffmpeg/ffmpeg-core.js` dan `ffmpeg/ffmpeg-core.wasm`.
- `src/app/api/r2/[...key]/route.test.ts` -> Coverage untuk prefix FFmpeg yang diizinkan dan object FFmpeg arbitrary yang ditolak.
- `.env.local` -> `NEXT_PUBLIC_FFMPEG_BASE_URL` diarahkan ke `/r2/ffmpeg`.
- `.env.example` / `.dev.vars.example` -> Default FFmpeg base URL diganti ke `/r2/ffmpeg`.
- `docs/product-boundary/env-inventory.md` -> Catatan env FFmpeg diperbarui agar memakai app proxy.

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Bug 1: Unit Test Deletion Mock Failure**
  - **Penyebab:** Perubahan signature API method `deleteProject` yang sekarang menerima `siteId` (default: `'default-site'`) menyebabkan assertion `toHaveBeenCalledWith` di unit test menerima 2 parameter dibanding 1.
  - **Perbaikan:** Menyesuaikan ekspektasi test di `route.test.ts` agar menyertakan `'default-site'`.
- **Bug 2: Public R2 FFmpeg URL Timeout**
  - **Penyebab:** Object FFmpeg sudah ada di R2, tetapi `NEXT_PUBLIC_FFMPEG_BASE_URL` mengarah ke public R2/custom URL yang tidak reachable dari browser/runtime lokal.
  - **Perbaikan:** Gunakan `/r2/ffmpeg` agar browser mengambil `ffmpeg-core.js` dan `ffmpeg-core.wasm` lewat Worker/app proxy yang sudah memiliki akses R2. Route tetap dibatasi hanya untuk dua file FFmpeg core.
- **Bug 3: ESLint Warning di Homepage Loader**
  - **Penyebab:** `src/lib/loaders.ts` masih menyimpan import service legacy yang tidak dipakai dan memakai `Record<string, any>` untuk row content D1.
  - **Perbaikan:** Hapus import legacy yang tidak dipakai dan ganti `any` dengan tipe `HomepageContentRow` berbasis `unknown`.

## Verifikasi Tambahan
- `npm run lint` -> pass tanpa warning.
- `npx tsc --noEmit --pretty false` -> pass.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Kode sudah 100% lulus `tsc`, `lint`, `npm test` (686 tests), dan `npm run cf:build`.
- Jika ke depannya ingin melakukan testing integrasi dynamic tenant di localhost, jalankan server lokal lalu buka link `http://localhost:3000/default-site` atau nama slug tenant yang ada di database D1.
- FFmpeg browser compression tidak perlu public R2 domain langsung. Simpan object di R2 keys `ffmpeg/ffmpeg-core.js` dan `ffmpeg/ffmpeg-core.wasm`, lalu pakai `NEXT_PUBLIC_FFMPEG_BASE_URL=/r2/ffmpeg`.
