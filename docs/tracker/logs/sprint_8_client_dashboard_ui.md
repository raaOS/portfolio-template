# Tracker Log: Sprint 8 - Client Dashboard UI

**Status:** Completed
**Mulai:** 2026-06-29
**Selesai:** 2026-06-29

## Tujuan (Objective)
- Membuat UI awal dashboard client self-service di admin desktop.
- Menyediakan site selector, quota plan, list project, create/edit form ringan, status toggle, dan delete action.
- Memastikan semua request CRUD project mengirim `siteId` eksplisit agar tidak jatuh diam-diam ke `default-site`.
- Menjaga scope aman: belum menambahkan upload media site-scoped sampai pipeline R2 per-site disiapkan.

## Task List
- [x] Tambah endpoint admin `GET /api/admin/sites` untuk daftar site, quota, dan usage project.
- [x] Tambah panel `ClientDashboardPanel` di admin desktop.
- [x] Daftarkan app baru `Dashboard Client` di zone admin `Sites & Klien`.
- [x] Tambah route deep-link `/admin/client-dashboard`.
- [x] Tambah query helper `fetchAdminSites` dan prefetch route admin.
- [x] Tambah test endpoint admin sites.
- [x] Verifikasi browser: deep-link dashboard, API auth, table action, create form, dan console.

## File yang Dimodifikasi (Modified Files)
- `src/app/api/admin/sites/route.ts` -> Endpoint admin read-only untuk site summary, quota Lite/Pro, dan project usage.
- `src/app/api/admin/sites/route.test.ts` -> Test auth, shape response, normalisasi plan, dan error database.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> UI dashboard client site-aware dengan quota, project table, create/edit form ringan, status toggle, dan delete.
- `src/app/admin/client-dashboard/page.tsx` -> Route deep-link dashboard client.
- `src/app/admin/components/ClientAdminLayout.tsx` -> Fix deep-link window open agar tidak flakey saat auth runtime re-render.
- `src/app/admin/desktop/registry.ts` -> Menambah zone `Sites & Klien` dan app `Dashboard Client`.
- `src/app/admin/desktop/WindowContentRenderer.tsx` -> Lazy-load panel dashboard client.
- `src/app/admin/lib/adminQueries.ts` -> Query key, fetcher, placeholder, prefetch, dan warm query untuk site admin.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 8.
- `docs/tracker/logs/sprint_8_client_dashboard_ui.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Deep-link `/admin/client-dashboard` kadang tidak membuka window dashboard.
  - **Penyebab:** `deepLinkedRef.current` diset sebelum timeout `openApp`. Jika effect cleanup terjadi karena re-render auth sebelum timeout jalan, timeout dibatalkan tetapi ref sudah terkunci.
  - **Perbaikan:** Ref baru diset di dalam timeout tepat sebelum `openApp`, dan dependency effect dipersempit ke `openApp`.

- **Bug 2:** Site default tidak terlihat selected pada load pertama.
  - **Penyebab:** UI membandingkan item site dengan `selectedSiteId`, sementara default site berasal dari response dan state masih kosong.
  - **Perbaikan:** Tambah `effectiveSiteId` derivatif untuk selected state, query, dan invalidation.

- **Bug 3:** Kolom action edit/delete tersembunyi pada window default.
  - **Penyebab:** Table memakai `min-w-[760px]`, padahal panel tengah di default window lebih sempit setelah ada rail site dan editor.
  - **Perbaikan:** Kurangi tabel menjadi kolom Project/Client/Status/Action dan pindahkan tags ke detail project.

- **Bug 4:** Tombol `Simpan` form create/edit berada terlalu rendah dan bisa tersembunyi.
  - **Penyebab:** Form penuh di-scroll sebagai satu blok sehingga primary action ada di bawah konten panjang.
  - **Perbaikan:** Form diubah menjadi layout flex dengan body scrollable dan footer action tetap terlihat.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/route.test.ts src/app/api/projects/route.test.ts src/app/api/projects/[id]/route.test.ts src/app/api/projects/bulk/route.test.ts src/app/api/health/route.test.ts` -> pass, 46 tests.
- `npx tsc --noEmit --pretty false` -> pass.
- Targeted `npx eslint ...` untuk file Sprint 8 -> pass.
- Browser QA via Playwright direct script:
  - Login API development dengan CSRF -> 200.
  - `/admin/client-dashboard` deep-link membuka window `Client Dashboard`.
  - `/api/admin/sites` dari browser auth -> 200.
  - Tabel project, kolom Action, dan edit buttons visible.
  - Klik `Project Baru` membuka field Title, Client, Year, Cover URL, Description, dan tombol Simpan.
  - Material console issues -> none.
- `npm run cf:build` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Dashboard client saat ini CRUD ringan berbasis URL cover, bukan upload media. Jangan mengaktifkan upload dari form lama sebelum pipeline R2 dipastikan scoped ke `sites/{siteId}/...`.
- Mutasi project dari panel ini selalu mengirim `siteId` via body atau query string.
- Endpoint `/api/admin/sites` tidak lagi read-only sejak Sprint 14; create site, update Lite/Pro, dan suspend/activate sudah tersedia di Master Site.
- Dev server sudah dinyalakan ulang di `http://localhost:3000` setelah verifikasi.
