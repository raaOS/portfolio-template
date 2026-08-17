# Tracker Log: Sprint 15 - Client Access Auth & Self-Service Dashboard

**Status:** Completed
**Mulai:** 2026-07-01
**Selesai:** 2026-07-01

## Tujuan (Objective)
- Memisahkan akses client dari admin global.
- Menambahkan login client site-scoped.
- Membuat dashboard client mandiri di `/client/dashboard`.
- Membuka mutasi project untuk client hanya pada `site_id` miliknya.

## Task List
- [x] Tambah tabel `client_access` di D1 schema.
- [x] Tambah helper auth client dengan cookie `client_token`.
- [x] Tambah endpoint `/api/client/login`, `/api/client/check-auth`, dan `/api/client/logout`.
- [x] Tambah endpoint admin untuk create/reset/suspend client access per site.
- [x] Tambah UI Master Site untuk email, reset password, dan status akses client.
- [x] Tambah halaman `/client/login` dan `/client/dashboard`.
- [x] Update `POST/PUT/DELETE /api/projects` agar admin dan client site-scoped sama-sama bisa mutasi.

## File yang Dimodifikasi (Modified Files)
- `src/lib/d1-schema.ts` -> Menambahkan `client_access`.
- `src/lib/clientAuth.ts` -> Auth, hash password, JWT, dan validasi CSRF client.
- `src/lib/security/constants.ts` -> Menambahkan cookie `CLIENT_TOKEN_COOKIE`.
- `src/lib/admin/siteMutationAuth.ts` -> Helper auth admin-or-client untuk mutasi site.
- `src/app/api/client/login/route.ts` -> Login client + CSRF bootstrap.
- `src/app/api/client/check-auth/route.ts` -> Session client, quota, dan usage.
- `src/app/api/client/logout/route.ts` -> Logout client.
- `src/app/api/admin/sites/[siteId]/client-access/route.ts` -> CRUD akses client per site.
- `src/app/api/admin/sites/[siteId]/client-access/route.test.ts` -> Coverage endpoint akses client.
- `src/app/api/projects/route.ts` -> Project create menerima client token site-scoped.
- `src/app/api/projects/[id]/route.ts` -> Project update/delete menerima client token site-scoped.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx` -> UI client access di Master Site.
- `src/app/client/login/page.tsx` dan `ClientLoginForm.tsx` -> Login client.
- `src/app/client/dashboard/page.tsx` dan `ClientSelfServiceDashboard.tsx` -> Dashboard client self-service.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Client belum punya akses mandiri; semua edit harus lewat admin.
  - **Penyebab:** Repo masih mewarisi admin global dari portfolio tunggal.
  - **Perbaikan:** Tambah `client_access`, auth client, dan dashboard client self-service.

- **Bug 2:** Jika client diberi akses write, risiko bisa menulis site lain.
  - **Penyebab:** Auth lama hanya admin/non-admin, belum site-scoped.
  - **Perbaikan:** `validateSiteMutationRequest()` mengecek `siteId` token client harus sama dengan target request.

- **Bug 3:** Test request tanpa cookie object bisa membuat auth client return 500.
  - **Penyebab:** Helper membaca `request.cookies.get` tanpa optional chaining.
  - **Perbaikan:** `clientAuth.ts` dibuat defensif untuk request test/mocking.

## Verifikasi
- `npx vitest run src/app/api/admin/sites/[siteId]/client-access/route.test.ts` -> pass.
- `npx vitest run src/app/api/projects/route.test.ts src/app/api/projects/[id]/route.test.ts` -> pass.
- `npm run lint` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build` -> pass.
- HTTP smoke: `/client/login` -> 200, `/client/dashboard` -> 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Password client tidak pernah ditampilkan ulang. Field password di Master Site hanya untuk set awal atau reset.
- Client login memakai `siteSlug + email + password`.
- Jangan menyatukan auth client dengan admin global; keduanya punya audience JWT berbeda.

## Verifikasi Ulang Login/Logout Client (2026-07-24)
- Pengujian Chrome headless memakai satu akses client aktif secara read-only.
- Klik ikon Logout mengarahkan ke `/client/login` dan menghapus `client_token`; `csrf_token` tetap ada karena bukan cookie sesi login.
- Akses ulang `/client/dashboard` tanpa `client_token` kembali diarahkan ke `/client/login`.
- Form login dan input password tampil, sedangkan desktop client tidak dirender.
- Kesimpulan: bug alias layout `/portal/login` pada admin tidak terjadi pada client; tidak ada perubahan kode client yang diperlukan.
