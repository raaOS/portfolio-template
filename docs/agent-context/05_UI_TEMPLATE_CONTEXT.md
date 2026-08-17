# 05. UI Template Context

## Core Prinsip
UI Desktop OS sangat kompleks secara visual dan performa. **Jangan rewrite!**
Komponen lama akan tetap dipakai.

## Komponen Utama OS UI
- **Window System:** `Window.tsx`, dragging, resizing, z-index stacking.
- **Dock & Menu:** Animasi bouncy, hover effect.
- **Project Grid:** Menampilkan card dari data.
- **Project Detail:** Menampilkan komponen narrative & gallery image/video.

## State Visual Wajib
Selalu siapkan komponen untuk:
1. **Loading State:** Skeleton / spinner saat API di-fetch.
2. **Empty State:** Jika project kosong / belum ada.
3. **Error State:** Pesan gagal koneksi dengan tombol Retry.

## Feature Flags (Lite vs Pro)
Gunakan flag dari config atau `site.plan` untuk menyembunyikan/menampilkan fitur.
- **Lite:** Client tetap bisa login ke dashboard sederhana untuk edit profil/site, CRUD project terbatas, upload media terbatas, reorder, draft/publish, dan melihat quota.
- **Pro:** Semua fitur Lite ditambah custom domain, analytics/leads, AI copy/case study, testimonial manager, submission/approval workflow, quota lebih besar, dan opsi multi-user/team ringan.
- UI public template harus mengambil `site.plan`, `feature_flags`, dan `quota` dari API berbasis `siteSlug`; jangan hardcode asumsi single portfolio.

## Client UI Boundary
- UI client/pembeli hanya boleh memanggil endpoint client/site-scoped atau endpoint content yang resolve `siteId`.
- UI client tidak boleh memanggil endpoint master/platform seperti admin login, admin password/PIN, clear-cache, revalidate, health, settings platform, atau metrics internal.
- Route pembeli memakai pola tenant: login di `/[siteSlug]/login`, public site di `/[siteSlug]`, dan public project di `/[siteSlug]/projects`.
- Jangan membuat UI yang mengarahkan tenant ke route global seperti `/projects` jika sedang berada di site tenant; gunakan path tenant seperti `/${siteSlug}/projects`.
- Reset password client memakai flow self-service: tombol `Lupa Password` di login, request generic, email reset link, lalu form `/client/reset-password?token=...`.
- UI reset tidak boleh menampilkan token secara langsung dan tidak boleh memberi pesan yang membocorkan apakah email/site benar-benar terdaftar.
