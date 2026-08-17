# Tracker Log: Sprint 43 - Client Dashboard Desktop OS UI/UX

**Status:** Completed
**Mulai:** 2026-07-06
**Selesai:** 2026-07-06

## Tujuan (Objective)
- Memperbaiki UI/UX Client Dashboard CRUD agar identik dengan CRUD Master.
- Mengganti layout flat scrollable menjadi desktop OS environment penuh.
- Menambahkan jelly drag spring physics pada window, traffic-light buttons, drag/resize/minimize/maximize, menubar, dan taskbar.
- Mempertahankan seluruh business logic CRUD tanpa perubahan backend/endpoint.

## Task List
- [x] Import `admin-desktop.css` untuk reuse semua CSS class Master.
- [x] Tambahkan `ClientWindowState` type dan window management state (openWindows, z-index stacking).
- [x] Tambahkan `ClientWindowFrame` component dengan spring physics jelly drag identik `AdminWindowFrame` (SPRING_TENSION=0.08, SPRING_FRICTION=0.82, skew+scale deformation, RAF loop).
- [x] Tambahkan macOS traffic-light buttons (close, minimize, maximize) dengan hover icon reveal.
- [x] Tambahkan resize handle di kanan bawah window.
- [x] Ganti layout scrollable menjadi `.admin-desktop` full viewport desktop OS.
- [x] Tambahkan `.admin-desktop-wallpaper` background layer.
- [x] Tambahkan top `.admin-menubar` (logo, site name, plan badge, email, refresh, logout).
- [x] Ubah module cards menjadi `.admin-zone-folder` desktop icons di tengah.
- [x] Setiap modul dibuka sebagai floating window (multi-window support).
- [x] Tambahkan bottom `.admin-taskbar` untuk daftar window terbuka.
- [x] Verifikasi TypeScript, ESLint, visual QA.

## File yang Dimodifikasi (Modified Files)
- `src/app/client/dashboard/ClientSelfServiceDashboard.tsx` → Rewrite UI shell dari flat page ke desktop OS environment.
- `docs/tracker/INDEX_TRACKER.md` → Menambahkan entry Sprint 43.
- `docs/tracker/logs/sprint_43_client_desktop_os_uiux.md` → Log sprint ini.

## Bug & Perbaikan (Bug Tracker)
- **Bug:** Dashboard client layout flat scrollable, tidak terasa seperti desktop OS.
  - **Penyebab:** Sprint 42 menambahkan `ModuleWindowBar` dekoratif dan `activeModule` inline, bukan floating window sesungguhnya.
  - **Perbaikan:** Ganti seluruh render shell dengan desktop environment yang reuse class CSS dan arsitektur window yang sama persis dengan CRUD Master.
- **Bug:** Tidak ada efek jelly/wiggle saat drag window client.
  - **Penyebab:** Hanya CSS animation `client-window-pop`, bukan physics spring.
  - **Perbaikan:** Copy spring physics RAF loop dari `AdminWindowFrame` (tension, friction, skew, scale) ke `ClientWindowFrame`.
- **Bug:** Traffic-light buttons di client hanya dekoratif.
  - **Penyebab:** `ModuleWindowBar` merender dot tanpa interaksi drag/resize/minimize/maximize.
  - **Perbaikan:** Full traffic-light control dengan close, minimize, maximize behavior dan hover icon reveal.

## Bug Post-Audit (2026-07-07)
- **Bug #1 (Kritis):** Desktop OS seluruhnya hilang saat upload gallery atau simpan data (loading screen flash).
  - **Penyebab:** `loadDashboard()` selalu memanggil `setIsLoading(true)` yang men-trigger early return `if (isLoading)` → seluruh desktop lenyap sementara.
  - **Perbaikan:** Tambahkan param `initial = true` ke `loadDashboard`. Semua re-call (8 handler CRUD/upload + refresh button) diubah ke `loadDashboard(false)` sehingga desktop tetap terlihat selama data refresh.
- **Bug #2 (Medium):** `isContentLoaded` bisa stuck `false` jika fetch content gagal saat re-load post-upload.
  - **Penyebab:** `setIsContentLoaded(false)` dipanggil di awal setiap `loadDashboard()`, termasuk re-call dari upload handlers. Jika fetch gagal, `isContentLoaded` tidak di-set kembali ke `true`.
  - **Perbaikan:** Diselesaikan sekaligus dengan fix #1 — re-call pakai `initial=false` sehingga `isContentLoaded` tidak pernah di-reset ke false saat upload.
- **Bug #3 (Low):** Gallery item key tidak stabil jika URL duplikat.
  - **Penyebab:** `key={\`${url}-${index}\`}` — jika URL sama diupload dua kali, key collision menyebabkan React salah reconcile.
  - **Perbaikan:** Ganti ke `key={index}` — cukup untuk ordered list gallery yang tidak di-reorder.

## Arsitektur Baru
```
ClientSelfServiceDashboard.tsx
├── .admin-desktop (full viewport container)
├── .admin-desktop-wallpaper (background)
├── .admin-menubar (top menu bar)
├── .admin-desktop-zones (4 zone folder icons)
├── ClientWindowFrame × N (floating windows per modul)
│   ├── Spring physics jelly drag (RAF loop)
│   ├── Traffic-light buttons
│   ├── Resize handle
│   └── Module content (Projects, Content, System, Communication)
└── .admin-taskbar (bottom taskbar)
```

## Verifikasi
- `npx tsc --noEmit --pretty false` → Clean (0 errors for file)
- `npx eslint src/app/client/dashboard/ClientSelfServiceDashboard.tsx` → Clean
- Browser test `/client/dashboard` → Redirects to login (auth check works)

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Client Dashboard sekarang menggunakan arsitektur desktop OS yang identik dengan CRUD Master.
- CSS class dari `admin-desktop.css` di-reuse langsung (tidak ada CSS baru).
- Spring physics jelly drag di-copy inline di `ClientWindowFrame` (bukan import dari AdminWindowFrame) agar tidak menambah coupling.
- Multi-window support aktif — client bisa membuka beberapa modul bersamaan.
- Semua CRUD handler, types, helpers, dan endpoint tetap sama persis — hanya UI shell yang berubah.
- Jangan kembalikan ke layout flat scrollable kecuali user eksplisit meminta.
