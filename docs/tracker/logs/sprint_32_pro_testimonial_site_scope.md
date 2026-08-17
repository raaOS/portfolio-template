# Tracker Log: Sprint 32 - Pro Testimonial Site Scope

**Status:** Completed
**Mulai:** 2026-07-05
**Selesai:** 2026-07-05

## Tujuan (Objective)
- Mengunci fitur WhatsApp/testimoni sebagai fitur Pro-only.
- Menjamin data testimoni editable client benar-benar site-scoped dan tidak memakai `default-site`.
- Menyembunyikan jalur public WhatsApp untuk Lite, termasuk Dock, Spotlight, Dynamic Island, dan deep-link `?app=whatsapp`.

## Task List
- [x] Tambah helper feature plan untuk WhatsApp testimonial.
- [x] Tambah endpoint `/api/client/testimonials` dengan session-based `siteId`, CSRF, Pro gate, dan quota limit.
- [x] Tambah UI client dashboard untuk membuat, mengedit, dan menghapus testimoni Pro.
- [x] Tampilkan locked state untuk Lite.
- [x] Hindari fallback demo testimonial untuk tenant non-default.
- [x] Hardening public tenant Lite agar WhatsApp tidak bisa dibuka dari Dock, Spotlight, Dynamic Island, atau deep-link.
- [x] Tambah test API untuk Pro gate, site scope, dan quota.

## File yang Dimodifikasi (Modified Files)
- `src/lib/product/sitePlan.ts` -> Menambahkan `PlanFeatures`, `getPlanFeatures`, dan `canUseWhatsappTestimonials`.
- `src/app/api/client/check-auth/route.ts` -> Mengembalikan feature summary pada sesi client.
- `src/app/api/client/testimonials/route.ts` -> Endpoint client testimonial site-scoped dan Pro-gated.
- `src/app/api/client/testimonials/route.test.ts` -> Test Lite rejected, Pro scoped by session site, quota, update, delete.
- `src/lib/services/testimonialService.ts` -> Menambah `getSiteTestimonials` strict tenant read dan membuat create/update/delete menerima `siteId`.
- `src/lib/loaders.ts` -> Tenant non-default tidak lagi menerima fallback demo testimonial.
- `src/lib/adapters/siteDataAdapter.ts` -> Public site adapter memakai strict site testimonial read.
- `src/app/[siteSlug]/page.tsx` -> Menyembunyikan WhatsApp/testimonial pada tenant Lite.
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` -> Menambahkan manager testimoni Pro dan locked state Lite.
- `src/components/os/hooks/useDesktopNavigation.tsx` -> Guard open WhatsApp saat fitur dinonaktifkan.
- `src/components/os/core/DesktopEnvironment.tsx` -> Mengalirkan flag `isWhatsAppEnabled` dan menolak deep-link `?app=whatsapp` saat disabled.
- `src/components/os/layers/UIOverlaysLayer.tsx` -> Mengosongkan testimonial notification Lite dan memblokir Spotlight open.
- `src/components/os/core/Spotlight.tsx` -> Mendukung `hiddenAppIds` agar WhatsApp tidak muncul pada Lite.

## Bug & Perbaikan (Bug Tracker)
- **Bug:** Tenant Lite masih bisa melihat/membuka fitur WhatsApp testimonial lewat Dock, Spotlight, Dynamic Island, atau URL `?app=whatsapp`.
  - **Penyebab:** Fitur lama tidak memakai gate plan tenant.
  - **Perbaikan:** Gate dari server page ke `aboutData.dockConfig.whatsapp.isHidden`, lalu diteruskan ke DesktopEnvironment, navigation hook, overlays, dan Spotlight.
- **Bug:** Client testimonial berisiko jatuh ke `default-site` jika memakai endpoint lama.
  - **Penyebab:** `/api/testimonial` adalah endpoint admin legacy tanpa site session client.
  - **Perbaikan:** Endpoint client baru selalu mengambil `siteId` dari session cookie client, bukan dari body/query.
- **Bug:** Tenant non-default bisa membawa fallback demo testimonial saat belum punya data.
  - **Penyebab:** Content fallback testimonial default dipakai juga untuk tenant.
  - **Perbaikan:** Strict read untuk tenant mengembalikan list kosong jika belum ada data testimonial tenant.

## Verifikasi
- `npx vitest run src/app/api/client/testimonials/route.test.ts` -> Pass, 6 tests.
- `npx tsc --noEmit --pretty false` -> Pass.
- `npm run lint -- --quiet` -> Pass.
- Playwright lokal `/urgent` setelah boot -> Dock tidak punya `dock-item-whatsapp`, deep-link `/urgent?app=whatsapp` tidak membuka window WhatsApp, console error/warning kosong.
- `npm run cf:build` -> Pass. Catatan build tetap mengingatkan FFmpeg browser harus diupload ke R2 via `npm run r2:upload-ffmpeg`, sesuai debt yang sudah diketahui.
- Dev server dinyalakan kembali di port 3000 dan merespons HTTP 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Fitur WhatsApp testimonial sekarang Pro-only secara backend dan public UI.
- Client Lite tetap melihat locked state di dashboard, tetapi tidak bisa memanggil endpoint testimonial.
- Editor client saat ini memakai format chat sederhana per baris: `Client: ...` atau `Saya: ...`.
