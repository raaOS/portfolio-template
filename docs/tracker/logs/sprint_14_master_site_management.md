# Tracker Log: Sprint 14 - Master Site Lite/Pro Management

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Menghilangkan kebutuhan edit D1 manual untuk membuat client/site baru.
- Menambahkan kontrol Master untuk upgrade/downgrade plan `lite`/`pro`.
- Menambahkan lifecycle aman `active`/`suspended` tanpa hard delete site.
- Menjaga dashboard client tetap site-aware dan quota-aware.

## Task List
- [x] Perluas endpoint `GET /api/admin/sites` menjadi mendukung `POST` create site.
- [x] Tambah `PUT /api/admin/sites` untuk update name, slug, plan, dan status site.
- [x] Tambah validasi slug, plan, status, auth admin, dan CSRF pada mutasi site.
- [x] Tambah coverage unit test untuk create, invalid slug, update plan/status, dan missing site.
- [x] Tambah UI Master Site di `ClientDashboardPanel`.
- [x] Tambah tombol `Site Baru`, form create/update site, quick action Lite/Pro, dan active/suspended.
- [x] Verifikasi lint, typecheck, route test, Cloudflare build, dan browser smoke.

## File yang Dimodifikasi (Modified Files)
- `src/app/api/admin/sites/route.ts` -> Menambahkan `POST` create site dan `PUT` update site dengan validasi aman.
- `src/app/api/admin/sites/route.test.ts` -> Coverage baru untuk create/update/error path site master.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> UI Master Site untuk create site, edit name/slug, ubah plan, dan suspend/activate.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 14.
- `docs/tracker/logs/sprint_8_client_dashboard_ui.md` -> Memperbarui handoff note yang sebelumnya menyebut endpoint sites masih read-only.
- `docs/tracker/logs/sprint_14_master_site_management.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Upgrade/downgrade Lite/Pro masih harus edit D1 manual.
  - **Penyebab:** Endpoint `/api/admin/sites` hanya read-only.
  - **Perbaikan:** Tambah `PUT /api/admin/sites` untuk update `plan`, `status`, `name`, dan `slug`.

- **Bug 2:** Client/site baru belum bisa dibuat dari panel admin.
  - **Penyebab:** Belum ada endpoint dan UI create site.
  - **Perbaikan:** Tambah `POST /api/admin/sites` dan tombol/form `Site Baru` di Client Dashboard.

- **Bug 3:** Tidak ada lifecycle aman untuk menonaktifkan client.
  - **Penyebab:** Dashboard hanya menampilkan status site tanpa kontrol mutasi.
  - **Perbaikan:** Tambah quick action `Active`/`Suspended`. Status `suspended` memakai guard existing: public site tidak tampil dan mutasi/upload client terkunci.

- **Bug 4:** Implementasi awal UI Master Site memakai sync state di `useEffect`.
  - **Penyebab:** React Compiler/ESLint menolak setState sinkron dalam effect.
  - **Perbaikan:** Form memakai derived `activeSiteDraft` dan update eksplisit saat user memilih site.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/route.test.ts` -> pass, 8 tests.
- `npx eslint src/app/api/admin/sites/route.ts src/app/api/admin/sites/route.test.ts src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run lint` -> pass.
- `npm run cf:build` -> pass. Warning tersisa: OpenNext Windows compatibility, middleware convention deprecation, FFmpeg public URL/R2 note, fetch-cache JSON parse warning non-blocking, dan esbuild duplicate/suspicious warnings.
- Browser smoke via Playwright headless:
  - `/admin/client-dashboard` terbuka dengan cookie admin lokal.
  - Heading `Client Dashboard` visible.
  - Panel `Master Site` visible.
  - Tombol `Site Baru` membuka mode create.
  - Tombol `Buat Site` visible.
  - Page error -> none.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Hard delete site sengaja belum dibuat. Menghapus site perlu workflow cleanup project, media R2, audit rows, dan safety guard agar tidak membuat orphan lintas tenant.
- Reset akses client belum diimplementasikan karena belum ada tabel/flow client account terpisah dari admin global. Jangan membuat reset akses palsu sebelum auth client dirancang.
- Lite/Pro quota tetap bersumber dari env `PLAN_*` dan helper `getPlanQuota`.
- `suspended` sudah efektif karena public adapter dan project/upload quota guard hanya menerima site `active`.
