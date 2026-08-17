# Tracker Log: Sprint 22 - Production Deploy & Smoke

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Menjalankan production deploy full Cloudflare untuk Portfolio OS Template.
- Memastikan Worker lolos limit ukuran Cloudflare Free.
- Menjalankan smoke test production terhadap endpoint utama, public site demo, client pages, dan FFmpeg R2.

## Task List
- [x] Jalankan pre-deploy gates.
- [x] Deploy ke Cloudflare Workers.
- [x] Fix blocker ukuran Worker Free.
- [x] Jalankan production smoke test.
- [x] Catat production URL, version ID, dan hasil verifikasi.

## File yang Dimodifikasi (Modified Files)
- `src/app/admin/desktop/WindowContentRenderer.tsx` -> Panel CRUD admin desktop dibuat browser-only dengan `ssr: false` agar panel interaktif berat tidak ikut memperbesar server render Worker.
- `wrangler.jsonc` -> Menambahkan `minify: true` supaya bundle deploy Wrangler tetap di bawah batas ukuran Cloudflare Workers Free.
- `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md` -> Menambahkan catatan bahwa `wrangler.jsonc` harus mempertahankan `minify: true`.
- `docs/release/RC1_RELEASE_NOTES.md` -> Memperbarui status validasi RC1 setelah deploy production dan smoke test.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 22 dan memperbarui status global.
- `docs/tracker/logs/sprint_22_production_deploy.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** `npm run cf:deploy` gagal karena Worker melebihi batas 3 MiB Cloudflare Free.
  - **Penyebab:** Bundle Worker gzip `3174.19 KiB`, sedikit di atas batas 3 MiB. Log Cloudflare menunjukkan file terbesar adalah `.open-next/server-functions/default/handler.mjs`.
  - **Perbaikan:** Panel admin desktop berat dibuat client-only (`ssr: false`) dan Wrangler minify diaktifkan. Dry-run turun dari `3080.31 KiB` menjadi `2644.33 KiB` gzip; deploy production final `2643.83 KiB` gzip.

- **Bug 2:** Deploy production belum memiliki bukti smoke test otomatis.
  - **Penyebab:** Sebelum Sprint 22, runbook dan script smoke sudah ada, tetapi production deploy belum dijalankan pada sprint terakhir.
  - **Perbaikan:** Production deploy berhasil dan `npm run release:smoke -- --url https://portfolio-os-template.m4keitbetter.workers.dev --site-slug demo-designer` lulus `8/8`.

## Verifikasi
- `npm run release:audit` -> pass, `59/59` checks.
- `npm run cf:doctor` -> pass; env produk lengkap, D1/R2 configured, live guard confirmed.
- `npm run cf:readiness` -> pass, `22/22` checks.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npx vitest run "src/app/api/r2/[...key]/route.test.ts" "src/lib/services/project/projectStorage.test.ts" "src/lib/product/siteStorageUsage.test.ts"` -> pass, 23 tests.
- `npm run cf:build` -> pass.
- `npx wrangler deploy --dry-run --outdir tmp/sprint22-dry-run-config-minify` -> Worker gzip `2644.33 KiB`.
- `npm run cf:deploy` -> pass.
- Production Worker upload size: gzip `2643.83 KiB`.
- Production URL: `https://portfolio-os-template.m4keitbetter.workers.dev`.
- Current Version ID: `210f2cbc-7103-4265-ac2a-86c2b896d995`.
- Production smoke test:
  - `/api/health` -> 200.
  - `/` -> 200.
  - `/client/login` -> 200.
  - `/client/dashboard` -> 200.
  - `/api/public/sites/demo-designer` -> 200.
  - `/api/public/sites/demo-designer/projects` -> 200.
  - `/r2/ffmpeg/ffmpeg-core.js` -> 200.
  - `/r2/ffmpeg/ffmpeg-core.wasm` -> 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Jangan hapus `minify: true` di `wrangler.jsonc`; tanpa itu bundle production kembali mendekati/melewati limit Cloudflare Workers Free.
- Deploy production sudah berhasil di Workers URL di atas. Langkah stabilisasi berikutnya adalah manual acceptance: login master admin, client login, create site, upload cover/gallery/video, dan cek quota Lite/Pro di production.
- Warning OpenNext Windows dan deprecation child process tetap non-blocking dari toolchain; deploy final tetap sukses.
