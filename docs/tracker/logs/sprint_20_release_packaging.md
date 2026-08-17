# Tracker Log: Sprint 20 - Release Packaging & Buyer Onboarding

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Membuat repo template lebih siap dijual/dihandoff ke buyer.
- Menambahkan dokumentasi onboarding buyer, checklist release seller, dan scope Lite/Pro.
- Menambahkan audit paket rilis agar kontrak full Cloudflare, env, docs, dan script penting bisa dicek otomatis.

## Task List
- [x] Tambah README utama repo.
- [x] Tambah buyer onboarding full Cloudflare.
- [x] Tambah seller release checklist.
- [x] Tambah matriks fitur Lite/Pro.
- [x] Tambah `npm run release:audit`.
- [x] Pastikan audit mengecek docs, env contract, script Cloudflare, dan larangan script/env personal/deprecated.
- [x] Verifikasi readiness Cloudflare tetap hijau.

## File yang Dimodifikasi (Modified Files)
- `README.md` -> Entry point repo, quick start, command utama, akses model, dan catatan full Cloudflare.
- `docs/release/BUYER_ONBOARDING.md` -> Panduan setup buyer: Cloudflare D1/R2, env, bootstrap, FFmpeg R2, seed, readiness, smoke, deploy.
- `docs/release/RELEASE_CHECKLIST.md` -> Checklist seller sebelum packaging/deploy/handoff.
- `docs/release/LITE_PRO_SCOPE.md` -> Scope Lite/Pro, tanggung jawab Master Dashboard, downgrade rule, dan feature flag rules.
- `scripts/release/audit-release-package.js` -> Audit paket rilis read-only untuk docs/env/scripts/kontrak Cloudflare dan hygiene secret.
- `package.json` -> Menambahkan script `release:audit`.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan referensi Sprint 20.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Repo belum punya README/onboarding yang jelas untuk buyer.
  - **Penyebab:** Sprint sebelumnya fokus migrasi teknis dan hardening runtime.
  - **Perbaikan:** Tambah README dan buyer onboarding step-by-step.

- **Bug 2:** Checklist rilis masih manual dan tersebar di beberapa sprint log.
  - **Penyebab:** Tidak ada satu dokumen seller release gate.
  - **Perbaikan:** Tambah `docs/release/RELEASE_CHECKLIST.md`.

- **Bug 3:** Kontrak Lite/Pro belum dirangkum sebagai dokumen produk.
  - **Penyebab:** Implementasi quota sudah ada, tapi scope produk belum dikunci di dokumen rilis.
  - **Perbaikan:** Tambah `docs/release/LITE_PRO_SCOPE.md`.

- **Bug 4:** Tidak ada audit otomatis untuk memastikan paket rilis tetap full Cloudflare dan bebas script/env personal lama.
  - **Penyebab:** Verifikasi sebelumnya fokus runtime (`cf:readiness`), bukan packaging.
  - **Perbaikan:** Tambah `npm run release:audit` dengan 53 check.

## Verifikasi
- `npm run release:audit` -> pass; 53/53 checks.
- `node --check scripts/release/audit-release-package.js` -> pass.
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package-json-ok')"` -> pass.
- `npm run cf:readiness` -> pass; 22/22 checks.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- `npm run release:audit` memeriksa packaging contract, bukan live Cloudflare. Tetap jalankan `npm run cf:readiness` untuk readiness live D1/R2.
- Docs release sengaja menegaskan full Cloudflare dan larangan Vercel deployment.
- `.env.local` boleh ada di mesin developer, tetapi audit memastikan file secret lokal tidak tracked oleh git.
- Jika fitur Lite/Pro berubah, update `docs/release/LITE_PRO_SCOPE.md`, `.env.example`, dan audit release bila perlu.
