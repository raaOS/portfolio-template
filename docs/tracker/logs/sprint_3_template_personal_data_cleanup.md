# Tracker Log: Sprint 3 - Template Personal Data Cleanup

**Status:** Completed
**Mulai:** 2026-06-27
**Selesai:** 2026-06-27

## Tujuan (Objective)
- Membersihkan data pribadi/legacy yang masih tampil di template jual.
- Mengubah default brand dari identitas portfolio tunggal lama menjadi identitas demo netral `Portfolio OS`.
- Menstandarkan AI optional agar memakai kontrak produk `AI_PROVIDER` + `AI_API_KEY`, bukan nama env provider personal lama.
- Menghapus runtime/import aktif Vercel yang masih tersisa setelah keputusan full Cloudflare.

## Task List
- [x] Ganti default contact, bio, experience, testimonial, sticky note, SEO, CV, chat header, admin label, dan boot wordmark menjadi konten demo netral.
- [x] Ganti namespace local/session storage lama ke `portfolio_os_*` / `portfolio-os-*`.
- [x] Bersihkan prompt AI generator agar tidak menyebut pemilik lama.
- [x] Hapus service Instagram/job extractor legacy yang tidak dipakai fitur produk aktif.
- [x] Hapus `vercel.json` dan dependency `@vercel/speed-insights`; update `package-lock.json`.
- [x] Hapus runtime/header aktif Vercel dari CSP dan client IP detection.
- [x] Jalankan verifikasi typecheck, lint, test, Cloudflare env doctor, dan keyword audit.

## File yang Dimodifikasi (Modified Files)
- `src/data/about.json`, `src/data/experience.json`, `src/data/testimonial.json`, `src/data/sticky-notes.json` -> Data default menjadi demo template, bukan data pribadi.
- `src/lib/seo.ts`, `src/lib/constants.ts`, `src/app/layout.tsx`, `src/app/(site)/projects/page.tsx`, `src/app/(site)/cv/**` -> SEO, title, URL fallback, dan CV default menjadi generic.
- `src/dictionaries/id.ts`, `src/dictionaries/en.ts`, `src/components/layout/SystemNavFrame.tsx`, `src/components/os/core/MenuBar.tsx`, `src/components/os/ui/StartScreen.tsx` -> Brand UI menjadi `Portfolio OS`.
- `src/lib/services/aiChatService.ts`, `src/app/api/ai/**`, `src/lib/gemini.ts`, `scripts/generators/magic-*.js`, `scripts/test-gemini.ts` -> AI memakai persona generic dan kontrak `AI_PROVIDER` + `AI_API_KEY`.
- `src/hooks/useChatSync.ts`, `src/contexts/LanguageContext.tsx`, `src/components/os/utils/positionSync.ts`, `src/components/os/utils/visitorSessionState.ts`, `src/components/os/ui/ExitIntentFeedback.tsx`, `src/components/shared/UnregisterSW.tsx` -> Browser storage namespace tidak lagi membawa nama lama.
- `src/lib/services/instagramExtractService.ts` -> Dihapus karena legacy job-post extractor tidak dipakai fitur produk aktif.
- `src/middleware/utils.ts`, `src/lib/security/request.ts`, `src/lib/security/constants.ts` -> Runtime security tidak lagi memakai domain/header Vercel.
- `package.json`, `package-lock.json`, `vercel.json` -> Menghapus dependency Speed Insights dan konfigurasi Vercel.
- `scripts/README.md`, `scripts/performance/**`, `scripts/deploy/pre-deploy-check.js` -> Wording script diarahkan ke Portfolio OS / Cloudflare.

## Bug & Perbaikan (Bug Tracker)
- **Bug:** Template masih menampilkan nama, contact, domain, experience, testimonial, prompt AI, dan storage key dari portfolio pribadi lama.
  - **Penyebab:** Repo berasal dari portfolio tunggal dan belum semua fallback/default data dibersihkan setelah Sprint 1/2.
  - **Perbaikan:** Semua default content source aktif diganti menjadi demo netral dan namespace browser storage diganti.
- **Bug:** AI optional masih berpotensi membaca env provider lama (`GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`).
  - **Penyebab:** Helper AI lama dibuat sebelum kontrak produk `AI_PROVIDER` + `AI_API_KEY`.
  - **Perbaikan:** Helper dan script AI sekarang memakai `AI_PROVIDER` + `AI_API_KEY`.
- **Bug:** Runtime masih memuat dependency/konfigurasi Vercel walau keputusan produk full Cloudflare.
  - **Penyebab:** Speed Insights, `vercel.json`, CSP Vercel Live, dan client-IP Vercel header masih tersisa.
  - **Perbaikan:** Dependency/config dihapus; CSP dan IP detection diarahkan ke Cloudflare.

## Verifikasi
- `npx tsc --noEmit --pretty false`: pass.
- `npm run lint`: pass.
- `npm test`: 90 test files passed, 685 tests passed.
- `npm run cf:doctor`: pass, D1/R2 configured, live write guard confirmed, secret values not printed.
- Keyword audit source aktif: no matches for personal owner name/domain, Telegram/job-bot/job-hunt terms, old AI env names, or active Vercel runtime/import markers.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Sprint 3 membersihkan identity/data boundary, bukan menyelesaikan seluruh multi-tenant UI/client dashboard.
- Sisa referensi kata `Vercel` yang disengaja ada di dokumen konteks keputusan full Cloudflare dan utility pembersih folder `.vercel`.
- Langkah berikutnya yang logis: Sprint 4 fokus migrasi deployment/runtime Cloudflare Pages/Workers dan route API yang masih berbentuk Next compatibility layer.
