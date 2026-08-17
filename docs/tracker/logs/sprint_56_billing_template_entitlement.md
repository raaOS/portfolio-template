# Sprint 56 - Billing & Entitlement Template

**Status:** 🟢 Completed
**Mulai:** 2026-07-20
**Selesai:** 2026-07-20

## 🎯 Tujuan (Objective)
1. Menghubungkan alur transaksi pesanan Sprint 47 (`orders`) dengan sistem hak akses `site_template_entitlements`.
2. Mendukung 2 jenis lisensi template:
   - **Template Bawaan Plan:** Otomatis dapat digunakan jika site berada pada Tier Pro (`tier_required = 'pro'`).
   - **Template Premium Add-on:** Pembelian lisensi satuan template tertentu meng-grant entitlement permanen ke `site_id` tenant tanpa bergantung pada masa aktif Plan.
3. Menangani situasi downgrade plan secara graceful.

## 🔒 Context & Product Boundary Constraints (Penting untuk AI)
- **DONT BREAK SPRINT 47 FLOW:** Alur transaksi Telegram Bot 1-click activation, `ORDER_ID`, dan Dual-Check Slug Engine dari Sprint 47 100% utuh.
- **ATOMIC TRANSACTION:** Pemberian entitlement dan perbaruan status order dibungkus secara atomik.

## 📋 Task List (Actionable Checklist)
- [x] **Task 1:** Modifikasi `orderService.ts` untuk menyimpan parameter `template_id` opsional dan auto-grant entitlement.
- [x] **Task 2:** Buat service helper `src/lib/services/templateEntitlementService.ts` (`grantEntitlement`, `revokeEntitlement`, `getSiteEntitlements`).
- [x] **Task 3:** Buat unit test `src/lib/services/templateEntitlementService.test.ts` (3/3 pass).
- [x] **Task 4:** Verifikasi TypeScript typecheck & test suite (`npx tsc --noEmit` & `npm test` 100% pass).

## 📂 File yang Dimodifikasi / Dibuat
- `src/lib/services/templateEntitlementService.ts` -> Service pengelola entitlement template.
- `src/lib/services/templateEntitlementService.test.ts` -> Unit test entitlement service (3/3 pass).
- `src/lib/services/orderService.ts` -> Penambahan `template_id` pada `orders` dan auto-grant entitlement saat `activateOrder`.
- `src/lib/d1-schema.ts` -> Penambahan kolom `template_id TEXT` pada tabel `orders`.

## 🧪 Verification Results
- `npx vitest run src/lib/services/templateEntitlementService.test.ts`: **3/3 passed**
- `npx tsc --noEmit`: **0 errors (passed)**
- `npm test`: **800/800 passed**

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Sprint 56 telah selesai 100%. Pembelian order otomatis terintegrasi dengan entitlement template.
