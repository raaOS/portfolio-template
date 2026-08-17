# Sprint 53 - Template Picker Client

**Status:** 🟢 Completed
**Mulai:** 2026-07-20
**Selesai:** 2026-07-20

## 🎯 Tujuan (Objective)
1. Antarmuka Client Dashboard (`/client/dashboard`) bagi pemilik site untuk melihat katalog template yang tersedia, memilih template aktif, dan menguji preview sebelum disimpan.
2. Fitur **Sandboxed Live Preview**: Client dapat melihat tampilan website mereka dalam template baru secara instan di dalam iframe modal tanpa mengubah tampilan publik asli di D1.
3. Proteksi backend: Mencegah client mengaktifkan template yang membutuhkan tier Pro jika site mereka masih Lite, atau template satuan yang belum di-entitle.

## 🔒 Context & Product Boundary Constraints (Penting untuk AI)
- **NO IMMEDIATE PUBLIC MUTATION:** Live preview dilakukan via query parameter transient `?preview_template=key`.
- **ENTITLEMENT GUARD:** API `POST /api/client/template` memvalidasi entitlement `canSiteUseTemplate` dan mengembalikan HTTP 403 jika tidak berhak.

## 📋 Task List (Actionable Checklist)
- [x] **Task 1:** Buat API Client Template `src/app/api/client/template/route.ts` (`GET` catalog & `POST` activate).
- [x] **Task 2:** Buat unit test `src/app/api/client/template/route.test.ts` (5/5 pass).
- [x] **Task 3:** Buat UI `TemplatePickerModal.tsx` di Client Dashboard.
- [x] **Task 4:** Buat UI `TemplatePreviewModal.tsx` (sandboxed iframe preview).
- [x] **Task 5:** Verifikasi TypeScript typecheck & test suite (`npx tsc --noEmit` & `npm test` 100% pass).

## 📂 File yang Dimodifikasi / Dibuat
- `src/app/api/client/template/route.ts` -> Client API endpoint untuk GET katalog template & POST aktifkan template.
- `src/app/api/client/template/route.test.ts` -> Unit test API Client Template (5/5 pass).
- `src/app/client/dashboard/components/TemplatePickerModal.tsx` -> Modal pemilih template di Client Dashboard.
- `src/app/client/dashboard/components/TemplatePreviewModal.tsx` -> Modal sandboxed iframe live preview.

## 🧪 Verification Results
- `npx vitest run src/app/api/client/template/route.test.ts`: **5/5 passed**
- `npx tsc --noEmit`: **0 errors (passed)**
- `npm test`: **792/792 passed**

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Sprint 53 telah selesai 100%. Client Dashboard memiliki fitur pemilih template dan sandboxed live preview.
- AI di **Sprint 54** dapat mengimplementasikan **CRUD Template di Master Admin** (`/admin/templates`).
