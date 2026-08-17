# Tracker Log: Sprint 36 - 404 Lottie Not Found Page

**Status:** Completed
**Mulai:** 2026-07-05
**Selesai:** 2026-07-05

## Tujuan (Objective)
- Mengganti halaman 404 agar memakai asset `public/lottie/404 Error.lottie`.
- Memastikan format `.lottie` dirender dengan renderer yang tepat, bukan `lottie-react` JSON.

## Task List
- [x] Pasang renderer dotLottie untuk file `.lottie`.
- [x] Tambahkan komponen client kecil untuk animasi 404.
- [x] Update `src/app/not-found.tsx` agar memakai animasi baru.
- [x] Verifikasi typecheck, lint, Cloudflare build, asset public, dan screenshot lokal.

## File yang Dimodifikasi (Modified Files)
- `package.json` -> Menambahkan dependency `@lottiefiles/dotlottie-react`.
- `package-lock.json` -> Lockfile dependency dotLottie.
- `src/components/shared/NotFoundAnimation.tsx` -> Komponen client untuk render `/lottie/404%20Error.lottie`.
- `src/app/not-found.tsx` -> Halaman 404 memakai animasi baru dan teks 404 tidak dobel.

## Bug & Perbaikan (Bug Tracker)
- **Bug 1:** File `.lottie` tidak bisa dirender langsung dengan `lottie-react`.
  - **Penyebab:** `lottie-react` dipakai untuk JSON Lottie, sedangkan `.lottie` adalah archive dotLottie.
  - **Perbaikan:** Menambahkan `@lottiefiles/dotlottie-react` dan komponen `NotFoundAnimation`.
- **Bug 2:** Frame awal animasi terlihat kosong cukup lama.
  - **Penyebab:** Asset animasi punya intro/frame awal yang ringan.
  - **Perbaikan:** Playback speed dinaikkan menjadi `2` dan visual 404 diambil dari Lottie agar tidak dobel dengan heading.

## Verifikasi
- `npx tsc --noEmit --pretty false` -> passed.
- `npm run lint -- --quiet` -> passed.
- `npm run cf:build` -> passed setelah dev server port 3000 dihentikan sementara.
- `HEAD http://localhost:3000/lottie/404%20Error.lottie` -> 200.
- Playwright screenshot lokal menunjukkan animasi 404 tampil.

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Asset yang dipakai bernama `public/lottie/404 Error.lottie` dengan spasi; referensi URL harus di-encode sebagai `/lottie/404%20Error.lottie`.
- Dev server sudah dinyalakan kembali di port 3000 setelah build.

## Update 2026-07-06
- Halaman 404 disederhanakan menjadi hanya Lottie besar.
- Card, heading visible, deskripsi, dan tombol navigasi dihapus dari `src/app/not-found.tsx`.
- Heading aksesibilitas tetap ada sebagai `sr-only`.
- Verifikasi ulang:
  - `npx tsc --noEmit --pretty false` -> passed.
  - `npm run lint -- --quiet` -> passed.
  - `npm run cf:build` -> passed.
