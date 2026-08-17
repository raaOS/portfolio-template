# Tracker Log: Sprint 23 - Header PIN Entry Cleanup

**Status:** Completed
**Mulai:** 2026-07-02
**Selesai:** 2026-07-02

## Tujuan (Objective)
- Menghapus trigger PIN legacy dari ikon Lottie mata di header public dan desktop OS menubar.
- Membuat klik ikon mata langsung membuka halaman login admin tanpa modal PIN.

## Task List
- [x] Hapus state dan import modal PIN dari header.
- [x] Hapus state dan import modal PIN dari desktop OS menubar.
- [x] Hapus handler klik yang membuka modal PIN.
- [x] Pastikan link mata tetap menuju `/admin/login?redirect=%2Fadmin`.
- [x] Hapus komponen modal PIN yang sudah tidak dipakai.
- [x] Verifikasi lint dan typecheck.

## File yang Dimodifikasi (Modified Files)
- `src/components/shared/Header.tsx` -> Menghapus `IOSPinModal`, `useTransitionRouter`, state `isPinModalOpen`, dan handler `preventDefault`; link Lottie mata sekarang langsung menuju login admin.
- `src/components/os/core/MenuBar.tsx` -> Menghapus `IOSPinModal`, `useTransitionRouter`, state `isPinModalOpen`, dan handler modal; ikon mata menubar OS sekarang langsung menuju login admin.
- `src/components/shared/IOSPinModal.tsx` -> Dihapus karena tidak ada pemanggil tersisa.
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entry Sprint 23.
- `docs/tracker/logs/sprint_23_header_pin_cleanup.md` -> Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Klik ikon Lottie mata di header public masih menampilkan modal PIN.
  - **Penyebab:** Header public masih menyimpan flow legacy `IOSPinModal` sebelum redirect ke admin login.
  - **Perbaikan:** Hapus wiring modal PIN dari `Header.tsx`; klik ikon mata langsung mengikuti link login admin.

- **Bug 2:** Klik ikon Lottie mata di desktop OS menubar masih menampilkan modal PIN.
  - **Penyebab:** `MenuBar.tsx` punya flow legacy terpisah dari `Header.tsx`, sehingga perbaikan awal belum menyentuh desktop simulator.
  - **Perbaikan:** Hapus wiring modal PIN dari `MenuBar.tsx` dan ganti container ikon menjadi link login admin langsung.

## Verifikasi
- `rg "IOSPinModal|isPinModalOpen|setIsPinModalOpen|Masukkan PIN|PIN diperlukan" src/components src/app -n` -> no rendered PIN modal references.
- `npx eslint src/components/shared/Header.tsx src/components/os/core/MenuBar.tsx` -> pass.
- `npx tsc --noEmit --pretty false` -> pass.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Jangan kembalikan modal PIN ke header public atau desktop OS menubar. Login admin cukup lewat `/admin/login?redirect=%2Fadmin`.
- Endpoint/admin setting PIN masih ada di repo, tetapi entry visual modal PIN sudah dihapus sesuai request user.
