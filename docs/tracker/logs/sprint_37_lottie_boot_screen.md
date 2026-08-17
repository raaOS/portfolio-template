# Tracker Log: Sprint 37 - Lottie Boot Screen

**Status:** Completed
**Mulai:** 2026-07-06
**Selesai:** 2026-07-06

## Tujuan (Objective)
- Menghapus boot animation legacy berupa lubang kunci/hollow-O dan wordmark `Portfolio OS`.
- Mengganti boot screen OS dengan Lottie `public/lottie/hello hitam.json`.
- Membuat transisi dari boot screen ke desktop berupa slide ke atas, bukan fade.

## Task List
- [x] Ganti `StartScreen` menjadi Lottie-only boot.
- [x] Hapus teks visible `Click to Start` dan wordmark boot lama.
- [x] Boot otomatis setelah Lottie tampil, agar user tidak mentok di tulisan `hello`.
- [x] Klik/Enter/Space tetap bisa mempercepat masuk desktop.
- [x] Ubah keluar boot dari opacity fade menjadi slide ke atas.

## File yang Dimodifikasi (Modified Files)
- `src/components/os/ui/StartScreen.tsx` -> Mengganti sequence keyhole/wordmark dengan Lottie `hello hitam.json`, auto-start, dan slide-up reveal.
- `src/components/os/core/DesktopEnvironment.tsx` -> Sebagian komentar legacy boot direvisi agar tidak mengarah ke keyhole lama.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Setelah teks `Click to Start` dihapus, user bisa mengira boot mentok di tulisan `hello`.
  - **Penyebab:** Flow lama masih menunggu click manual.
  - **Perbaikan:** Tambahkan auto-start setelah 2.2 detik; klik/keyboard tetap menjadi shortcut.
- **Bug 2:** Transisi awal memakai fade, tidak sesuai arahan visual terbaru.
  - **Penyebab:** Overlay boot memakai `opacity: 0` saat `booting`.
  - **Perbaikan:** Overlay boot sekarang bergerak `translateY(-100%)` dengan durasi 900ms.

## Verifikasi
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run lint -- --quiet` -> passed.
- Browser smoke lokal:
  - Start screen tampil dengan Lottie `hello hitam.json`.
  - Tanpa klik, start screen hilang otomatis.
  - `data-os-booted="true"` terset.
  - Desktop layer aktif: opacity `1`, pointer `auto`.
- `npm run cf:build` -> passed.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Asset `hello hitam.json` kecil, sekitar 4.1 KB, jadi tidak berat sebagai asset boot.
- Boot sound hanya diputar kalau user klik/tekan Enter/Space. Auto-start tidak memaksa suara agar tidak melanggar autoplay policy browser.
