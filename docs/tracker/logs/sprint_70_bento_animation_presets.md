# Sprint 70 - Bento Animation Presets (AnimatedSection)

**Status:** 🟢 Completed
**Mulai:** 2026-08-19
**Selesai:** 2026-08-19

## 🎯 Tujuan (Objective)
1. Mengimplementasikan preset animasi `BENTO_ANIMATION_PRESETS` (`none`, `fade-up`, `slide-in`, `scale`, `stagger`) sebagai komponen `AnimatedSection`.
2. Menerapkan animasi per-section dari `section.animation` di registry + efek parallax ringan dari `motion.parallax`.
3. Memastikan hydration-safe dan menghormati `prefers-reduced-motion`.

## 📋 Task List
- [x] `AnimatedSection.tsx`: wrapper animasi — IntersectionObserver (threshold 0.15, rootMargin bawah -5%), state `visible` mulai hidden lalu jadi visible saat intersect; `animation==='none'` / reduced-motion → render konten tanpa style animasi; transform preset (fade-up translateY 28px, slide-in translateX -36px, scale 0.94, stagger translateY 16px) dengan cubic-bezier 0.22,1,0.36,1; stagger memberi `transitionDelay` bertahap (80ms/child, max 400ms) via `React.cloneElement`; parallax (opsional) translateY -24px mengikuti scroll pakai rAF.
- [x] `BentoSectionRegistry.tsx`: `BentoSectionRenderer` sekarang menerima `motion` dan membungkus body section dengan `<AnimatedSection animation={section.animation} stagger={motion.stagger} parallax={motion.parallax}>`.
- [x] `BentoRenderer.tsx`: pass `settings.motion` ke registry.
- [x] `src/tests/setup.ts`: + stub `window.matchMedia` global (dipakai `prefersReducedMotion`; mencegah error semua test yang render AnimatedSection).

## 📂 File yang Dimodifikasi / Dibuat
- `src/components/templates/landing-bento/AnimatedSection.tsx` -> BARU
- `src/components/templates/landing-bento/AnimatedSection.test.tsx` -> BARU (5 test: none, reduced-motion, intersection, stagger delay, parallax layer)
- `src/components/templates/landing-bento/BentoSectionRegistry.tsx` -> wrap dengan AnimatedSection
- `src/components/templates/landing-bento/BentoRenderer.tsx` -> pass motion ke registry
- `src/tests/setup.ts` -> stub matchMedia global

## 🧪 Verification Results
- `npx tsc --noEmit`: **0 errors**
- ESLint: **0 error, 0 warning** (1 eslint-disable terarah untuk set-state-in-effect, konsisten pola repo)
- `npm test`: **119 files / 868 tests PASSED** (863 → 868, +5 test animasi)

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Sprint D (Editor `/client/studio`):** fullscreen route di belakang client auth; canvas scrollable memakai `BentoRenderer` dengan settings draft lokal; panel kanan untuk pilih section, ubah variant, toggle visibility, urutkan, dan tombol **Publish** → `PUT /api/client/template-settings`. GET/PUT API sudah siap (Sprint 68).
- Hydration-safe terjamin: SSR render konten tanpa opacity 0 (style animasi hanya dipasang saat `animate` true, dan prefersReducedMotion membaca matchMedia di client). Pada SSR `prefersReducedMotion()` return false sehingga `animate` true → style opacity 0 dirender di SSR → konten muncul setelah mount+intersect. Wajib ada JS; fallback `IntersectionObserver === 'undefined'` → langsung visible.
- Re-render menjaga transform tidak konflik: parallax diterapkan di lapisan terpisah dari animasi entrance.