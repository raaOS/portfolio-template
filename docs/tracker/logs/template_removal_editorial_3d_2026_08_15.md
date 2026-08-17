# Tracker Log: Hapus Total Template `landing-editorial` & `3d-spatial`

**Status:** 🟢 Completed
**Mulai:** 2026-08-15
**Selesai:** 2026-08-15

## 🎯 Tujuan (Objective)
- Menghapus total template `landing-editorial` (Sprint 57) dan `3d-spatial` (Sprint 58) dari kode, seed database, test, dan seluruh jejak dokumentasi.
- Katalog template yang tersisa menjadi 2: `os-desktop` dan `landing-bento`.

## 📋 Task List
- [x] Hapus direktori komponen `src/components/templates/landing-editorial/` (6 file).
- [x] Hapus direktori komponen `src/components/templates/experimental-3d/` (2 file).
- [x] Bersihkan `TemplateDispatcher.tsx` dari dynamic import & case `landing-editorial` / `3d-spatial`.
- [x] Bersihkan seed SQL `scripts/cloudflare/migrate-template-schema.sql` + tambah DELETE cleanup untuk DB produksi.
- [x] Rapikan komentar kontrak di `src/types/template.ts`.
- [x] Ganti fixture test yang mereferensikan kedua template dengan id generic.
- [x] Hapus log Sprint 57 & 58, bersihkan `INDEX_TRACKER.md` + dokumen terkait.

## 📂 File yang Dimodifikasi / Dihapus

### Dihapus
- `src/components/templates/landing-editorial/` (seluruh isi: EditorialRenderer.tsx, EditorialRenderer.test.tsx, components/Editorial{Header,Projects,Experience,Contact}.tsx)
- `src/components/templates/experimental-3d/` (seluruh isi: Spatial3DRenderer.tsx, Spatial3DRenderer.test.tsx)
- `docs/tracker/logs/sprint_57_third_template_editorial_retro.md`
- `docs/tracker/logs/sprint_58_experimental_3d_template.md`

### Diubah (Kode)
- `src/components/templates/TemplateDispatcher.tsx` -> Hapus import & case `landing-editorial` / `3d-spatial`.
- `scripts/cloudflare/migrate-template-schema.sql` -> Hapus 2 baris seed; tambah DELETE entitlement/settings + reset `active_template_key` ke `os-desktop`.
- `src/types/template.ts` -> Komentar kontrak hanya menyebut (OS Desktop, Bento).
- `src/lib/services/orderService.test.ts` -> Fixture `landing-editorial` -> `custom-paid-landing`.
- `src/lib/services/templateEntitlementService.test.ts` -> Fixture `landing-editorial` -> `custom-pro-landing`.
- `src/app/api/client/template/route.test.ts` -> Body POST `landing-editorial` -> `unknown-premium-template`.
- `src/components/templates/demo/DemoThemeWrapper.tsx` -> Label font `Playfair (Editorial)` -> `Playfair (Serif)`.

### Diubah (Dokumentasi)
- `docs/tracker/INDEX_TRACKER.md` -> Hapus entri 67 & 68 (Sprint 57/58), renumber 70–87 menjadi 68–85, hapus sebutan `Spatial3DRenderer` di ringkasan code cleanup.
- `docs/architecture/multi_template_contract.md` -> Daftar renderer hanya `os-desktop` & `landing-bento`; diagram 2 cabang.
- `docs/tracker/logs/sprint_49_multi_template_contract_audit.md` -> Sebutan renderer dirapikan.
- `docs/tracker/logs/sprint_50_database_template_registry.md` -> Registry hanya `os-desktop`, `landing-bento`.
- `docs/tracker/logs/sprint_51_os_adapter_no_engine_rewrite.md` -> Placeholder hanya `BentoRenderer.tsx`.
- `docs/tracker/logs/sprint_56_billing_template_entitlement.md` -> Hapus catatan lanjutan Sprint 57.
- `docs/tracker/logs/sprint_59_multi_template_release_acceptance.md` -> "4 template" -> template aktif (`os-desktop`, `landing-bento`).
- `docs/tracker/logs/sprint_61_onboarding_wizard.md` -> Template Selector (OS Desktop, Bento).
- `docs/tracker/logs/code_cleanup_eslint_deadcode_2026_07_21.md` -> Hapus baris `Spatial3DRenderer.tsx`.

## 🧪 Verification Results
- `npx tsc --noEmit`: **0 errors (passed)**
- `npm run lint`: **0 errors** (16 warning pre-existing di file lain, tidak terkait)
- `npm test`: **115 file / 836 tests PASSED** (838 → 836 karena 2 test dari template yang dihapus)

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Katalog template sekarang hanya `os-desktop` (Lite, gratis) dan `landing-bento` (gratis). `landing-editorial` (Rp250.000) dan `3d-spatial` (Rp350.000) sudah di-retire.
- Seed `migrate-template-schema.sql` menyertakan statement DELETE idempotent untuk membersihkan baris `landing-editorial`/`3d-spatial` pada database D1 yang sudah pernah di-seed sebelumnya. Saat men-deploy, pastikan script migrasi dijalankan agar DB produksi ikut bersih.
- Fitur kategori template `'3d'` di Master Admin (dropdown "3D Spatial") dan fixture `custom-editorial` di `templateRegistryService.test.ts` sengaja dipertahankan karena bersifat generic (untuk custom template), bukan jejak template yang dihapus.
- Fitur 3D projects gallery (`view=3d`, `InfiniteCanvasView`) adalah fitur terpisah dan TIDAK terpengaruh.