# Tracker Log: Sprint 4 - Cloudflare Workers Deploy Scaffold

**Status:** Completed and locally verified
**Mulai:** 2026-06-28
**Selesai:** 2026-06-28

## Tujuan (Objective)
- Membuat jalur deploy full Cloudflare memakai OpenNext Cloudflare + Wrangler.
- Menghapus blocker runtime yang tidak kompatibel dengan Cloudflare Workers.
- Menambahkan guard pre-deploy agar repo tidak lagi mengarah ke Vercel atau Node-native middleware.

## Task List
- [x] Tambah konfigurasi `wrangler.jsonc`, `open-next.config.ts`, `public/_headers`, dan `.dev.vars.example`.
- [x] Tambah script Cloudflare: `cf:build`, `cf:preview`, `cf:deploy`, `cf:typegen`, dan `cf:compat-audit`.
- [x] Ubah `deploy` agar menjalankan pre-deploy + OpenNext Cloudflare deploy.
- [x] Ganti pre-deploy lama menjadi guard Cloudflare env/config dan audit personal/legacy env.
- [x] Hapus deklarasi `runtime = 'edge'` / `runtime = 'nodejs'` yang tidak perlu di route.
- [x] Migrasi request interception dari `src/proxy.ts` ke `src/middleware.ts` Edge-style karena OpenNext Cloudflare menolak Node.js middleware/proxy.
- [x] Hapus native runtime blockers: `sharp`, `child_process`, `ffmpeg-static`, dan runtime filesystem dari source app/lib.
- [x] Perbaiki bug `ContentService` yang bisa mengembalikan function `val` ke Server Component saat row D1 kosong.
- [x] Jalankan verifikasi typecheck, lint, unit test, doctor, pre-deploy, typegen, build, dan local Worker preview.
- [x] Tambah patch build Windows agar OpenNext/Turbopack tetap bisa membuat bundle Worker valid di mesin Windows.
- [x] Keluarkan FFmpeg WASM browser-only dari Worker assets karena melebihi batas 25 MiB Cloudflare Workers Assets.

## File yang Dimodifikasi (Modified Files)
- `wrangler.jsonc` -> Konfigurasi Worker OpenNext, asset binding, nodejs compatibility.
- `open-next.config.ts` -> Konfigurasi minimal OpenNext Cloudflare.
- `public/_headers` -> Cache header immutable untuk static assets.
- `.dev.vars.example` -> Template env lokal untuk `wrangler dev` tanpa secret nyata, termasuk `NEXT_PUBLIC_FFMPEG_BASE_URL`.
- `.env.example` -> Tambah `NEXT_PUBLIC_FFMPEG_BASE_URL=/r2/ffmpeg` untuk FFmpeg browser core dari R2 via app proxy.
- `docs/product-boundary/env-inventory.md` -> Catat env publik opsional untuk FFmpeg browser core.
- `.gitignore` -> Ignore `.open-next`, `.wrangler`, `.dev.vars`, dan generated types; allow `.dev.vars.example`.
- `package.json` / `package-lock.json` -> Tambah OpenNext/Wrangler scripts dan devDependencies.
- `package.json` -> `cf:preview` memakai `wrangler dev --env-file .env.local`.
- `package.json` / `package-lock.json` -> Pin Next range minimal `^16.2.6` agar sesuai peer OpenNext Cloudflare.
- `scripts/deploy/pre-deploy-check.js` -> Guard deploy full Cloudflare, env wajib, forbidden personal env, dan compat audit strict.
- `scripts/cloudflare/worker-compat-audit.js` -> Audit source runtime untuk blocker Workers.
- `scripts/cloudflare/run-opennext-cloudflare-build.js` -> Wrapper build agar Windows memakai temp folder workspace, symlink fallback, patch OpenNext Turbopack path, dan post-build Worker cleanup.
- `scripts/cloudflare/windows-symlink-fallback.cjs` -> Fallback symlink Windows untuk OpenNext ketika symlink biasa ditolak `EPERM`.
- `scripts/cloudflare/patch-opennext-windows-turbopack.js` -> Patch node_modules OpenNext 1.20.x saat build agar tracedFiles Windows dinormalisasi ke POSIX path sebelum `requireChunk` dibuat.
- `scripts/cloudflare/prepare-opennext-worker-output.js` -> Post-build cleanup: hapus FFmpeg browser assets dari Worker output, patch import WASM browser-only, dan guard asset >25 MiB.
- `next.config.mjs` -> Update komentar build target dari Vercel ke Cloudflare/OpenNext.
- `src/middleware.ts` -> Entry request interception Edge-style untuk Cloudflare/OpenNext.
- `src/proxy.ts` -> Dihapus karena OpenNext Cloudflare menolak Node.js proxy/middleware.
- `src/middleware/auth.ts`, `src/middleware/csrf.ts`, `src/middleware/constants.ts` -> Update komentar/import agar Edge-safe.
- `src/lib/security/token.ts` -> CSRF token compare diganti tanpa `Buffer` / `require('crypto')`.
- `src/lib/services/contentService.ts` -> Fix snapshot null fallback agar tidak mengembalikan function `val`.
- `src/lib/cache/clearApplicationCache.ts` -> Hapus filesystem cache deletion dari runtime Cloudflare.
- `src/lib/experience.ts` -> Ganti runtime filesystem read menjadi import JSON statis.
- `src/app/api/admin/upload/route.ts` -> Server FormData upload menjadi Cloudflare-safe passthrough, tanpa `sharp`/FFmpeg runtime.
- `src/app/admin/components/file-upload/hooks/useFFmpeg.ts` -> Browser FFmpeg loader bisa memakai `NEXT_PUBLIC_FFMPEG_BASE_URL`.
- `src/app/api/revalidate/route.test.ts` -> Fix delete env test agar kompatibel dengan generated Cloudflare env typing.
- `src/lib/audioOptimization.ts`, `src/lib/videoOptimization.ts` -> Dihapus dari runtime source app/lib.
- `src/middleware/__tests__/csrf.test.ts` -> Update mock ke import token langsung.
- `AGENTS.md` -> Update keputusan middleware aktif ke `src/middleware.ts` untuk Cloudflare/OpenNext.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Homepage prerender gagal dengan `Functions cannot be passed directly to Client Components`.
  - **Penyebab:** `ContentService` memakai `snapshot?.val?.() ?? snapshot?.val`; saat `snapshot.val()` null, function `val` dipakai sebagai data.
  - **Perbaikan:** `src/lib/services/contentService.ts` sekarang hanya memanggil `snapshot.val()` jika method, tanpa fallback ke method function.
- **Bug 2:** OpenNext Cloudflare menolak Node.js middleware/proxy.
  - **Penyebab:** `src/proxy.ts` berjalan sebagai Node.js middleware/proxy di Next 16.
  - **Perbaikan:** Entry dipindah ke `src/middleware.ts` Edge-style; CSRF token dibuat Edge-safe.
- **Bug 3:** Workers compatibility audit menemukan native runtime blockers.
  - **Penyebab:** Upload FormData dan helper lib masih memanggil `sharp`, FFmpeg/`child_process`, dan filesystem runtime.
  - **Perbaikan:** Upload server menjadi passthrough, helper native dihapus dari runtime app/lib, cache/CV loader tidak membaca filesystem runtime.
- **Bug 4:** `npm run cf:build` gagal di Windows dengan `EPERM` symlink.
  - **Penyebab:** OpenNext membuat symlink paket saat bundling; Windows tanpa symlink privilege menolak symlink biasa.
  - **Perbaikan:** `windows-symlink-fallback.cjs` mengubah symlink direktori menjadi junction/copy fallback khusus build lokal Windows.
- **Bug 5:** `wrangler dev` gagal karena import `ffmpeg-core.wasm` browser-only dan asset FFmpeg >25 MiB.
  - **Penyebab:** FFmpeg WASM browser ikut ter-copy ke server/Worker assets; Cloudflare Workers Assets membatasi file per asset sampai 25 MiB.
  - **Perbaikan:** Post-build cleanup menghapus FFmpeg dari Worker assets dan loader browser memakai `NEXT_PUBLIC_FFMPEG_BASE_URL`; final URL direkomendasikan lewat app proxy `/r2/ffmpeg`.
- **Bug 6:** Local Worker preview 500 `ChunkLoadError: Failed to load chunk ...` di Windows.
  - **Penyebab:** Patch OpenNext Turbopack 1.20.x mencari `.next/server/chunks/` dengan slash POSIX, sedangkan traced files Windows memakai backslash; hasilnya `requireChunk` kosong.
  - **Perbaikan:** Wrapper build mem-patch plugin OpenNext lokal sebelum build agar tracedFiles dinormalisasi.

## Verifikasi
- `npm run cf:compat-audit` -> pass, 0 blockers, 0 review items.
- `npm run cf:doctor` -> pass, Cloudflare env present, D1/R2 configured, live guard confirmed.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run lint` -> pass.
- `npm test` -> pass, 90 files, 685 tests.
- `npm run pre-deploy` -> pass.
- `npm run cf:typegen` -> pass setelah `--include-runtime false`.
- `npm run cf:build` -> pass; `.open-next/worker.js` generated, FFmpeg browser assets dikeluarkan dari Worker assets.
- `wrangler dev --env-file .env.local --port 8787` + `GET /` -> pass, HTTP 200.
- `node --check scripts/cloudflare/prepare-opennext-worker-output.js` -> pass.
- `node --check scripts/cloudflare/patch-opennext-windows-turbopack.js` -> pass.
- `node --check scripts/cloudflare/run-opennext-cloudflare-build.js` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Repo sekarang sudah scaffold Cloudflare Workers/OpenNext, pre-deploy strict hijau, `cf:build` hijau, dan local Worker preview HTTP 200.
- OpenNext masih mencetak warning resmi bahwa Windows tidak sepenuhnya kompatibel dan merekomendasikan WSL, tetapi repo ini sudah punya fallback lokal agar build/preview Windows berjalan.
- Jangan mengembalikan `src/proxy.ts`; itu akan membuat OpenNext gagal lebih awal.
- Untuk admin browser video compression di deployment Cloudflare, upload `public/ffmpeg/*` ke R2 keys `ffmpeg/*` dan isi `NEXT_PUBLIC_FFMPEG_BASE_URL=/r2/ffmpeg`. Tanpa ini, flow upload tetap fallback ke original file saat kompresi browser gagal.
- FormData upload saat ini passthrough. Optimasi media berat untuk produk sebaiknya dibangun ulang sebagai browser direct-to-R2 flow atau media Worker terpisah, bukan native `sharp`/FFmpeg di runtime app.
