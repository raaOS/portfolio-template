# Sprint 69 - BentoRenderer Config-Driven (Sections & Variants)

**Status:** 🟢 Completed
**Mulai:** 2026-08-19
**Selesai:** 2026-08-19

## 🎯 Tujuan (Objective)
1. Mengubah `BentoRenderer` dari hardcoded section list menjadi **config-driven**: urutan, visibilitas, dan variant section ditentukan oleh settings Bento (dibaca dari `data.settings?.options`).
2. Menyediakan **2 variant per section** sesuai kontrak Sprint 68 (`BENTO_SECTION_VARIANTS`).
3. Menerapkan token theme (accent/font/background) sebagai CSS variables di root renderer.

## 📋 Task List
- [x] `bentoTheme.ts`: resolver token theme → CSS vars (`--bento-accent`, `--bento-accent-rgb`, `--bento-accent-glow`, `--bento-bg`, `--bento-font`) + fontFamily/background inline. Reuse `ACCENT_COLORS`/`FONT_PRESETS`/`BACKGROUND_PRESETS` dari `DemoThemeWrapper`; background default `light` → `#fafafa`.
- [x] `BentoSectionRegistry.tsx`: `BentoSectionRenderer` memetakan `{type, variant}` → komponen section. Cast aman karena `normalizeBentoSettings` menjamin variant valid per type.
- [x] `sections/HeroSection.tsx`: memindahkan bento grid hero dari renderer; variant `default` (4 tile asimetris) & `compact` (single card + 3 metrik inline).
- [x] `BentoImageSequence`: + prop `variant` (`full` = layout lengkap, `minimal` = ringkas tanpa subtitle/kontrol).
- [x] `BentoProjects`: + prop `variant` (`grid` = bento grid asimetris, `list` = baris vertikal); modal case study dipakai bersama.
- [x] `BentoExperience`: + prop `variant` (`timeline` = timeline border-left, `cards` = kartu stacked).
- [x] `BentoContact`: + prop `variant` (`centered` = layout tengah saat ini, `split` = 2 kolom info + aksi); type dirapikan (hapus `any` + unused import).
- [x] `BentoRenderer`: config-driven — baca `normalizeBentoSettings(data.settings?.options)`, filter `visible`, render sesuai urutan, terapkan theme vars di root; section dibungkus `data-testid={bento-section-{type}-{variant}}`.
- [x] `BentoHeader`: subtitle pakai `text-[var(--bento-accent)]` mengikuti theme.

## 📂 File yang Dimodifikasi / Dibuat
- `src/components/templates/landing-bento/bentoTheme.ts` -> BARU
- `src/components/templates/landing-bento/BentoSectionRegistry.tsx` -> BARU
- `src/components/templates/landing-bento/sections/HeroSection.tsx` -> BARU
- `src/components/templates/landing-bento/BentoRenderer.tsx` -> Refactor config-driven
- `src/components/templates/landing-bento/BentoRenderer.test.tsx` -> +3 test (order, hidden section, theme token)
- `src/components/templates/landing-bento/components/BentoImageSequence.tsx` -> +variant minimal
- `src/components/templates/landing-bento/components/BentoProjects.tsx` -> +variant list
- `src/components/templates/landing-bento/components/BentoExperience.tsx` -> +variant cards
- `src/components/templates/landing-bento/components/BentoContact.tsx` -> +variant split + rapikan tipe
- `src/components/templates/landing-bento/components/BentoHeader.tsx` -> accent token

## 🧪 Verification Results
- `npx tsc --noEmit`: **0 errors**
- ESLint file baru/diubah: **0 error, 0 warning**
- `npm test`: **118 files / 863 tests PASSED** (860 → 863, +3 test renderer)

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Sprint C:** Implementasi visual preset animasi `BENTO_ANIMATION_PRESETS` (`none`, `fade-up`, `slide-in`, `scale`, `stagger`; `parallax-lite` untuk motion.parallax) via komponen `AnimatedSection` (IntersectionObserver + CSS transform/opacity, hydration-safe, honor `prefers-reduced-motion`). Registry harus menerima `section.animation` untuk membungkus output.
- **Catatan warna:** settings default `background: 'light'`; preset gelap (midnight/cyber/neon/paper) diterapkan apa adanya tapi belum ada adaptasi kontras teks (semua teks template dirancang untuk latar terang). Adaptasi dark mode penuh = follow-up.
- **Catatan font:** `font-sans` class tetap dipasang di root tapi inline `fontFamily` menang; token `--bento-font` disediakan untuk konsumsi lanjutan.
- **Sprint D:** Editor `/client/studio` fullscreen akan membaca/menulis settings via `PUT /api/client/template-settings`; preview memakai `data.settings.options` di halaman tenant (sudah di-wire di Sprint 68).