# Tracker Log: Sprint 29 - Tenant Dock Dedup

**Status:** Completed
**Mulai:** 2026-07-02
**Selesai:** 2026-07-02

## Tujuan (Objective)
- Menghapus Dock ganda pada public tenant site seperti `/urgent`.
- Memastikan tenant route tidak ikut memakai chrome/dock global non-OS.

## Task List
- [x] Identifikasi sumber render Dock ganda.
- [x] Tambahkan gate tenant route di layout client.
- [x] Verifikasi lint, typecheck, dan render lokal `/urgent`.

## File yang Dimodifikasi (Modified Files)
- `src/components/layout/LayoutClient.tsx` -> Menambahkan reserved top-level route detection dan menganggap dynamic tenant slug sebagai OS/tenant route agar `GlobalDock` tidak dirender bersamaan dengan `OSDock`.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 29.
- `docs/tracker/logs/sprint_29_tenant_dock_dedup.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Public tenant site `/urgent` menampilkan dua Dock di bawah.
  - **Penyebab:** `LayoutClient` hanya menganggap `/` sebagai OS mode. Route dynamic tenant seperti `/urgent` dianggap non-OS route sehingga `GlobalDock` ikut render, sementara desktop tenant juga merender `OSDock`.
  - **Perbaikan:** Dynamic top-level route yang bukan route statis bawaan (`projects`, `contact`, `cv`, `admin`, `api`, dll.) sekarang dianggap tenant route dan tidak dibungkus `NonOSChrome`/`GlobalDock`.

## Verifikasi
- `npx eslint src/components/layout/LayoutClient.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- Playwright fallback `http://localhost:3000/urgent` after boot:
  - `navCountInSlot: 1`
  - `bottomNavCount: 1`
  - `nextOverlay: false`
- `npm run release:audit` -> pass, 59/59 checks.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Jangan mengaktifkan `GlobalDock` pada tenant desktop route. Tenant home route memakai `OSDock`.
- Reserved route list di `LayoutClient.tsx` harus diperbarui jika ada route top-level statis baru yang bukan tenant slug.
