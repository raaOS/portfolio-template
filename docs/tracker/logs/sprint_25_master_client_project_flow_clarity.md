# Tracker Log: Sprint 25 - Master Client/Project Flow Clarity

**Status:** Completed
**Mulai:** 2026-07-02
**Selesai:** 2026-07-02

## Tujuan (Objective)
- Memperjelas perbedaan aksi membuat client/site dan aksi membuat project di Master Dashboard.
- Mengurangi kesan bahwa `Site Baru` dan `Project Baru` berada di level workflow yang sama.

## Task List
- [x] Ganti label `Site Baru` menjadi `Client/Site Baru`.
- [x] Pindahkan tombol project dari header utama ke section `Projects`.
- [x] Ganti label project menjadi `Tambah Project ke Site Ini`.
- [x] Tambahkan helper text bahwa aksi project di Master bersifat opsional untuk bantuan admin.
- [x] Verifikasi lint dan typecheck.

## File yang Dimodifikasi (Modified Files)
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Header utama hanya berisi refresh dan `Client/Site Baru`; tombol project dipindah ke section `Projects` dengan label `Tambah Project ke Site Ini`; empty state memakai `Tambah Project Pertama`.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 25.
- `docs/tracker/logs/sprint_25_master_client_project_flow_clarity.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Tombol `Site Baru` dan `Project Baru` sejajar sehingga membingungkan level workflow.
  - **Penyebab:** Aksi tenant/client dan aksi content/project ditaruh dalam satu toolbar utama.
  - **Perbaikan:** Pisahkan aksi site ke header utama, dan aksi project ke section project milik site terpilih.

## Verifikasi
- `npx eslint src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Lite dan Pro sama-sama boleh self-service membuat project dari dashboard client.
- Tombol project di Master Dashboard adalah jalur bantuan/override admin, bukan flow utama client.
