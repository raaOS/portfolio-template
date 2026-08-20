# Sprint 71 - Bento Studio Editor (/client/studio)

**Status:** 🟢 Completed
**Mulai:** 2026-08-19
**Selesai:** 2026-08-19

## 🎯 Tujuan (Objective)
1. Membangun editor fullscreen **Bento Studio** di `/client/studio` di belakang client auth (Pro-only) dengan preview live config-driven.
2. Alur sesuai keputusan produk: **draft lokal** (state client) → tombol **Publish** → `PUT /api/client/template-settings` → D1 + revalidate.
3. Entry point di Client Dashboard untuk paket Pro.

## 📋 Task List
- [x] `src/app/client/studio/page.tsx` (server): baca `client_token` via `cookies()` + `verifyClientToken` → redirect `/client/login` jika invalid; `getSiteBySlug` ambil site & plan; `loadHomepageData(site.id)` → `resolveActiveTemplate` → `getSettings` → `mapD1ToTemplateData`; render `<BentoStudioEditor>`.
- [x] `src/app/client/studio/BentoStudioEditor.tsx` (client): 
  - Draft state `BentoTemplateSettings` (inisialisasi dari `templateData.settings?.options` via `normalizeBentoSettings`).
  - Preview live = `BentoRenderer` dengan `settings.options = draft` (canvas scrollable kiri).
  - Panel kanan: Theme (accent swatch 6 warna, font 4 preset, background light+4 preset), Motion (stagger, parallax), Sections (naik/turun, visibility, variant select, animation select).
  - `useCsrfToken` + `PUT /api/client/template-settings` `{ settings: draft }`; status saved/error; setelah sukses draft di-normalisasi ulang dari response.
  - Non-Pro → layar terkunci dengan CTA upgrade/kembali.
- [x] Dashboard entry: card **"Bento Studio"** (tier Pro, ikon `LayoutGrid`) di `moduleCards`; `route: '/client/studio'` → onClick navigasi fullscreen (bukan window); `enabled` hanya jika `site.plan === 'pro'`; `openModuleWindow` di-cast ke `ClientModuleId` untuk card non-route.

## 📂 File yang Dimodifikasi / Dibuat
- `src/app/client/studio/page.tsx` -> BARU (server page)
- `src/app/client/studio/BentoStudioEditor.tsx` -> BARU (editor client)
- `src/app/client/studio/BentoStudioEditor.test.tsx` -> BARU (5 test: locked lite, render panel+preview, toggle visibility, publish PUT+CSRF, error publish)
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` -> + import LayoutGrid, card Bento Studio + route handling

## 🧪 Verification Results
- `npx tsc --noEmit`: **0 errors**
- ESLint: **0 error, 0 warning**
- `npm test`: **120 files / 873 tests PASSED** (868 → 873, +5 test editor)

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Sprint E (verifikasi akhir program):** `npm run build` (pastikan server page dengan `cookies()` + `redirect()` compile di production), optional `npm run test:e2e`, audit dokumen + tracker wrap-up.
- **Alur lengkap sekarang:** Client Pro login → Dashboard → Bento Studio → ubah draft (preview live) → Publish → PUT API (Pro guard + CSRF + normalize + upsert D1 + `revalidateSiteContentPaths(['/'])` + audit) → pengunjung tenant lihat hasil.
- **Catatan SEO/hydration:** preview editor memakai `BentoRenderer` di halaman yang butuh JS (client page); halaman tenant publik tetap server-rendered dengan settings tersimpan.
- **Menambahkan preset baru:** cukup perbarui `BENTO_ANIMATION_PRESETS` / `BENTO_SECTION_VARIANTS` di `src/lib/templates/bento/settings.ts` — panel editor dan renderer otomatis mengikuti (config-driven).
- **Link dashboard:** studio card `enabled` gate `site.plan === 'pro'`; `site.plan` berasal dari `check-auth` response (`site.plan`).