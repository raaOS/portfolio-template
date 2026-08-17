# Sprint 61 - Onboarding Wizard "3-Minute Launch"

**Status:** 🟢 Completed
**Mulai:** 2026-07-22
**Selesai:** 2026-07-22

## Tujuan

1. Menyediakan Onboarding Wizard 4-step interaktif untuk pembeli baru di Client Dashboard (`/client/dashboard`).
2. Memungkinkan pembeli baru mengisi data profil, menambah project pertama dengan integrasi AI Magic Complete, dan memilih template dalam waktu kurang dari 3 menit.
3. Menghubungkan hasil wizard secara langsung ke D1 SQL site-scoped data sehingga site publik (`/[siteSlug]`) langsung siap rilis.

## Implementasi Terencana

- Buat komponen `ClientOnboardingWizard.tsx` dengan alur:
  - Step 1: Profile & Social Links
  - Step 2: Project Quick Add (dengan Magic AI Complete)
  - Step 3: Template Selector (OS Desktop, Bento) & Theme Accent
  - Step 4: Site Launch Confirmation & Preview Link
- Integrasikan `ClientOnboardingWizard` di `ClientSelfServiceDashboard.tsx` dengan pemicu otomatis jika site belum memiliki project (`usage.projects === 0`).
- Sediakan opsi "Skip Wizard" agar tidak menghalangi pengguna yang ingin langsung menuju OS Dashboard.

## File yang Dimodifikasi / Dibuat

- `src/app/client/dashboard/components/ClientOnboardingWizard.tsx` [NEW]
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` [MODIFY]
- `docs/tracker/INDEX_TRACKER.md` [MODIFY]
- `docs/tracker/logs/sprint_61_onboarding_wizard.md` [NEW]

## Verification Plan

- `npm run lint` & `npx tsc --noEmit`
- `npm run cf:build`
- Manual browser verification di `/client/dashboard`.
