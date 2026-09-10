# Sprint 82 - macOS Desktop Template Performance & Click Responsiveness Optimization

> **Status:** 🟢 Completed  
> **Tanggal:** 10 September 2026  
> **Tipe:** Performance Optimization & UX Bugfix  
> **Fokus Utama:** Menghilangkan kelambatan perpindahan antar halaman (view transition) & memperbaiki aset gambar/video yang membutuhkan klik berkali-kali agar responsif 1-klik tanpa menghilangkan efek visual, animasi fisika, maupun fungsionalitas.

---

## 1. Latar Belakang & Akar Masalah (Root Cause Analysis)

### Masalah 1: Perpindahan Halaman Lambat
1. **Durasi View-Transition Berlebih:** Di `src/app/globals.css`, animasi slide antar halaman diatur selama `800ms` (old page slide out) dan `760ms` (shared element morph) dengan efek fade `540ms-580ms`, membuat transisi terasa berat dan lamban saat berpindah rute (mis. dari Desktop ke Projects).
2. **Artificial Delay Dock Bounce:** Di `src/components/os/core/Dock.tsx`, konstanta `LINK_BOUNCE_DELAY_MS` disetel `280ms` sebelum navigasi `router.push()` dijalankan, menambah total jeda > 1,08 detik sebelum halaman baru mulai dimuat.
3. **Artificial TransitionPhase Timeout:** Di `src/components/home/HomeOSWrapper.tsx`, terdapat `setTimeout` paksa selama `500ms` pada state `transitionPhase: 'fading'` sebelum komponen Desktop dipasang.

### Masalah 2: Aset Gambar/Video Membutuhkan Klik Berkali-kali
1. **Desktop Icons Mengharuskan Double-Click:** Di `src/components/os/layers/DesktopIconsLayer.tsx`, handler `onClick` pada mode desktop hanya mengaktifkan `setSelectedIconId(icon.id)` tanpa membuka jendela proyek. Jendela hanya terbuka pada `onDoubleClick`. Sebagian besar pengguna web mengklik sekali, merasa macet, lalu mencoba klik berkali-kali.
2. **Sub-Pixel Mouse Jitter Menelan Event Klik:** Di `src/components/os/ui/elements/DesktopIcon.tsx`, div dibungkus framer-motion `drag={!isMobile}` tanpa threshold jarak. Gerakan mikroskopis kursor (0,5–1 pixel) saat menekan mouse langsung memicu `handleDragStart` (`isDragging = true`). Handler `onClick` mengecek `if (!isDragging)`, sehingga klik dibatalkan secara diam-diam.
3. **Explorer / Finder Mode Double-Click:** Di `src/components/os/windows/ExplorerWindow/index.tsx`, mengklik file atau gambar hanya memilih node (`handleNodeClick`), sementara pratinjau file membutuhkan `handleNodeDoubleClick`.
4. **Intersepsi Pointer pada Video Tanpa Kontrol:** Di `src/components/shared/components/MediaVideo.tsx`, elemen `<video>` yang tidak memiliki native controls (`!controls`) belum memiliki kelas `pointer-events-none`, sehingga dapat menangkap klik mouse dan menghalangi penerusan klik ke container / kartu tautan induk.

---

## 2. Implementasi & Perbaikan

1. **`src/app/globals.css`:**
   - Mempercepat durasi view-transition dari `800ms` menjadi `350ms` (slide) dan `220ms` (fade out) dengan kurva kelembutan iOS/macOS fluid `cubic-bezier(0.25, 1, 0.5, 1)`.
   - Durasi morphing shared element dipangkas dari `760ms` menjadi `320ms`.

2. **`src/components/os/core/Dock.tsx`:**
   - Menurunkan `LINK_BOUNCE_DELAY_MS` dari `280ms` ke `90ms` sehingga animasi bounce tetap terlihat jelas tanpa menahan navigasi.

3. **`src/components/home/HomeOSWrapper.tsx`:**
   - Memangkas delay `transitionPhase` dari `500ms` menjadi `100ms` (atau langsung `ready` jika chunk desktop sudah di-cache).

4. **`src/components/os/layers/DesktopIconsLayer.tsx`:**
   - Memperbarui `onClick` agar langsung memicu `openProjectWindow` dengan animasi ekspansi ikon secara instan pada klik pertama (1-click launch), dengan tetap mempertahankan handler `onDoubleClick` sebagai fallback pengunjung desktop tradisional.

5. **`src/components/os/ui/elements/DesktopIcon.tsx`:**
   - Menambahkan threshold jarak drag (> 5px) via `onDrag` dan `hasMovedRef`.
   - Gerakan mouse di bawah 5px dianggap sebagai klik murni, mencegah pembatalan event klik dan mencegah pemutaran suara 'drag' yang tidak disengaja.

6. **`src/components/os/windows/ExplorerWindow/index.tsx`:**
   - Memperbarui `handleNodeClick` agar langsung membuka folder / pratinjau file gambar dan video pada klik pertama (`void handleNodeDoubleClick(node, e)`).

7. **`src/components/shared/components/MediaVideo.tsx`:**
   - Menerapkan `pointer-events-none` secara otomatis pada `<video>` saat `!controls`, sehingga interaksi klik mouse diteruskan tanpa hambatan ke kartu, link, atau modal wrapper.

8. **`next.config.mjs` & `MediaImage.tsx`:**
   - Ditemukan akar masalah kenapa sebagian aset gambar (`.jpg`/`.png`) di `/projects?view=grid` menjadi kotak abu-abu ("Media Unavailable"): Komponen Next.js `<Image>` secara default di production mengalihkan gambar ke optimizer `/_next/image?url=...`. Namun pada Cloudflare Workers (OpenNext), server optimasi gambar Node.js/Sharp tidak ada (mengembalikan `404 Not Found`). Sementara aset video (`.mp4`) berhasil karena menggunakan tag `<video>` murni.
   - Solusi: Mengaktifkan `unoptimized: true` di [next.config.mjs](file:///c:/Users/USER/Documents/portfolio-template/next.config.mjs) serta atribut `unoptimized={true}` pada [MediaImage.tsx](file:///c:/Users/USER/Documents/portfolio-template/src/components/shared/components/MediaImage.tsx) dan [MediaVideo.tsx](file:///c:/Users/USER/Documents/portfolio-template/src/components/shared/components/MediaVideo.tsx) sehingga seluruh gambar dimuat langsung dari Cloudflare R2 CDN (`/r2/...`) yang berstatus 200 OK.

9. **`src/components/os/ui/DesktopBackground.tsx` & Sinkronisasi Live Video Wallpaper 4K ke R2/D1:**
   - Ditemukan akar masalah kenapa wallpaper desktop di `/preview/os-desktop` kosong/hitam: ID wallpaper aktif di D1 mengarah ke file video Hunt Showdown yang belum diunggah ke bucket R2 (mengembalikan `404 Not Found`).
   - Pengguna mengonfirmasi bahwa wallpaper desktop harus berupa **video** (bukan gambar statis).
   - Solusi:
     - Mengunggah seluruh koleksi wallpaper video 4K dari lokal (`hunt-showdown-veil-of-thorns.3840x2160.mp4`, `Zen-Kois-wallpaper-50s-upload-safe.mp4`, `pink-bloom-field-clear-sky-live-wallpaper-wallsflow-com.mp4`, dan `sachiro-dark-nights.3840x2160.mp4`) beserta poster JPEG resolusi tinggi ke Cloudflare R2 bucket (`portfolio-template-media/assets/wallpapers/`).
     - Memperbarui database D1 (`content` & `content_default-site`) sehingga wallpaper aktif adalah `w-1780744973336-veil-thorns` bertipe `video`.
     - Menyempurnakan `DesktopBackground.tsx`: menambahkan `autoPlay`, `preload="auto"`, dan menghapus `onError` pada poster image yang sebelumnya secara keliru membatalkan pemutaran video. Handler `onError` pada elemen `<video>` tetap aktif sebagai fail-safe agar bila terjadi kegagalan jaringan, sistem tetap menampilkan fallback default tanpa layar hitam.

---

## 3. Hasil Verifikasi

- **TypeScript Typecheck:** `npx tsc --noEmit` ➔ 0 error (Exit code: 0).
- **Unit Test Suite:** `npm test` ➔ 109 test files passed, 821 tests passed (100% PASS).
- **Cloudflare Build & Deploy:** `npm run cf:build` & `npx opennextjs-cloudflare deploy` berhasil di-deploy ke `https://makeitbetter.my.id` (Version ID: `4274559f-5cc2-4833-9a63-3539668d843a`).
- **Live Browser Verification:** `https://makeitbetter.my.id/preview/os-desktop` diverifikasi via automated browser: `<video>` element aktif, memutar video 4K (*Hunt Showdown Veil of Thorns*) secara mulus (`paused: false`, `readyState: 4`, `opacity: 1`, looping, muted) dengan resolusi asli 3840x2160.
- **Integritas Visual:** Seluruh animasi spring, efek Web Audio retro SoundManager, looping wallpaper video, dan efek transisi tetap berjalan 100% utuh dan lancar.
