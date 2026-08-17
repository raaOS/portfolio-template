# Tracker Log: Sprint 21 - Production Deploy Runbook & First Release Candidate

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Menyiapkan runbook deploy production untuk release candidate pertama.
- Menambahkan release notes RC1.
- Menambahkan smoke test otomatis untuk URL production setelah deploy.
- Memastikan jalur `/r2/ffmpeg/*` bisa dites dan dipakai dari dev/prod flow.

## Task List
- [x] Tambah production deploy runbook.
- [x] Tambah RC1 release notes.
- [x] Tambah `npm run release:smoke`.
- [x] Update README, buyer onboarding, dan seller release checklist.
- [x] Update `release:audit` agar menjaga docs/script RC1.
- [x] Fix fallback R2 di Next dev agar `/r2/ffmpeg/*` bisa memakai S3-compatible product R2, bukan binding lokal kosong.
- [x] Verifikasi Cloudflare build dan Worker smoke tetap bersih.

## File yang Dimodifikasi (Modified Files)
- `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md` -> Runbook pre-deploy, deploy, smoke production, manual acceptance, rollback, release record.
- `docs/release/RC1_RELEASE_NOTES.md` -> Release notes RC1, included scope, validation summary, known limitations.
- `scripts/release/smoke-production.js` -> Smoke test production URL dengan endpoint health, public site, client pages, dan FFmpeg R2.
- `package.json` -> Menambahkan script `release:smoke`.
- `README.md` -> Menambahkan link runbook/RC notes dan command `release:smoke`.
- `docs/release/RELEASE_CHECKLIST.md` -> Menambahkan langkah runbook dan production smoke setelah deploy.
- `docs/release/BUYER_ONBOARDING.md` -> Menambahkan production smoke command pasca-deploy.
- `scripts/release/audit-release-package.js` -> Menambahkan required docs/script/phrases untuk runbook dan RC1.
- `src/lib/r2Storage.ts` -> Next dev memakai S3 fallback untuk R2 agar route `/r2/ffmpeg/*` tidak membaca binding lokal kosong.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan referensi Sprint 21.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Belum ada runbook deploy production yang bisa diikuti tanpa membaca sprint log panjang.
  - **Penyebab:** Sprint 19/20 punya readiness dan packaging, tetapi belum ada urutan deploy/rollback/record final.
  - **Perbaikan:** Tambah `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md`.

- **Bug 2:** Belum ada release notes untuk RC1.
  - **Penyebab:** Status kandidat rilis masih tersebar di tracker.
  - **Perbaikan:** Tambah `docs/release/RC1_RELEASE_NOTES.md`.

- **Bug 3:** Belum ada smoke test command untuk URL production.
  - **Penyebab:** Smoke sebelumnya manual atau lokal.
  - **Perbaikan:** Tambah `npm run release:smoke -- --url <production-url> --site-slug <slug>`.

- **Bug 4:** `/r2/ffmpeg/*` di Next dev mengembalikan 404/502 walau object R2 ada.
  - **Penyebab:** Route dev mencoba memakai Cloudflare binding lokal kosong karena `NEXT_RUNTIME` aktif, lalu fallback S3 `webpackIgnore` resolve ke path `.next/dev` yang salah.
  - **Perbaikan:** `r2Storage` sekarang memaksa fallback S3 saat `NODE_ENV !== "production"` dan memakai import normal hanya untuk `NODE_ENV=development`; production Worker tetap memakai R2 binding.

## Verifikasi
- `npm run release:smoke -- --url http://localhost:3000 --allow-localhost --site-slug demo-designer` -> pass; 8/8 checks termasuk `/r2/ffmpeg/ffmpeg-core.js` dan `.wasm`.
- `npm run release:audit` -> pass; 59/59 checks.
- `npm run cf:compat-audit -- --strict` -> pass; 0 blocker, 0 review item.
- `npm run cf:readiness` -> pass; 22/22 checks.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npx vitest run "src/app/api/r2/[...key]/route.test.ts" "src/lib/services/project/projectStorage.test.ts" "src/lib/product/siteStorageUsage.test.ts"` -> pass; 3 files / 23 tests.
- `node --check scripts/release/smoke-production.js` -> pass.
- `node --check scripts/release/audit-release-package.js` -> pass.
- `npm run cf:build *> tmp/sprint21-cf-build.log` -> pass.
- Scan `tmp/sprint21-cf-build.log` untuk warning/error lama -> tidak ada match.
- Worker local smoke via `wrangler dev --env-file .env.local --port 8788`:
  - `/api/health` -> 200.
  - `/` -> 200.
  - `/client/login` -> 200.
  - `/api/public/sites/demo-designer/projects` -> 200.
  - Stderr scan warning/error -> tidak ada match.
- Dev server restart `npm run dev` -> port 3000 aktif, `/api/health` -> 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Production deploy belum dijalankan di Sprint 21. Jalankan hanya jika user eksplisit meminta deploy.
- Gunakan `docs/release/PRODUCTION_DEPLOY_RUNBOOK.md` untuk deploy RC1.
- Setelah deploy production, jalankan:
  ```bash
  npm run release:smoke -- --url https://your-production-domain.example --site-slug demo-designer
  ```
- Jika production tidak memakai demo seed, ganti `--site-slug` dengan slug site nyata.
- `--allow-localhost` hanya untuk mengetes script smoke secara lokal, bukan untuk acceptance production.
