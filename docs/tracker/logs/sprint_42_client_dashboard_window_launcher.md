# Tracker Log: Sprint 42 - Client Dashboard Window Launcher

**Status:** Completed
**Mulai:** 2026-07-06
**Selesai:** 2026-07-06

## Tujuan (Objective)
- Mengubah dashboard client agar terasa seperti launcher Master: 4 kartu modul besar, bukan dashboard panjang satu halaman.
- Setiap modul client dibuka sebagai window/panel bergaya OS dengan traffic-light controls dan efek jelly/pop.
- Mempertahankan isi CRUD self-service dari Sprint 41 tanpa mengubah endpoint/backend.

## Task List
- [x] Audit gaya modul Master dari `src/app/admin/desktop/registry.ts`.
- [x] Ubah kartu client menjadi launcher besar 4 modul: Karya & Media, Konten & Berkas, Sistem & Tampilan, Komunikasi.
- [x] Tambahkan state `activeModule` agar hanya satu modul aktif yang ditampilkan.
- [x] Bungkus konten modul dalam window bar bergaya macOS dengan tombol close.
- [x] Sembunyikan section panjang default; project editor sidebar hanya muncul di modul Karya & Media.
- [x] Tambahkan animasi pop/jelly lokal pada window aktif.
- [x] Verifikasi lint, TypeScript, Cloudflare build, dan local page load.

## File yang Dimodifikasi (Modified Files)
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` -> Mengubah layout client dashboard menjadi launcher + window module.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 42.
- `docs/tracker/logs/sprint_42_client_dashboard_window_launcher.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug:** Dashboard client tampil sebagai halaman panjang dengan banyak section turun ke bawah.
  - **Penyebab:** Sprint 41 membuka self-service form langsung dalam satu halaman.
  - **Perbaikan:** Menambahkan `activeModule` dan conditional rendering per modul.
- **Bug:** UI client tidak terasa sama dengan Master launcher.
  - **Penyebab:** Kartu client sebelumnya memakai card ringkas + badge, bukan card besar seperti Master.
  - **Perbaikan:** Kartu dibuat besar, centered, icon square besar, hover/active jelly, dan window chrome.

## Verifikasi
- `npx eslint src/app/client/dashboard/ClientSelfServiceDashboard.tsx`
- `npx tsc --noEmit --pretty false`
- `npm run cf:build`
- `Invoke-WebRequest http://localhost:3000/client/dashboard` -> HTTP 200

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Dashboard client sekarang default hanya menampilkan launcher modul.
- Isi modul muncul setelah klik kartu dan bisa ditutup lewat traffic-light merah atau tombol close.
- Jangan kembalikan section semua modul menjadi satu halaman panjang kecuali user eksplisit meminta.
