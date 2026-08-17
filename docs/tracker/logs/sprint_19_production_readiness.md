# Tracker Log: Sprint 19 - Production Readiness & Full Cloudflare Smoke Test

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Menambahkan checklist produksi yang bisa diulang sebelum deploy/jual.
- Memastikan konfigurasi full Cloudflare siap: env, D1, R2, Wrangler binding, quota Lite/Pro, dan FFmpeg browser assets.
- Memverifikasi build OpenNext Cloudflare dan smoke test Worker lokal tanpa warning/error tersembunyi yang actionable.

## Task List
- [x] Tambah `npm run cf:readiness`.
- [x] Validasi env produk tanpa mencetak secret.
- [x] Validasi quota Lite/Pro dan feature env dasar.
- [x] Validasi `wrangler.jsonc` R2 binding cocok dengan env.
- [x] Validasi schema D1 live memiliki tabel produk wajib.
- [x] Validasi FFmpeg browser assets ada di R2 (`ffmpeg-core.js` dan `ffmpeg-core.wasm`).
- [x] Smoke test Next dev endpoints.
- [x] Smoke test Worker lokal via `wrangler dev`.
- [x] Bersihkan warning vendor duplicate-case dari output Worker generated bundle.

## File yang Dimodifikasi (Modified Files)
- `package.json` -> Menambahkan script `cf:readiness`.
- `scripts/cloudflare/production-readiness.ts` -> Script read-only production readiness untuk env, plan quota, D1 schema, R2 FFmpeg, dan Wrangler binding.
- `scripts/cloudflare/upload-ffmpeg-to-r2.ts` -> Menjadikan aset FFmpeg wajib tegas dan menghapus asumsi `.worker.js`.
- `scripts/cloudflare/prepare-opennext-worker-output.js` -> Menghapus unreachable duplicate vendor case dari bundle Worker generated output agar `wrangler dev` tidak memunculkan warning esbuild.
- `src/app/api/r2/[...key]/route.ts` -> Menjaga allowlist `/r2/ffmpeg` minimal hanya untuk aset yang benar-benar dipakai browser.
- `src/app/api/r2/[...key]/route.test.ts` -> Menyesuaikan coverage allowlist FFmpeg.
- `scripts/core/dev.js` -> Memfilter notice dev Next.js `middleware` yang tidak actionable untuk target OpenNext Cloudflare.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan referensi Sprint 19.
- `docs/tracker/logs/sprint_16_safe_site_delete.md` -> Koreksi catatan FFmpeg `.worker.js` agar tidak dianggap wajib.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Belum ada satu command readiness produksi yang menggabungkan env, D1, R2, quota, dan binding.
  - **Penyebab:** Verifikasi tersebar di `cf:doctor`, `cf:live-check`, build, dan smoke test manual.
  - **Perbaikan:** Tambah `npm run cf:readiness` sebagai gate read-only sebelum deploy/jual.

- **Bug 2:** Upload FFmpeg menganggap `ffmpeg-core.worker.js` wajib, padahal hook browser hanya memakai `.js` dan `.wasm`.
  - **Penyebab:** Allowlist sebelumnya terlalu lebar untuk kemungkinan aset Worker yang tidak ada di package saat ini.
  - **Perbaikan:** Minimalisasi allowlist dan upload list ke `ffmpeg-core.js` + `ffmpeg-core.wasm`.

- **Bug 3:** `wrangler dev` masih memunculkan warning esbuild duplicate-case dari vendor/minified OpenNext output.
  - **Penyebab:** Bundle generated membawa duplicate `case 22` unreachable dari dependency vendor.
  - **Perbaikan:** Pipeline `prepare-opennext-worker-output.js` menghapus clause unreachable kedua. Behavior runtime tetap sama karena clause tersebut tidak pernah dieksekusi JavaScript.

- **Bug 4:** `npm run dev` masih menampilkan deprecation `middleware -> proxy.ts` yang tidak sesuai untuk target OpenNext Cloudflare repo ini.
  - **Penyebab:** Next.js dev server memberi notice umum untuk Next 16.
  - **Perbaikan:** Dev launcher memfilter hanya notice yang sudah diketahui tersebut. `src/middleware.ts` tetap dipertahankan.

## Verifikasi
- `npm run cf:doctor` -> pass; env produk lengkap, D1/R2 configured, live guard confirmed.
- `npm run cf:compat-audit -- --strict` -> pass; 0 blocker, 0 review item.
- `npm run cf:readiness` -> pass; 22/22 checks.
- `npm run cf:live-check` -> pass; D1 live check ok.
- HTTP smoke Next dev:
  - `/` -> 200.
  - `/api/health` -> 200.
  - `/client/login` -> 200.
  - `/client/dashboard` -> 200.
  - `/api/public/sites/demo-designer` -> 200.
  - `/api/public/sites/demo-designer/projects` -> 200.
  - `/api/projects` -> 200.
- Targeted regression: 9 files / 56 tests -> pass.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build *> tmp/sprint19-cf-build.log` -> pass.
- Scan `tmp/sprint19-cf-build.log` untuk `WARN`, `WARNING`, `middleware-to-proxy`, OpenNext Windows notice, duplicate/nullish vendor warning, `ContentService`, `fetch-cache`, `Data backend timeout`, `npm notice`, `NativeCommandError`, `error`, dan `failed` -> tidak ada match kecuali pesan patch informatif `Removed unreachable duplicate vendor case`.
- Worker smoke via `wrangler dev --env-file .env.local --port 8788`:
  - `/api/health` -> 200.
  - `/` -> 200.
  - `/client/login` -> 200.
  - `/api/public/sites/demo-designer/projects` -> 200.
  - Stderr scan untuk warning/error -> tidak ada match.
- Dev server restart `npm run dev` -> port 3000 aktif, `/api/health` -> 200.
- Scan `tmp/dev-sprint19.out.log` dan `tmp/dev-sprint19.err.log` untuk middleware deprecation/warning/error -> tidak ada match.
- `node --check scripts/core/dev.js` -> pass.
- `node --check scripts/cloudflare/prepare-opennext-worker-output.js` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- `npm run cf:readiness` adalah gate cepat sebelum deploy produksi. Script ini read-only terhadap Cloudflare dan tidak mencetak secret.
- FFmpeg browser assets wajib ada di R2 pada key `ffmpeg/ffmpeg-core.js` dan `ffmpeg/ffmpeg-core.wasm`; upload ulang dengan `npm run r2:upload-ffmpeg` setelah mengganti bucket/account.
- Jangan menambah kembali `ffmpeg-core.worker.js` sebagai wajib kecuali dependency FFmpeg browser benar-benar berubah memakai worker asset tersebut.
- Saat menjalankan `cf:build`, matikan dev server port 3000 dulu. Guard repo sengaja menolak build ketika dev server aktif.
- Setelah smoke `wrangler dev`, hentikan process tree Wrangler/workerd agar `.open-next` tidak terkunci di Windows.
