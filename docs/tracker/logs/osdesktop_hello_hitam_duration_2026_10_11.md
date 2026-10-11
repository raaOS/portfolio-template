# Log #155 — OS Desktop: HELLO Hitam Diputar Sampai Selesai Baru ke Halaman Utama (v1.3.37)

- **Tanggal:** 2026-10-11
- **Versi:** 1.3.37
- **Status:** ✅ Selesai, teruji (unit test 5 kasus), siap live

## Laporan Owner

Di template os-desktop, animasi awal tulisan HELLO hitam sering **tidak terlihat / terpotong** — layar langsung pindah ke halaman utama sebelum animasi selesai. Permintaan: durasi disesuaikan, biarkan tulisan HELLO selesai animasinya baru transisi.

## Akar Masalah (Terverifikasi)

- `src/components/os/ui/StartScreen.tsx` menjalankan auto-start hanya setelah **1,2 detik** (`BOOT_CONFIG.autoStartDelay = 1200`).
- Animasi `public/lottie/hello hitam.json` butuh **6 detik** satu putaran (720 frame @ 120 fps).
- Lottie dimuat via `dynamic(() => import('lottie-react'), { ssr: false })` — chunk-nya sering baru tiba mendekati 1,2 detik, sehingga HELLO **terpotong di tengah atau tak sempat tampil sama sekali**. Loop `autoplay` juga membuat animasi tak pernah "selesai" secara natural.

## Perubahan

`src/components/os/ui/StartScreen.tsx`:

1. Lottie HELLO hitam: `loop` → **`loop={false}`** + **`onComplete`** — saat animasi selesai satu putaran penuh, `handleStart({ playSound: false })` dipanggil → layar slide ke desktop (600 ms) → `onStart` (reveal).
2. `autoStartDelay: 1200` diganti **`safetyFallbackDelay: 15000`** — jaring pengaman agar halaman tidak tersangkut bila chunk lottie gagal dimuat atau tab tersembunyi menunda `requestAnimationFrame`; **bukan** penentu durasi.
3. Jalur lama dipertahankan: klik / Space / Enter = skip langsung; suara startup hanya pada interaksi pengguna (kebijakan autoplay).

## File yang Dimodifikasi

- `src/components/os/ui/StartScreen.tsx`
- `src/components/os/ui/__tests__/StartScreen.test.tsx` (BARU — 5 kasus)
- `src/lib/constants.ts` (`APP_VERSION` → 1.3.37)
- `CHANGELOG.md`

## Verifikasi

- tsc 0, eslint 0, unit test **1017/1017 lulus** (file test 128 → 129).
- 5 kasus test StartScreen: (1) tidak auto-mulai sebelum animasi selesai (jauh melampaui auto-start lama 1,2 dtk); (2) `onComplete` → `data-boot-state="booting"` → `onStart` terpanggil setelah `completeDelay` 650 ms; (3) jaring pengaman 15 dtk tetap jalan tanpa sinyal; (4) klik tetap skip; (5) layar dilepas dari DOM setelah boot.
- Catatan verifikasi visual: harness otomatis melewati boot os-desktop (deteksi `navigator.webdriver` di `useBootSequence.checkShouldSkipBoot` — aturan lama untuk audit Lighthouse/headless), sehingga konfirmasi tampilan langsung dilakukan owner di browser nyata (pola yang sama pada verifikasi v1.3.32–1.3.36).
