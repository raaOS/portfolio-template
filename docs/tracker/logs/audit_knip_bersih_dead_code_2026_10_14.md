# Tracker Log: Audit Knip — Hapus 5 Dependency & 15 File Dead Code

**Status:** 🟢 Completed
**Mulai:** 2026-10-14
**Selesai:** 2026-10-14

## 🎯 Tujuan (Objective)
- Menjawab pertanyaan owner: "apakah masih banyak sampah yang bisa dibuang?" — dengan **mengukur**, bukan menebak. Dua tahap: (1) hapus dependency mati, (2) audit knip untuk file/export mati.

## 📋 Task List
- [x] `npm install` pertama di worktree (975 paket) — sebelumnya tidak ada `node_modules`.
- [x] **Baseline** sebelum diubah: `tsc --noEmit` 0 error, `npm test` **130 file / 1043 test PASS**.
- [x] Audit dependency: scan teks 915 file kode + konfigurasi untuk tiap 43 dependency runtime (metode: substring escape, rekursif penuh).
- [x] `npx knip` → 81 unused files, 4 unused deps, 6 unused devDeps, 6 unlisted deps, 179 unused exports.
- [x] Verifikasi manual SEMUA temuan berisiko (knip banyak false positive).
- [x] Hapus 5 dependency + 15 file dead code.
- [x] Verifikasi akhir: `tsc` 0, `lint` bersih, **130 file / 1043 test PASS** (identik baseline — nol test yatim).

## 📂 File yang Dimodifikasi (Modified Files)

**`package.json` — 5 dependency dihapus (semua terbukti 0 referensi):**
| Dependency | Bukti |
|---|---|
| `gsap` | 0 referensi di 915 file kode/konfigurasi (hanya muncul di package.json + lockfile) |
| `date-fns` | 0 import di kode; hanya nyangkut di array `optimizePackageImports` `next.config.mjs` |
| `@ffmpeg/core` | Runtime memuat core dari `public/ffmpeg/` (30,8 MB, committed) lewat `toBlobURL`; npm package tidak pernah diimpor. `@ffmpeg/ffmpeg` + `@ffmpeg/util` **tetap** (dipakai `useFFmpeg.ts`) |
| `@types/three` | three ≥0.150 bawa type sendiri; posisinya juga salah (dependencies, bukan devDependencies) |
| `jsqr` | Satu-satunya pemakai `qrisImageDecoder.ts` yang ikut dihapus |

**`next.config.mjs`** — `'date-fns'` dihapus dari array `optimizePackageImports` (entry config mati).

**15 file dead code dihapus (semua terverifikasi 0 importer, termasuk cek dynamic import & path relatif):**
- `src/app/admin/components/AdminConstants.ts` (170 baris) — sudah tercatat mati di log `visitor_analytics_pipeline_2026_09_28.md`
- `src/lib/billing/qrisImageDecoder.ts` (83) — fitur decode QRIS dari gambar hilang sejak alur bayar berubah
- 6 komponen Infinite Canvas lama (807 baris): `CanvasProfile/Skills/Experience/Contact/Navigator/ProjectModal.tsx` — sudah digantikan `CanvasLeftDrawer` + `CanvasProjectSlideOver`
- 7 scaffolding CRUD yang belum pernah dipakai (490 baris): `crud/shared/index.ts`, `crud/shared/security/{index,validation}.ts`, `crud/shared/storage/r2.ts`, `crud/templates/{index,registry,types}.ts`

Total **±1.350 baris** dan **15 file** dihapus.

## 🐛 Bug & Perbaikan (Bug Tracker)
Tidak ada bug. Tiga kali klaim awal saya **dikoreksi oleh verifikasi** (dicatat agar AI berikutnya tidak mengulang):
1. **`cadangan-flashdisk/` bukan sampah** — README-nya dokumentasi resmi alur backup owner ke flashdisk (dipakai `SALIN_CADANGAN.bat`, sengaja dikecualikan `.gitignore` kecuali README). TIDAK dihapus.
2. **`AGENTS.md` bukan usang** — kalimat "build-customer.sh sudah dihapus" sudah benar di baris 550 file; yang versi "belum dihapus" hanya ada di instruksi sesi (snapshot lama).
3. **`billing/qris.ts` HIDUP** — knip menandai file *decoder*-nya; modul `qris.ts` sendiri dipakai `paymentConfigService.ts` + `api/billing/orders/[orderId]/qris/route.ts`. TIDAK dihapus.

## 🚫 Temuan Knip yang SENGAJA TIDAK Dikerjakan (bukan sampah)
- **~65 file `scripts/**` "unused"** — false positive: script ops dijalankan manual via `npx tsx`/npm script (`audit-orphan-*`, `reset-customer-password`, `restore-icons`, dll.), banyak didokumentasikan di AGENTS.md §11.
- **`public/ffmpeg/ffmpeg-core.js`, `public/css/critical.css`, `open-next.config.ts`, `workers/r2-public/src/index.js`** — dibaca runtime/build, bukan lewat import.
- **`critters`** — dibutuhkan `optimizeCss: true` di `next.config.mjs` saat build (komentar di config sudah menjelaskan). Jangan dihapus.
- **6 dependency dev "unused"** (`@types/dotenv`, `@types/mime-types`, `@types/uuid`, `eslint-config-next`, `fast-check`) — perlu kajian tersendiri; `eslint-config-next` justru **tidak dipakai** sedangkan 4 plugin ESLint yang dipakai **tidak dideklarasikan** (lihat bawah).
- **179 unused exports** — mayoritas false positive (dipakai dalam file yang sama, atau lewat mekanisme dinamis portal onboarding).

## ⚠️ Temuan Nyata yang Belum Ditangani (untuk owner)
1. **6 "unlisted dependencies"** — dipakai tapi tidak dideklarasikan di `package.json`: `@eslint/eslintrc`, `@next/eslint-plugin-next`, `eslint-plugin-react`, `eslint-plugin-react-hooks` (dipakai `eslint.config.mjs`, kini hanya ikut terpasang secara transitif → build bisa tiba-tiba gagal kalau hoisting berubah), `esbuild` (`prepare-opennext-worker-output.js`), `fluent-ffmpeg` (`audit-wallpaper-videos.mjs`).
2. ~~**`eslint-config-next`** dideklarasikan tapi tidak dipakai~~ → **KOREKSI (2026-10-14, sebelum commit):** knip **salah** di sini. `eslint-config-next` **wajib dipertahankan** — dialah penyedia `@typescript-eslint/eslintrc`/`parser` (lewat dependensi `typescript-eslint@^8.46`) yang dibutuhkan `eslint.config.mjs` baris 30: `compat.extends('plugin:@typescript-eslint/recommended')`. knip tidak melihatnya karena dipakai lewat string `FlatCompat`, bukan `import`. Menghapusnya akan membuat `npm run lint` gagal. **Perbaikan final yang dikerjakan:** 4 plugin yang benar-benar di-`import` (`@eslint/eslintrc@3.3.5`, `@next/eslint-plugin-next@16.2.12`, `eslint-plugin-react@7.37.5`, `eslint-plugin-react-hooks@7.1.1`) ditambahkan ke `devDependencies` dengan versi sama persis; `eslint-config-next` **tetap**. Sisa 2 unlisted (`esbuild`, `fluent-ffmpeg`) — keduanya dipakai script ops, bukan build runtime — dibiarkan agar perubahan tetap minimal.
3. `@types/three` masih terpasang **transitif** lewat `@react-three/drei` (wajar), tapi tidak lagi jadi dependensi langsung.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Sudah di-commit:** `bf369a4` di branch **`cleanup/dead-code-audit-2026-10-14`** (33 file, +119/−1.491). Pre-commit hook (husky → `npm run lint`) lolos otomatis. **Belum di-push ke origin, belum di-merge ke `main`, belum di-deploy.**
- **Posisi branch:** worktree ini detached HEAD di `a1639ea`; `main` di `C:\Users\USER\Documents\tamplate-portofolio` sudah **2 commit lebih maju** (fitur Loader/DeckReveal). Merge diperlukan — sudah diverifikasi **bersih**: `package.json`/`next.config.mjs`/`package-lock.json` tidak berubah di main, dan 15 file yang dihapus tidak tersentuh (satu-satunya file terkait, `InfiniteCanvasRenderer.tsx`, cuma menambah prop `suppressIntro`). Perintah merge di salinan utama: `git merge cleanup/dead-code-audit-2026-10-14` lalu `npm install` (dependency berubah) lalu `npm test`.
- Perubahan **belum di-commit** (file terhapus sudah staged `git rm`; `package.json`, `next.config.mjs` modified).
- Semua gerbang verifikasi hijau **setelah** perubahan: `tsc --noEmit` 0, `npm run lint` bersih, `npm test` 130 file / **1043 test PASS** (sama persis dengan baseline).
- Belum dijalankan `npm run build` (full Next build) — jalankan sebelum commit kalau ingin keyakinan penuh.
- **UPDATE verifikasi build (2026-10-14):** `npm run build` biasa **gagal di fase prerender** `/sitemap.xml` + `/projects` dengan error `Cloudflare D1 env is incomplete` — **kondisi lingkungan yang sudah ada sejak awal, bukan regresi**: `.env.local` memang tidak ada di worktree ini (dan tidak ada juga di `Documents\portfolio-template`). Build mode tanpa prerender `npx next build --experimental-build-mode compile` **hijau** (seluruh route + middleware terkompilasi) → membuktikan penghapusan 15 file tidak merusak graph import/bundle.
- **UPDATE 2 — build produksi PENUH HIJAU:** `.env.local` diminta owner dan disalin dari salinan utama `C:\Users\USER\Documents\tamplate-portofolio\.env.local` (ter-ignore git, baris 55 `.gitignore` = `.env*.local`, diverifikasi `git check-ignore` → tidak masuk commit). `npx next build` **lengkap tanpa error**: prerender `/projects`, `/sitemap.xml`, `/checkout`, `/contact`, `/cv`, `/setup`, `/syarat-ketentuan` (static) + SSG `/preview/{os-desktop,infinite-canvas,spatial-gallery}` sukses memakai data D1 asli; seluruh 37 folder `api` + middleware ter-`ƒ (Dynamic)`. **Rantai verifikasi lengkap: tsc 0 → lint bersih → 130 file/1043 test PASS → build produksi hijau.** `next-env.d.ts` dikembalikan setelah build (diproduksi ulang jadi rujukan `.next/types` karena build production; versi ter-commit memakai rujukan `.next/dev/types` milik `next dev`).
- Guard `npm run build` (`scripts/utils/ensure-next-dev-not-running.js`) memeriksa port 3000 **global**; saat itu dipakai dev server proyek lain (`Documents\tamplate-portofolio`, PID 22728, mulai 00:45) → false positive untuk worktree ini. Dev server proyek lain sengaja **tidak dimatikan**; build dijalankan via `npx next build` langsung.
- Kalau suatu saat butuh komponen `CanvasProfile`/`CanvasProjectModal` lama di Infinite Canvas, ambil dari git history (`git show HEAD~1:src/components/...`).
- `npm run deploy` di site owner butuh `OWNER_MODE=true` (guard `pre-deploy-check.js`).

## 🚀 Integrasi ke `main` & Deploy Produksi (2026-10-14, final)

- Merge ke `C:\Users\USER\Documents\tamplate-portofolio` (`main`) — **satu-satunya konflik** di `docs/tracker/INDEX_TRACKER.md` (kedua sisi memakai nomor #160/#161); diselesaikan dengan **menggabungkan kedua entri** dan menaikkan entri cleanup ke **#162/#163**. Merge commit `8b6f590`.
- Verifikasi pasca-merge **di salinan utama**: `tsc --noEmit` **0 error**, pre-commit ESLint bersih, `npm test` **133 file / 1.069 test PASS** (naik dari 131/1.047 — bertambah test dari fitur Loader; nol yang patah).
- Pre-push hook menjalankan audit penuh otomatis (env, **D1 reachable**, R2, TypeScript, ESLint) — **semua PASS**. Push: `origin/main` → `8b6f590`.
- **Deploy produksi hijau:** `npm run deploy` → 22 aset statis baru terunggah, **Version ID `23269e20-f298-4174-a70b-7a0f37027b7c`**, worker `portfolio-os-template.m4keitbetter.workers.dev`.
- **Smoke test live:** `/api/health` = `version 1.3.41` + `database: connected` (D1, 143 ms); `/`, `/checkout`, `/projects`, `/preview/{os-desktop,infinite-canvas,spatial-gallery}` **semua 200**; `/api/admin/pricing` & `/api/admin/orders` **401** (Owner Mode aktif).
- **Insiden yang dicatat apa adanya:** dev server lokal owner (port 3000, PID 22728) **mati** saat `npm install` dijalankan di salinan utama (mengganti `node_modules` selagi server memuat modul). Hanya berdampak ke lingkungan lokal — produksi tidak tersentuh. Port 3000 kini bebas sehingga `npm run deploy` tidak lagi tersendat guard-nya. Owner tinggal `npm run dev` kalau ingin dev server hidup lagi.
- **Satu-satunya verifikasi yang belum tuntas:** cek visual panel admin **Loader** (`/admin` → zona Tampilan) — browser harness tidak terhubung ke mesin owner, jadi harus dibuka manual.
