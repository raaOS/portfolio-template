# Tracker Log: Sprint 18 - Plan & Billing Hardening

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Mengunci downgrade plan agar tidak memotong tenant yang sudah melebihi quota Lite.
- Menambahkan metadata subscription/billing ringan untuk Master Site.
- Menampilkan billing status di UI Master.

## Task List
- [x] Tambah tabel `site_subscriptions` di D1 schema.
- [x] Tambah billing summary di `GET /api/admin/sites`.
- [x] Tambah update `billingStatus` dan `currentPeriodEnd` di `PUT /api/admin/sites`.
- [x] Upsert subscription metadata saat plan/billing berubah.
- [x] Blok downgrade ke Lite bila project/storage usage sudah melewati quota Lite.
- [x] Tambah field billing di Master Site UI.
- [x] Tambah coverage unit test downgrade guard.

## File yang Dimodifikasi (Modified Files)
- `src/lib/d1-schema.ts` -> Menambahkan `site_subscriptions`.
- `src/app/api/admin/sites/route.ts` -> Billing summary, upsert subscription, dan guard downgrade quota.
- `src/app/api/admin/sites/route.test.ts` -> Coverage billing summary dan downgrade quota violation.
- `src/app/admin/lib/adminQueries.ts` -> Tipe `AdminSiteSummary.billing` dan `clientAccess`.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> Field `Billing` dan `Period end`.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Downgrade Pro -> Lite bisa dilakukan meski usage sudah melebihi limit Lite.
  - **Penyebab:** Sprint 14 hanya update field `plan`.
  - **Perbaikan:** `PUT /api/admin/sites` mengecek project count dan storage usage sebelum menerima target `lite`.

- **Bug 2:** Master belum punya tempat menyimpan status billing/subscription.
  - **Penyebab:** Belum ada tabel subscription metadata.
  - **Perbaikan:** Tambah `site_subscriptions` dan field billing ringan di API/UI.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/route.test.ts` -> pass, 10 tests.
- Regression suite API terdampak -> pass, 59 tests.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build` -> pass.
- HTTP smoke: `/client/login` -> 200, `/client/dashboard` -> 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Billing ini metadata internal, belum integrasi payment provider.
- Downgrade guard saat ini mengecek project count dan storage. Media-per-project detail tetap ditegakkan pada create/update project.
- Jika nanti integrasi pembayaran dibuat, tetap jaga full Cloudflare dan jangan mengasumsikan Vercel.
