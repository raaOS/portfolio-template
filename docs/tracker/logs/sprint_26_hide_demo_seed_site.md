# Tracker Log: Sprint 26 - Hide Demo Seed Site From Master Dashboard

**Status:** Completed
**Mulai:** 2026-07-02
**Selesai:** 2026-07-02

## Tujuan (Objective)
- Mencegah `Demo Designer` seed site terlihat seperti client nyata di Master Client Dashboard.
- Membuat dashboard terlihat kosong sampai user membuat client/site baru sendiri.

## Task List
- [x] Filter seed demo site dari list Master Dashboard.
- [x] Pastikan `selectedSite` dan project query tidak otomatis memilih seed demo.
- [x] Ganti label sidebar menjadi `Client/Sites`.
- [x] Verifikasi lint dan typecheck.

## File yang Dimodifikasi (Modified Files)
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Menambahkan `isSeedDemoSite()` untuk menyembunyikan `default-site` / `demo-designer` dari UI Master, tanpa menghapus data seed dari D1.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 26.
- `docs/tracker/logs/sprint_26_hide_demo_seed_site.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** `Demo Designer` muncul di Master Dashboard walau user belum membuat site baru.
  - **Penyebab:** `cf:seed-demo` membuat row D1 `default-site` dengan slug `demo-designer` untuk smoke/release demo, dan UI Master menampilkan semua site mentah dari API.
  - **Perbaikan:** UI Master memfilter seed demo site sehingga hanya client/site nyata yang ditampilkan. Data demo tetap ada untuk smoke test dan public demo.

## Verifikasi
- `npx eslint src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Jangan hapus row `default-site` / `demo-designer` otomatis dari D1; seed itu masih dipakai release smoke.
- Untuk Master Dashboard, treat seed demo sebagai data internal/demo, bukan client buyer.
