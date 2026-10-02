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

## Feature Flags
Gunakan flag `FEATURE_*` (bukan tiers paket) untuk menyembunyikan/menampilkan fitur opsional.
- Client selalu bisa login ke dashboard untuk edit profil/site, CRUD project sesuai quota, upload media, reorder, draft/publish, dan melihat quota.
- Fitur opsional (custom domain, analytics/leads, AI copy/case study, testimonial manager, submission/approval workflow) aktif jika flag `FEATURE_*` terkait menyala.
- UI public template harus mengambil `feature_flags` dan `quota` dari API berbasis `siteSlug`; jangan hardcode asumsi single portfolio.

## Client UI Boundary
- UI client/pembeli hanya boleh memanggil endpoint client/site-scoped atau endpoint content yang resolve `siteId`.
- UI client tidak boleh memanggil endpoint master/platform seperti admin login, admin password/PIN, clear-cache, revalidate, health, settings platform, atau metrics internal.
- Route pembeli memakai pola tenant: login di `/[siteSlug]/login`, public site di `/[siteSlug]`, dan public project di `/[siteSlug]/projects`.
- Jangan membuat UI yang mengarahkan tenant ke route global seperti `/projects` jika sedang berada di site tenant; gunakan path tenant seperti `/${siteSlug}/projects`.
