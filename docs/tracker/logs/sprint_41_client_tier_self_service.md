# Tracker Log: Sprint 41 - Client Tier Self-Service

**Status:** Completed
**Mulai:** 2026-07-06
**Selesai:** 2026-07-06

## Tujuan (Objective)
- Membuat dashboard client benar-benar self-service sesuai tier Lite dan Pro.
- Lite dapat mengelola project/media serta konten profil dasar tanpa bantuan Master.
- Pro mendapat tambahan pengaturan sistem/tampilan aman dan WhatsApp Testimoni.
- Semua endpoint client baru harus memakai session client sebagai sumber `siteId`, bukan menerima `siteId` bebas dari body.

## Task List
- [x] Audit pola auth client, CSRF, site scope, service about/contact/experience/hard-skill/sticky-notes.
- [x] Tambah endpoint client `content` untuk profil, kontak, statistik, pengalaman, dan hard skills.
- [x] Tambah endpoint client `system` khusus Pro untuk wallpaper aktif, blur, sticky note, dan label Dock.
- [x] Ubah dashboard client agar 4 modul besar punya status tier yang jujur dan section editor nyata.
- [x] Verifikasi lint, TypeScript, Cloudflare build, dan local page load.

## File yang Dimodifikasi (Modified Files)
- `src/app/api/client/content/route.ts` -> Endpoint client site-scoped untuk baca/tulis profil, kontak, statistik, pengalaman, dan hard skills.
- `src/app/api/client/system/route.ts` -> Endpoint client Pro-only untuk baca/tulis pengaturan tampilan aman.
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` -> Menambahkan form Konten Profil, form Sistem & Tampilan, load/save API baru, dan status modul Lite/Pro.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 41.
- `docs/tracker/logs/sprint_41_client_tier_self_service.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug:** Modul client dashboard masih menampilkan `Konten Profil` dan `Sistem & Tampilan` sebagai tidak bisa dipakai client.
  - **Penyebab:** Sprint 40 baru membuat shell 4 modul, tetapi belum membuka editor data client untuk modul tersebut.
  - **Perbaikan:** Menambahkan endpoint `/api/client/content` dan `/api/client/system`, lalu menghubungkan form dashboard ke endpoint tersebut.
- **Bug:** Risiko desain API jika client mengirim `siteId` bebas untuk update data tenant.
  - **Penyebab:** Banyak endpoint admin memakai query/body `siteId`; untuk client self-service pola itu tidak boleh dipakai.
  - **Perbaikan:** Endpoint client baru hanya memakai `siteId` dari session `validateClientRequest()`.
- **Bug:** Tier Lite/Pro kurang jelas di UI client.
  - **Penyebab:** Status modul sebelumnya masih `Lewat Master` atau disabled.
  - **Perbaikan:** Lite & Pro aktif untuk Konten Profil; Sistem & Tampilan dan WhatsApp Testimoni tetap Pro-gated.

## Verifikasi
- `npx eslint src/app/api/client/content/route.ts src/app/api/client/system/route.ts src/app/client/dashboard/ClientSelfServiceDashboard.tsx`
- `npx tsc --noEmit --pretty false`
- `npm run cf:build`
- `Invoke-WebRequest http://localhost:3000/client/dashboard` -> HTTP 200

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Client self-service sekarang mencakup:
  - Lite & Pro: project/media, profil, kontak, statistik, pengalaman, hard skills.
- **Update Fitur Paket Lite (2026-07-22):** Pengaturan wallpaper desktop aktif, blur wallpaper, sticky note, dan label Dock dibuka untuk Paket Lite & Pro di `/api/client/system` dan Client Dashboard tanpa error 403.

- Upload wallpaper dan upload icon hard skill belum dibuka ke client karena pipeline tersebut lebih berisiko. Saat ini tetap lewat Master/Icon Library.
- Jangan ubah endpoint client baru menjadi menerima `siteId` dari body/query. Site harus selalu berasal dari session client.
