# Sprint 74 - UI/UX: Bento Token Konsistensi + Demo Cinematic "Mostar city"

**Status:** 🟢 Completed
**Mulai:** 2026-08-20
**Selesai:** 2026-08-20

## 🎯 Tujuan (Objective)
1. Menghilangkan kesan "AI slop" pada template `landing-bento` dengan token UI bersama (konsistensi tombol/kartu/judul/badge + warna aksen mengikuti tema).
2. Rombak total UI/UX halaman demo `/templates/landing-bento/demo` menjadi halaman cinematic scroll **"Mostar city"** (reproduksi persis spec vanilla).

## 📦 A. Token UI Konsisten (`ui.ts`)
- File baru `src/components/templates/landing-bento/ui.ts` — single source of truth:
  - `BENTO_CARD` + `BENTO_CARD_PAD` (kartu section seragam `p-6 sm:p-8`)
  - `BENTO_SECTION_TITLE` (text-xl) vs `BENTO_FEATURE_TITLE` (text-2xl/3xl) — hierarki 2 tingkat
  - `BENTO_BTN_PRIMARY`/`BENTO_BTN_SECONDARY`/`BENTO_BTN_PRIMARY_SM` (px-5 py-2.5; kecil px-3.5 py-1.5)
  - `BENTO_BADGE`, `BENTO_TAG`, `BENTO_ACCENT_TEXT`, `BENTO_ACCENT_SOFT`
- Semua warna aksen WAJIB `var(--bento-accent)` — hapus hardcode emerald/teal:
  - `BentoHeader` Kontak button → `BENTO_BTN_PRIMARY_SM` (dulu `hover:bg-emerald-600`)
  - `HeroSection` teal→accent (Briefcase ×2), badge/buttons/tiles → token; compact padding `p-6 sm:p-10`→`p-6 sm:p-8`
  - `BentoContact` default variant `'centered'`→`'split'` (selaras settings), tombol px-6 py-3→`BENTO_BTN_*`, p-8→pad, heading 3xl/4xl→`BENTO_FEATURE_TITLE`, badge→token
  - `BentoProjects` modal emerald→accent (year, label narrative), tombol tutup→`BENTO_BTN_PRIMARY`, tag→`BENTO_TAG`
  - `BentoExperience` Terminal teal→accent, SkillIcon fallback emerald→`BENTO_ACCENT_SOFT`, padding→pad, judul→`BENTO_SECTION_TITLE`
  - `BentoImageSequence` tombol autoplay px-4 py-2→`BENTO_BTN_SECONDARY`, badge/heading→token; **canvas 3D kini memakai warna aksen** via `accentRef` (getComputedStyle `--bento-accent`, sisi belakang = aksen alpha 0.55)
  - Editor `BentoStudioEditor`: tombol "Dashboard" px-3 py-1.5→px-4 py-2 (selaras "Lihat Site")

## 🎬 B. Demo Cinematic Scroll "Mostar city"
- File statis vanilla murni di `public/cinematic-mostar/` (`index.html` + `styles.css` + `script.js`), reproduksi verbatim:
  - Font remote `"Ogg Medium"` (woff2), 7 layer PNG scene (sky, back-four, bazaar, splitframe L/R, bridge, frame-two), 3 ikon sight-card
  - `:root` custom properties persis; scroll rig `height: calc(100vh + 3700px)` + `stage` sticky 100vh
  - Engine scroll smoothing (lerp 0.14), parallax pointer, segmentInOut frame2/frame3, blur+brightness+shade `74,181,224`, choreografi title/intro/bridge/splitframe/bazaar/sights
  - Infinite slider 3-set clone (15 kartu) + `transitionend` normalize + `.is-jumping`, tombol `←`/`→` muncul >0.98
  - `prefers-reduced-motion`: smoothing & parallax dilewati, `--mx/--my` = 0
- Route demo `src/app/templates/[templateSlug]/demo/page.tsx`: untuk `landing-bento` render **iframe fullscreen** `fixed inset-0` ke `/cinematic-mostar/index.html` — CSS/JS vanilla 100% terisolasi dari Tailwind/global style Next.js. Template lain (os-desktop) tidak tersentuh.
- **PENTING:** Next.js dev server tidak menyajikan file `public/` baru sampai di-restart (404 cache listing) → dev server di-restart.

## 🧪 Verification Results
- `npx tsc --noEmit`: 0 error
- `npx eslint` area terdampak (bento + studio + demo page): 0 error 0 warning
- `npm test`: **120 files / 873 tests PASS**
- Runtime (via agent-browser):
  - `/cinematic-mostar/index.html` → 200
  - `/templates/landing-bento/demo` → 200, berisi `<iframe src="/cinematic-mostar/index.html">`
  - Snapshot DOM = struktur spec (header/nav, MOSTAR h1, intro-copy+3 tags, panel bridge facts 1566/2005, panel bazaar + note-button)
  - Engine animasi aktif: scroll → `--back-scale` 0.76 → 0.8688; slider ter-setup 15 kartu
- Screenshot diambil (`mostar-top.png`) tapi model AI tidak bisa melihat gambar — verifikasi visual final diserahkan ke user.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Halaman demo bento kini **bukan lagi** preview template sebenarnya (keputusan user). Jika nanti butuh preview bento lagi, tambahkan param `?raw=1` di demo page.
- Backlog lama tetap: adaptasi kontras background gelap; `TemplateDemoCustomizer` dead code.
- Dev server berjalan via `Start-Process` background (log di `%TEMP%\opencode\next-dev.log`).