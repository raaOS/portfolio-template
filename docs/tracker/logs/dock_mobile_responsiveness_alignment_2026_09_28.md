# Tracker Log: Penyelarasan UI/UX Dock macOS Desktop Mobile & Desktop

**Status:** 🟢 Completed  
**Mulai:** 2026-09-28  
**Selesai:** 2026-09-28  

## 🎯 Tujuan (Objective)
- Menyelaraskan ukuran, layout, dan fisika interaksi Dock pada template macOS Desktop di `c:\Users\USER\Documents\tamplate-portofolio` agar persis identik dengan implementasi yang disukai pengguna di `C:\Users\USER\Documents\portfolio ramos`.
- Mengatasi masalah ikon Dock yang terlalu besar, gemuk, dan tidak proporsional saat berada dalam mode mobile.

## 📋 Task List
- [x] Audit komparasi kode Dock antara `portfolio ramos` dan `tamplate-portofolio`.
- [x] Perbaikan `src/components/os/core/DockItem.tsx` (baseWidth 48px mobile / 52px desktop, scale multiplier 1 mobile / 1.35 desktop, touch squish bounce, touch-manipulation).
- [x] Perbaikan `src/components/os/core/Dock.tsx` (tinggi h-[68px] mobile / h-[72px] desktop, rounded-[24px] mobile / rounded-[22px] desktop, perataan baris items-center mobile, sortable style & touchAction).
- [x] Sinkronisasi resize viewport dinamis pada `src/components/os/core/OSDock.tsx`.
- [x] Verifikasi kode: ESLint (`npm run lint`), TypeScript check (`npx tsc --noEmit`), dan vitest unit tests pass 100%.
- [x] Update CHANGELOG.md versi `[1.3.8]`.

## 📂 File yang Dimodifikasi (Modified Files)
- `src/components/os/core/DockItem.tsx` -> Ukuran ikon mobile diset 48px fix, desktop 52px, magnifikasi hover dinonaktifkan di mobile, bounce squish diselaraskan.
- `src/components/os/core/Dock.tsx` -> Tinggi kapsul kaca disesuaikan (68px mobile / 72px desktop), padding dan gap diselaraskan (px-5 py-2 gap-2), sortable item alignItems disesuaikan center di mobile.
- `src/components/os/core/OSDock.tsx` -> Penambahan listener resize viewport untuk deteksi perubahan resolusi dan orientasi layar mobile.
- `src/components/layout/GlobalDockSlot.tsx` -> Fallback `DockPortal` dikembalikan (lihat bug di bawah) + konstanta `DOCK_SLOT_CLASS` dipakai bersama oleh slot dan fallback.
- `CHANGELOG.md` -> Menambahkan rilis catatan versi [1.3.8].

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Bug:** Ukuran ikon Dock pada mode mobile terlalu besar dan layout menempel ke bawah (*items-end*).
  - **Penyebab:** Nilai `baseWidth` sebelumnya diset 64px/72px dengan magnifikasi 88px, pembungkus memakai `h-[76px]` dan `items-end` dengan `gap-1`.
  - **Perbaikan:** Menyesuaikan ukuran persis dengan `portfolio ramos`: `baseWidth = isMobile ? 48 : 52`, row `h-[68px] items-center justify-center gap-2 px-5 py-2`, kapsul kaca `h-[68px] rounded-[24px]`.
- **Bug REGRESI (2026-09-28, ditemukan setelah sesi ini):** Dock tidak muncul sama sekali di `http://localhost:3000/preview/os-desktop`.
  - **Penyebab:** Perubahan `DockPortal` menjadi `if (!target) return null`. `GlobalDockSlot` (penerbit `target` via ref) hanya dipasang di `src/app/(site)/layout.tsx` dan `src/app/[siteSlug]/layout.tsx`; route `/preview/*` memakai **root layout** `src/app/layout.tsx` yang tidak punya `LayoutClient`. Akibatnya `target` selalu `null` → `DockPortal` mengembalikan `null` → `OSDock` yang dirender `UIOverlaysLayer.tsx` tidak pernah masuk DOM. Route `/`, `/projects`, dan site tenant tetap normal karena slot-nya ada, sehingga bug hanya terlihat di preview.
  - **Perbaikan:** `DockPortal` kembali me-render fallback berisi `children` saat `target` null. Supaya kekhawatiran asli (flicker/duplikat saat hydration) tetap tertutup, fallback **tidak memakai `id` dan tidak memakai `viewTransitionName`** — pada route ber-slot, ref slot baru terpasang di commit phase sehingga 1 frame pertama fallback hidup berdampingan dengan slot asli (duplikat `id` + duplikat `view-transition-name` membuat Chrome membuang pasangan snapshot VT). Kelas layout disatukan ke konstanta `DOCK_SLOT_CLASS` agar rect fallback = rect slot (tanpa lompatan 1 frame).
  - **Verifikasi (browser, localhost:3000):** `/preview/os-desktop` → `[data-dock-toolbar]` = 1, `#global-dock-slot` = 0, elemen `view-transition-name: global-dock` = 0 (tanpa duplikat), rect dock `x466 y485 w332 h72`. `/projects` → slot = 1, dock = 1, VT-named = 1, rect identik. Console tanpa error/warning React. `npx tsc --noEmit` = 0 error, `npx eslint src/components/layout/GlobalDockSlot.tsx` = 0 error.
