# Sprint 54 - CRUD Template di Master Admin

**Status:** 🟢 Completed
**Mulai:** 2026-07-20
**Selesai:** 2026-07-20

## 🎯 Tujuan (Objective)
1. Menambahkan modul pengelolaan katalog template di Master Admin Dashboard (`/admin/templates`).
2. Master Admin dapat:
   - Menambah, mengedit, dan menonaktifkan template di tabel `portfolio_templates`.
   - Mengatur kategori (`os`, `landing`, `3d`), batas tier (`lite`, `pro`), serta harga (IDR).
   - Menilai status akses site dan memberikan **manual entitlement** (`site_template_entitlements`) ke site tertentu untuk keperluan custom order / VIP client.
   - Menonaktifkan jualan template tertentu tanpa merusak site lama yang sedang menggunakannya.

## 🔒 Context & Product Boundary Constraints (Penting untuk AI)
- **AUTHENTICATION GUARD:** Semua endpoint di `/api/admin/templates` divalidasi dengan middleware `validateAdminRequest`.
- **SAFE DEACTIVATION:** Menonaktifkan template (`is_active = 0`) menyembunyikan template dari katalog pilihan baru tanpa merusak site lama.

## 📋 Task List (Actionable Checklist)
- [x] **Task 1:** Buat endpoint API Master `GET /api/admin/templates`, `POST /api/admin/templates`, `PUT /api/admin/templates/[id]`.
- [x] **Task 2:** Buat endpoint API manual entitlement `POST /api/admin/sites/[siteId]/entitlements` dan `DELETE /api/admin/sites/[siteId]/entitlements`.
- [x] **Task 3:** Buat unit test `src/app/api/admin/templates/route.test.ts` (4/4 pass).
- [x] **Task 4:** Buat halaman UI Admin `src/app/admin/templates/page.tsx`.
- [x] **Task 5:** Verifikasi TypeScript typecheck & test suite (`npx tsc --noEmit` & `npm test` 100% pass).

## 📂 File yang Dimodifikasi / Dibuat
- `src/app/api/admin/templates/route.ts` -> CRUD master katalog template.
- `src/app/api/admin/templates/[id]/route.ts` -> Update detail & status template.
- `src/app/api/admin/sites/[siteId]/entitlements/route.ts` -> Endpoint grant/revoke manual entitlement site.
- `src/app/api/admin/templates/route.test.ts` -> Unit test Master Admin Templates API (4/4 pass).
- `src/app/admin/templates/page.tsx` -> Halaman UI pengelolaan template di Master Admin.

## 🧪 Verification Results
- `npx vitest run src/app/api/admin/templates/route.test.ts`: **4/4 passed**
- `npx tsc --noEmit`: **0 errors (passed)**
- `npm test`: **796/796 passed**

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Sprint 54 telah selesai 100%. Master Admin dapat mengelola katalog template dan memberikan manual entitlement.
- AI di **Sprint 55** dapat mengimplementasikan **Katalog Penjualan Publik Template** (`/templates` & `/templates/[templateSlug]/demo`).
