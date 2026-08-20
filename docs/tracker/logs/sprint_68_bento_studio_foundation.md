# Sprint 68 - Bento Studio Foundation (Settings Contract & API)

**Status:** 🟢 Completed
**Mulai:** 2026-08-19
**Selesai:** 2026-08-19

## 🎯 Tujuan (Objective)
1. Meletakkan fondasi program **Bento Studio** (kustomisasi per-section ala Framer/WordPress untuk template `landing-bento`, Pro-only).
2. Mengaktifkan tabel `site_template_settings` yang sebelumnya dibuat (Sprint 50) tapi belum pernah dibaca/ditulis.
3. Fix inkonsistensi tier `landing-bento` (lite di seed SQL vs pro di static registry) → dikunci **Pro**.

## 🔒 Keputusan Terkunci (dari diskusi dengan owner)
- Kustomisasi hanya per-section (visibility, order, variant, animasi) — BUKAN free-position canvas.
- Fitur kustomisasi **Pro-only**; template `landing-bento` sendiri dikunci Pro.
- Editor akan berupa route fullscreen `/client/studio` di belakang client auth (Sprint D).
- Save flow: draft lokal → tombol Publish → D1 + revalidate.
- Animasi: preset registry pluggable (baseline CSS+IO di Sprint C; library motion/GSAP bisa ditambah belakangan tanpa menyentuh renderer).

## 📋 Task List
- [x] Fix tier `landing-bento` → `pro` di `migrate-template-schema.sql` (registry.ts sudah `pro`).
- [x] Buat `src/lib/templates/bento/settings.ts`: skema zod, `BENTO_SECTION_TYPES` (5 section), 2 variant per section, 5 preset animasi, `DEFAULT_BENTO_SETTINGS`, dan `normalizeBentoSettings()` (merge defaults ← saved, drop unknown type/variant, dedupe id, sort by order, self-healing).
- [x] Buat `src/lib/services/templateSettingsService.ts`: `getSettings`/`saveSettings` (upsert `ON CONFLICT(site_id, template_id)`) + helper `getBentoSettings`/`saveBentoSettings`.
- [x] Buat API `GET/PUT /api/client/template-settings` (client auth; PUT via `validateClientRequest` = CSRF auto; guard `plan === 'pro'`; zod `bentoSettingsInputSchema`; normalisasi sebelum save; `revalidateSiteContentPaths`; audit log `TEMPLATE_SETTINGS_UPDATED_landing-bento`).
- [x] Wiring loader: `src/app/[siteSlug]/page.tsx` & `src/app/templates/[templateSlug]/demo/page.tsx` sekarang mem-pass `settings` ke `mapD1ToTemplateData` → `data.settings` terisi (belum dipakai renderer — itu Sprint B).

## 📂 File yang Dimodifikasi / Dibuat
- `src/lib/templates/bento/settings.ts` -> BARU: kontrak settings Bento + normalizer.
- `src/lib/templates/bento/settings.test.ts` -> BARU: 8 test normalizer & input schema.
- `src/lib/services/templateSettingsService.ts` -> BARU: D1 IO settings + helper bento.
- `src/lib/services/templateSettingsService.test.ts` -> BARU: 9 test service.
- `src/app/api/client/template-settings/route.ts` -> BARU: endpoint GET/PUT settings.
- `src/app/api/client/template-settings/route.test.ts` -> BARU: 7 test API (401/403/400/200).
- `src/app/[siteSlug]/page.tsx` -> Load + pass template settings ke mapper.
- `src/app/templates/[templateSlug]/demo/page.tsx` -> Load + pass template settings ke mapper.
- `scripts/cloudflare/migrate-template-schema.sql` -> Seed `landing-bento` tier `lite` → `pro`.

## 🧪 Verification Results
- `npx tsc --noEmit`: **0 errors**
- ESLint file baru/diubah: **0 error, 0 warning**
- `npm test`: **118 files / 860 tests PASSED** (836 → 860, +24 test baru)

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Sprint B:** Refactor `BentoRenderer.tsx` menjadi config-driven membaca `normalizeBentoSettings(data.settings?.options)`; render loop section dari config (visibility/order/variant); 2 variant per section (`BENTO_SECTION_VARIANTS`).
- **Sprint C:** Implementasi visual preset animasi dari `BENTO_ANIMATION_PRESETS` via komponen `AnimatedSection` (IntersectionObserver + CSS transform/opacity, hydration-safe, honor `prefers-reduced-motion`).
- **Sprint D:** Editor `/client/studio` fullscreen: canvas scrollable + `SectionShell` edit-mode + panel kanan + tombol Publish → `PUT /api/client/template-settings`.
- **PENTING:** `settings.ts` harus tetap PURE (tanpa import D1/server) karena akan di-import renderer client-side. Helper server (`getBentoSettings`) ada di `templateSettingsService.ts`.
- Untuk DB produksi yang sudah pernah di-seed `landing-bento` sebagai `lite`: jalankan ulang `migrate-template-schema.sql` (INSERT OR IGNORE tidak menimpa row lama — perlu `UPDATE portfolio_templates SET tier_required='pro' WHERE id='landing-bento'` manual jika row sudah ada).
