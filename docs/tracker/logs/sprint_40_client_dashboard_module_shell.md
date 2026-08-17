# Tracker Log: Sprint 40 - Client Dashboard Module Shell

**Status:** Completed
**Mulai:** 2026-07-06
**Selesai:** 2026-07-06

## Tujuan (Objective)
- Membuat dashboard client menampilkan 4 modul besar yang konsisten dengan konsep Lite/Pro.
- Membuat tampilan dashboard client lebih terasa seperti window OS, tanpa mengubah engine Dock, Window, atau efek jelly OS utama.

## Task List
- [x] Tambahkan shell visual ala window dengan titlebar dan traffic lights.
- [x] Tambahkan 4 module cards: Karya & Media, Konten Profil, Sistem & Tampilan, Komunikasi.
- [x] Beri badge tier/status untuk membedakan Lite & Pro, Aktif, Terkunci, Quota penuh, dan Lewat Master.
- [x] Tambahkan hover/active jelly ringan pada module cards.
- [x] Hubungkan modul aktif ke section project dan testimoni dengan smooth scroll.
- [x] Jaga modul yang belum self-service agar ditandai jujur sebagai `Lewat Master`, bukan seolah-olah sudah bisa diedit client.

## File yang Dimodifikasi (Modified Files)
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` -> Menambahkan window shell, 4 module cards, tier/status gating, jelly-card interaction, dan anchor section project/testimoni.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 40.
- `docs/tracker/logs/sprint_40_client_dashboard_module_shell.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Dashboard client tidak menampilkan 4 modul besar sesuai konsep produk.
  - **Penyebab:** UI client dashboard langsung masuk ke quota/project table tanpa module overview.
  - **Perbaikan:** Tambahkan 4 module cards dengan status tier yang eksplisit.

- **Bug 2:** Dashboard client terasa seperti web admin biasa, bukan window OS.
  - **Penyebab:** Layout lama memakai page header standar dan card biasa.
  - **Perbaikan:** Bungkus halaman dengan shell window, titlebar, traffic lights, dan efek jelly ringan pada module cards.

## Verifikasi
- `npx eslint src/app/client/dashboard/ClientSelfServiceDashboard.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.
- `npm run cf:build` -> pass setelah cache lokal dibersihkan.
- Dev server dinyalakan lagi dan `http://localhost:3000` -> HTTP 200.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Modul `Konten Profil` dan `Sistem & Tampilan` sengaja diberi status `Lewat Master` karena belum ada editor client self-service penuh untuk dua area itu.
- Jangan mengubah `Dock.tsx`, `Window.tsx`, `useJellyDrag.ts`, atau window engine OS hanya untuk polish dashboard client.
