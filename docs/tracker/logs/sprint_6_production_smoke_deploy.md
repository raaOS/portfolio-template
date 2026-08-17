# Tracker Log: Sprint 6 - Production Smoke Deploy

**Status:** Completed
**Mulai:** 2026-06-28
**Selesai:** 2026-06-28

## Tujuan (Objective)
- Memastikan Portfolio OS Template bisa dibuild, dideploy, dan berjalan di Cloudflare Workers production tanpa Vercel.
- Menurunkan ukuran Worker agar lolos batas Cloudflare Workers Free.
- Memastikan jalur R2 runtime memakai Cloudflare binding, bukan AWS SDK di bundle Worker.
- Melakukan smoke test endpoint production utama setelah deploy.

## Task List
- [x] Optimasi bundle server agar deploy Cloudflare lolos batas gzip 3 MiB.
- [x] Alihkan operasi R2 runtime ke binding `MEDIA_BUCKET` dan pisahkan fallback S3-compatible untuk script Node.
- [x] Tambahkan endpoint direct upload Worker untuk PUT raw bytes ke R2 binding.
- [x] Patch artifact OpenNext/Next yang gagal di Worker runtime.
- [x] Perbaiki `/api/health` agar filesystem Worker tidak dianggap failure.
- [x] Deploy production dan smoke test endpoint utama.

## File yang Dimodifikasi (Modified Files)
- `open-next.config.ts` -> Mengaktifkan minify OpenNext untuk default server dan middleware bundle.
- `wrangler.jsonc` -> Menambahkan binding R2 `MEDIA_BUCKET`.
- `scripts/cloudflare/prepare-opennext-worker-output.js` -> Menambahkan patch output OpenNext untuk FFmpeg WASM import, instrumentation dynamic require, cacheHandlers closure, middleware minify, dan pembersihan aset FFmpeg oversized.
- `src/lib/r2Storage.ts` -> Mengubah adapter R2 menjadi binding-first untuk runtime Cloudflare Worker dan signed internal upload URL.
- `src/lib/r2StorageS3.ts` -> Menyimpan fallback S3-compatible berbasis AWS SDK untuk script/maintenance Node.
- `src/app/api/admin/upload/direct/route.ts` -> Endpoint PUT internal untuk direct upload admin ke R2 binding dengan auth, CSRF, token, content type, dan size guard.
- `src/app/api/admin/upload/presign/route.ts` -> Mengubah kontrak presign menjadi signed Worker upload URL dan menyertakan max size.
- `src/app/admin/components/file-upload/hooks/useStorageUpload.ts` -> Menambahkan CSRF header pada direct PUT upload.
- `src/app/admin/projects/AdminProjectsClient.tsx` -> Menonaktifkan SSR untuk modal admin berat agar bundle Worker lebih kecil.
- `src/lib/loaders.ts` -> Membersihkan path loader legacy yang menarik validasi project lama dan memastikan loader homepage memakai SQL site-aware.
- `src/app/api/health/route.ts` -> Menandai filesystem sebagai `not_applicable` di Cloudflare runtime.
- `src/app/api/health/route.test.ts` -> Menambah test health untuk Cloudflare runtime tanpa filesystem.
- `.env.example` -> Mendokumentasikan `CLOUDFLARE_R2_BINDING`.
- `docs/product-boundary/env-inventory.md` -> Menambahkan catatan env optional untuk binding R2.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 6.
- `docs/tracker/logs/sprint_6_production_smoke_deploy.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Deploy Cloudflare gagal karena Worker gzip melebihi limit 3 MiB.
  - **Penyebab:** Bundle server masih menarik AWS SDK R2 dan beberapa modal admin berat masuk server bundle.
  - **Perbaikan:** R2 runtime dipindah ke binding Worker, AWS SDK dipisah ke `r2StorageS3.ts`, modal admin berat dijadikan client-only, dan middleware bundle dimininify.

- **Bug 2:** Production Worker merespons 500 di semua route setelah deploy pertama.
  - **Penyebab:** Next/OpenNext mencoba dynamic require `/.next/server/instrumentation.js`, yang tidak didukung Worker runtime.
  - **Perbaikan:** `prepare-opennext-worker-output.js` menonaktifkan resolver instrumentation Node-style pada artifact OpenNext.

- **Bug 3:** Preview Worker lokal masih 500 dengan `ReferenceError: t is not defined`.
  - **Penyebab:** Bundle Next hasil OpenNext memiliki closure `cacheHandlers` yang rusak di Worker.
  - **Perbaikan:** Artifact patch mengganti referensi minified yang putus ke `this.nextConfig.cacheHandlers` dan `this.nextConfig.cacheMaxMemorySize`.

- **Bug 4:** `/api/health` production mengembalikan 503 walau D1 connected.
  - **Penyebab:** Health check lama menganggap filesystem inaccessible sebagai degraded, sementara Cloudflare Worker memang tidak punya filesystem normal.
  - **Perbaikan:** Health check memberi `filesystem: "not_applicable"` untuk Cloudflare runtime dan tetap mengecek D1 sebagai indikator utama.

## Verifikasi
- `npx vitest run src/app/api/health/route.test.ts` -> pass, 4 tests.
- `npm run cf:build` -> pass.
- `npx opennextjs-cloudflare deploy` -> pass.
- Production Worker upload size: gzip `2909.94 KiB`.
- Production URL: `https://portfolio-os-template.m4keitbetter.workers.dev`.
- Smoke test production:
  - `/` -> 200.
  - `/api/health` -> 200, database connected.
  - `/api/public/sites/demo-designer` -> 200.
  - `/api/public/sites/demo-designer/projects` -> 200.
  - `/demo-designer` -> 200.
  - `/r2/ffmpeg/ffmpeg-core.js` -> 200.
  - `/r2/ffmpeg/ffmpeg-core.wasm` -> 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Jangan ganti `src/middleware.ts` kembali ke `src/proxy.ts`; OpenNext Cloudflare masih memakai entry middleware untuk repo ini.
- `default-site` adalah `site.id`; slug publik demo adalah `demo-designer`.
- Browser FFmpeg production sudah bisa membaca `/r2/ffmpeg/ffmpeg-core.js`; pastikan file pendamping `.wasm` tetap ada di R2 key `ffmpeg/*`.
- AWS SDK masih ada di dependencies untuk script/maintenance, tetapi tidak boleh ikut masuk ke Worker runtime bundle.
- Warning build tentang duplicate case dan suspicious nullish berasal dari bundle dependency/generated output; tidak memblokir deploy.
