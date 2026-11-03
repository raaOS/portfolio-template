# Fix Pinggiran Biru Cover Bocor, Sudut Siku Emulator, dan Switcher Grid/Dot (2026-10-30)

- **Status:** Completed
- **Permintaan user:**
  1. Background halaman utama ditambahkan pilihan toggle switcher Grid dan Dot (menggantikan badge "Interactive 3D Portfolio OS").
  2. Pill switcher berukuran konsisten dengan efek slider animasi dan anti-translate browser.
  3. Pinggiran desktop emulator dibuat tidak rounded (siku / flat).
  4. Hapus shadow dan blur ungu di sekeliling desktop emulator.
  5. Perbaiki garis/pinggiran biru cover template yang bocor di sisi kiri-kanan desktop emulator.

## Akar Masalah & Solusi

1. **Cover 3D Mengintip di Pinggiran Emulator:**
   - **Penyebab:** Saat lembaran 3D terangkat ke depan dan iframe live dibuka, WebGL menjeda loop render (`if (this.liveActive) return;`), meninggalkan lembaran 3D dengan tekstur cover template (yang memiliki sisi berwarna biru) tepat di balik frame iframe. Karena ketebalan 3D mesh (`uPageThickness`) dan proyeksi perspektif kamera, sisi lembaran 3D sedikit menonjol keluar dari balik iframe.
   - **Solusi:** Menambahkan uniform `uLiveActive` pada shader WebGL `PAGE_VERTEX`. Saat `this.liveActive = true`, vertex shader melempar posisi lembaran yang difokuskan ke luar viewport (`gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return;`), lalu merender 1 frame WebGL bersih. Hasilnya: lembaran 3D fokus benar-benar hilang dari canvas WebGL selama live active, sehingga tidak ada lagi cover yang mengintip di pinggiran kiri-kanan emulator. Saat live ditutup, `uLiveActive` dikembalikan ke 0 dan lembaran 3D kembali beranimasi normal ke koridor.

2. **Sudut Siku Desktop Emulator:**
   - Mengubah `borderRadius` dari `14px` menjadi `0px` pada kontainer frame live dan iframe viewport, serta `10px` menjadi `0px` pada header bar.

3. **Shadow & Blur Ungu Dihilangkan:**
   - `boxShadow` pada kontainer desktop emulator diatur ke `'none'`.
   - `backdropFilter: blur` pada backdrop gelap dihilangkan agar warna biru latar bawah tidak terbiaskan menjadi ungu.
   - Navbar atas otomatis disembunyikan (`opacity: 0`) saat emulator aktif (`body.mag-live-active .wave-nav-floating`).

4. **Switcher Grid & Dot:**
   - Ditambahkan switcher tombol Dot & Grid di tengah navbar dengan indikator sliding pill animasi.
   - Ditambahkan `translate="no"` dan fixed equal width (`68px`) agar label tidak terpotong atau rusak oleh auto-translate browser.

## File yang Dimodifikasi
- `src/components/landing/LandingPage.tsx`
- `src/components/landing/landing.css`
- `src/components/landing/MagazineShowcase.tsx`

## Verifikasi
- `npm test -- src/components/landing/__tests__/`: 13 test PASS.
- `npx tsc --noEmit`: 0 error.

