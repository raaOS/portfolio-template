# Changelog — Portfolio OS Template

Semua pembaruan fitur, optimasi, dan perbaikan bug template dicatat di file ini.
Format catatan ini otomatis dibaca oleh portal `PENGELOLA_KLIEN.bat` di menu **Update Versi Template**.

---

## [1.2.2] - 2026-09-10

### 🎬 Live Video Wallpaper & UI Clean-up
- **Perbaikan Wallpaper Video Desktop macOS (`/preview/os-desktop`):** Mengunggah seluruh koleksi wallpaper video resolusi 4K (*Hunt Showdown Veil of Thorns*, *Zen Kois Live Wallpaper*, *Pink Bloom*, dan *Sachiro Dark Nights*) beserta poster framenya ke Cloudflare R2 bucket (`assets/wallpapers/`), dan mengatur video aktif di database D1 sehingga wallpaper berputar mulus sebagai live video background secara otomatis (autoplay, loop, muted).
- **Fail-safe Fallback Wallpaper:** Ditambahkan mekanisme error recovery otomatis di `DesktopBackground.tsx` dengan event `onError` pada video, sehingga apabila aset video gagal di-load atau network offline, background sistem akan otomatis beralih ke wallpaper default berkualitas tinggi tanpa menyebabkan blank screen.
- **Pembersihan Dynamic Island Desktop macOS:** Menghapus komponen Dynamic Island dan notifikasi bubble di bagian atas layar desktop macOS template agar tampilan layar lebih bersih, minimalis, dan berfokus penuh pada konten serta wallpaper.

---

## [1.2.1] - 2026-09-10

### ⚡ Peningkatan Performa & Kecepatan Respons
- **Perpindahan Halaman Cepat & Mulus (Smooth Transition):** Durasi animasi View Transition antar halaman dipercepat dari 800ms menjadi 350ms/320ms dengan kurva deselerasi iOS/macOS fluid (`cubic-bezier(0.25, 1, 0.5, 1)`), serta memangkas delay buatan dock bounce dari 280ms ke 90ms.
- **Responsivitas 1-Klik Aset Desktop (Zero Latency Click):** Ikon desktop dan kartu proyek kini merespons dan membuka jendela langsung pada klik pertama (1-click launch) tanpa harus klik berkali-kali atau double-click.
- **Threshold Toleransi Drag Mouse:** Ditambahkan batas pergerakan kursor (> 5px) pada ikon desktop sehingga getaran atau pergeseran mikroskopis mouse saat mengklik tidak lagi membatalkan event klik.
- **Single-Click File Preview di Finder / Explorer:** Membuka file gambar, video, dan folder di jendela Explorer simulator kini responsif langsung pada klik pertama.
- **Perbaikan Aset Gambar Cloudflare Workers (`unoptimized: true`):** Memperbaiki gambar berformat `.jpg`/`.png` yang sebelumnya gagal tampil (menjadi kotak abu-abu "Media Unavailable") pada `projects?view=grid` karena endpoint `/_next/image` tidak didukung oleh runtime Edge Workers; aset kini disajikan langsung via Cloudflare R2 CDN.
- **Transparansi Event Video (`pointer-events-none`):** Elemen video tanpa kontrol kini otomatis melewatkan event klik ke elemen kartu/tautan induk sehingga tidak ada klik yang tertelan.

---

## [1.2.0] - 2026-09-10

### 🚀 Fitur Baru
- **Popup Detail Proyek macOS di Semua Mode:** Kartu proyek di Pinterest Grid (`/projects?view=grid`) dan 3D Canvas (`/projects?view=3d`) kini langsung membuka jendela popup macOS interaktif dengan tabs Ringkasan & Proses tanpa pindah halaman.
- **Portal Master PENGELOLA_KLIEN.bat:** Pusat kendali 1-klik untuk pendaftaran klien baru, manajemen custom domain, dan update versi template ke seluruh klien sekaligus.

### ⚡ Peningkatan Performa
- **Optimasi 3D Infinite Canvas:** Pemutaran video hanya saat kursor diarahkan (*play-on-hover*), menghemat beban decoder grafis hingga 80% dan menjaga pergerakan kamera stabil di 60 FPS.
- **Pembersihan Tooltip Hover:** Menghilangkan tooltip kursor di 3D Canvas agar tampilan lebih bersih, leluasa, dan mulus.

### 🐛 Perbaikan Bug
- **Fixed Viewport Pop-up Window:** Jendela proyek macOS kini terkunci diam di layar dan tidak ikut terseret ke atas saat halaman grid di-scroll.
- **Navigasi Dock Bawah:** Ikon About Me, Contact, WhatsApp, dan Notes pada dock kini mengarahkan kembali ke desktop macOS simulator secara mulus.

---

## [1.1.0] - 2026-09-08

### 🚀 Fitur Baru
- **Universal AI Assistant Settings:** Pengaturan mandiri provider AI (Google Gemini, OpenRouter, Groq, OpenAI, dan custom Base URL) di dashboard admin konsumen.
- **Otomasi Custom Domain:** Pendaftaran domain klien (seperti `namaklien.com`) langsung ke Cloudflare Pages secara otomatis tanpa mengetik ulang token.

---

## [1.0.0] - 2026-09-01

### 🚀 Rilis Awal
- Fondasi Portfolio OS Managed Service dengan simulasi desktop macOS dan 3D Spatial Canvas terintegrasi Cloudflare D1 & R2.
