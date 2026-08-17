# Sprint 50 - Database & Template Registry

**Status:** 🟢 Completed
**Mulai:** 2026-07-20
**Selesai:** 2026-07-20

## 🎯 Tujuan (Objective)
1. Menambahkan DDL D1 schema untuk katalog `portfolio_templates`, `site_template_entitlements`, `site_template_settings`, serta kolom `active_template_key` di tabel `sites`.
2. Menyiapkan **Template Registry** (`src/lib/templates/registry.ts`) sebagai pusat pendaftaran metadata template di kodingan.
3. Menjamin tenant lama otomatis memakai template `'os-desktop'` tanpa perlu migrasi manual.
4. Menyiapkan fallback otomatis: jika template key tidak dikenal atau tenant tidak memiliki akses entitlement, renderer otomatis jatuh ke `'os-desktop'`.

## 🔒 Context & Product Boundary Constraints (Penting untuk AI)
- **MIGRATION SAFE D1:** Ditambahkan `active_template_key TEXT DEFAULT 'os-desktop'` pada `sites`.
- **SINGLE TENANT ISOLATION:** Entitlement dicek per `site_id`.
- **NO DELETION OF LEGACY CODES:** Template default tetap `'os-desktop'`.

## 📋 Task List (Actionable Checklist)
- [x] **Task 1:** Update `src/lib/d1-schema.ts` dengan DDL tabel `portfolio_templates`, `site_template_entitlements`, `site_template_settings`, dan penambahan `active_template_key` pada `sites`.
- [x] **Task 2:** Buat file SQL migrasi production-safe `scripts/cloudflare/migrate-template-schema.sql`.
- [x] **Task 3:** Buat Template Registry `src/lib/templates/registry.ts` (`os-desktop`, `landing-bento`).
- [x] **Task 4:** Buat Service `src/lib/services/templateRegistryService.ts` untuk memeriksa entitlement tenant (`canSiteUseTemplate()`) dan resolve active template dengan fallback aman `'os-desktop'`.
- [x] **Task 5:** Buat unit test di `src/lib/services/templateRegistryService.test.ts` (6/6 pass).

## 📂 File yang Dimodifikasi / Dibuat
- `src/lib/d1-schema.ts` -> Update DDL schema D1.
- `scripts/cloudflare/migrate-template-schema.sql` -> Migration SQL script.
- `src/lib/templates/registry.ts` -> Static template registry data & helper.
- `src/lib/services/templateRegistryService.ts` -> Resolver service & entitlement checker.
- `src/lib/services/templateRegistryService.test.ts` -> Unit test service (6/6 pass).

## 🧪 Verification Results
- `npx vitest run src/lib/services/templateRegistryService.test.ts`: **6/6 passed**
- `npx tsc --noEmit`: **0 errors (passed)**
- `npm test`: **784/784 passed**

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Sprint 50 telah selesai 100%. DDL schema dan TemplateRegistryService sudah beroperasi penuh.
- AI di **Sprint 51** dapat melanjutkan ke perancangan `OSDesktopRenderer.tsx` dan `TemplateDispatcher.tsx` di route `/[siteSlug]/page.tsx` tanpa merusak engine OS desktop.
