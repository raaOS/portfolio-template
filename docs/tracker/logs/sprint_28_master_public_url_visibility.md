# Tracker Log: Sprint 28 - Master Public URL Visibility

**Status:** Completed
**Mulai:** 2026-07-02
**Selesai:** 2026-07-02

## Tujuan (Objective)
- Membuat Master Dashboard menampilkan link public site yang baru dibuat agar user tidak perlu menebak URL dari slug.
- Membedakan link public site dari tombol preview yang tetap menunggu project published.

## Task List
- [x] Tambah Public URL di form Master Site.
- [x] Tambah tombol copy URL.
- [x] Tambah tombol open site setelah site tersimpan.
- [x] Verifikasi lint, typecheck, health, dan route site lokal.

## File yang Dimodifikasi (Modified Files)
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Menambahkan Public URL, copy action, dan open link di panel Master Site.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 28.
- `docs/tracker/logs/sprint_28_master_public_url_visibility.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Setelah membuat site baru, user tidak tahu URL public site karena tombol `Preview site` disembunyikan sampai ada project published.
  - **Penyebab:** UI hanya menampilkan slug dan preview state, tidak menampilkan URL public eksplisit.
  - **Perbaikan:** Form Master Site sekarang menampilkan Public URL berdasarkan origin saat ini + slug, dengan tombol copy dan open.

## Verifikasi
- `npx eslint src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run release:audit` -> pass, 59/59 checks.
- `http://localhost:3000/api/health` -> 200.
- `http://localhost:3000/urgent` -> 200 OK.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- `Preview site` tetap sengaja dikunci sampai ada minimal 1 project published.
- `Public URL` adalah link site berdasarkan slug dan boleh terlihat segera setelah slug tersedia.
