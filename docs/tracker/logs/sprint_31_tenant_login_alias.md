# Tracker Log: Sprint 31 - Tenant Login Alias

**Status:** Completed
**Mulai:** 2026-07-05
**Selesai:** 2026-07-05

## Tujuan (Objective)
- Membuat link login pembeli lebih natural per site, misalnya `/urgent/login`, tanpa menduplikasi sistem auth client pusat.

## Task List
- [x] Tambahkan route alias `/[siteSlug]/login`.
- [x] Redirect alias tenant ke `/client/login?site=<siteSlug>`.
- [x] Pastikan field `Site slug` di login client otomatis terisi dari query `site`.
- [x] Verifikasi lint, TypeScript, dan browser flow lokal.

## File yang Dimodifikasi (Modified Files)
- `src/app/[siteSlug]/login/page.tsx` -> Route alias tenant login yang redirect ke login client pusat.
- `src/app/client/login/ClientLoginForm.tsx` -> Membaca query `site` via `useSearchParams` agar slug otomatis terisi setelah redirect.

## Bug & Perbaikan (Bug Tracker)
- **Bug/UX:** Pembeli harus diberi link `/client/login?site=urgent`, kurang natural dibanding `/urgent/login`.
  - **Penyebab:** Belum ada alias login per tenant.
  - **Perbaikan:** Tambah route `/[siteSlug]/login` yang mengarah ke `/client/login?site=<slug>`.
- **Bug:** Setelah redirect client-side, field `Site slug` belum selalu terisi.
  - **Penyebab:** Form login membaca `window.location.search` di dalam bootstrap async.
  - **Perbaikan:** Gunakan `useSearchParams` sehingga query `site` tersinkron dengan route aktif.

## Verifikasi
- `npx eslint 'src/app/client/login/ClientLoginForm.tsx' 'src/app/[siteSlug]/login/page.tsx'`: pass.
- `npx tsc --noEmit --pretty false`: pass.
- Playwright: `http://localhost:3000/urgent/login` berakhir di `http://localhost:3000/client/login?site=urgent` dan input `Site slug` bernilai `urgent`.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Auth client tetap satu sistem pusat di `/client/login` dan `/client/dashboard`; `/[siteSlug]/login` hanya alias UX.
- Untuk production, format link pembeli bisa memakai `https://domain-kamu.com/<siteSlug>/login`.
