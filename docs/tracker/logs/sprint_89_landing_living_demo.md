# Tracker Log: Sprint 89 — Landing Page "Living Demo" Rewrite (v1.3.3)

**Status:** 🟢 Completed (menunggu review visual owner)
**Mulai:** 2026-09-13
**Selesai:** 2026-09-13

## 🎯 Tujuan (Objective)
Menghidupkan halaman `/` sebagai etalase penjualan: mengganti landing monochrome pasif (2 iframe demo) dengan konsep **C2 "Living Demo"** — mini macOS yang memainkan dirinya sendiri (kursor palsu, window pop, dock) dan menyerahkan kendali penuh saat pengunjung menyentuh mouse. Copy marketing ditulis ulang total men-target segmen busy creatives (hasil diskusi positioning: produk dijual sebagai jasa "selesai 48 jam + dipelihara + wow saat pitch", bukan file template).

## 📋 Task List
- [x] `LivingDesktop.tsx` — stage macOS mini: menubar, dock 4 app (tooltip, open-dot), draggable window (spring pop AnimatePresence), Finder gallery (aset demo lokal), About/Contact/Notes window
- [x] Fake cursor choreography — spring-smoothed, koordinat persen→pixel (resize-safe), loop: glide in → klik dock → window pop → hover galeri → close → exit → ulang
- [x] User takeover — pointer movement stop choreography; drag window manual; dock click manual; close button pass-through (jangan tangkap pointer saat target = tombol close)
- [x] `LandingPage.tsx` rewrite — copy marketing baru (hero, 3 pain, 6 benefit, chat testimoni WhatsApp stagger, price count-up, CTA ganda)
- [x] `landing.css` rewrite — light warm studio theme (#f6f5f2, accent orange #ea580c), marquee karya infinite + mask fade, spotlight benefit cards (CSS var --spot-x/y), reveal-on-scroll, parallax hero, responsive + prefers-reduced-motion
- [x] Hapus iframe kecil 2x (biaya performa + "aquarium effect")

## 📂 File yang Dimodifikasi (Modified Files)
- `src/components/landing/LivingDesktop.tsx` — BARU (~440 baris): living demo engine
- `src/components/landing/LandingPage.tsx` — rewrite total: copy + struktur section + motion (Reveal, useScroll parallax, useInView, count-up, spotlight tracking)
- `src/components/landing/landing.css` — rewrite total (~700 baris)

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Close button tidak berfungsi — `setPointerCapture` di titlebar menelan click event ke tombol close. **Fix:** skip capture saat `e.target` berada dalam `.ld-traffic-close` (LivingDesktop `onPointerDownWindow`).
- **Bug 2:** Drag test awal "tidak bergerak" — ternyata viewport agent-browser hanya 569px tinggi; window berada di bawah fold. Bukan bug kode — koordinat test salah.
- **Bug 3 (kecil):** `gap-collapse` typo di CSS (properti tidak ada) — dihapus.

## ✅ Verifikasi
- tsc 0 error, eslint 0 error/warning
- 111 files / 838 tests PASS (tidak ada test landing lama yang rusak)
- QA agent-browser (DOM-level): choreography autoplay jalan (window terbuka otomatis di siklus), takeover menghapus hint+kursor, dock manual membuka 2 window bersamaan, drag window (655,120)→(395,280) terverifikasi via rect, close button 2→1 window
- **Limitasi QA:** model AI ini tidak bisa melihat screenshot (no image input); review visual estetika final harus oleh owner. Emulasi mobile tidak tersedia di agent-browser Windows — aturan CSS mobile ditulis defensif tapi belum diuji runtime.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Keputusan desain:** light theme di landing + stage gelap di dalam frame (device framing). Kalau owner ingin dark landing, cukup ganti CSS variables `--lp-*` di `.landing` — komponen tidak perlu diubah.
- Choreography loop ada di `LivingDesktop.runChoreography()` — timing bisa di-tune via konstanta delay di dalam `run()`.
- Aset galeri dari `/assets/projects/*.jpg` (fallback lokal). Saat klien punya karya sendiri, ganti `GALLERY` di LivingDesktop + `MARQUEE_WORKS` di LandingPage — atau nanti bisa di-wire ke API projects.
- Standar owner: "kalau jelek dan tidak playful, hapus total" — kalau owner menolak hasil visual, revert commit `593c42f` dan kembali ke landing lama; JANGAN iterate buta tanpa feedback visual owner.
- Mobile viewport belum teruji runtime (tool tidak support) — cek manual di HP sebelum rilis ke production.
- Lighthouse belum diukur ulang — jalankan setelah owner approve visual.
