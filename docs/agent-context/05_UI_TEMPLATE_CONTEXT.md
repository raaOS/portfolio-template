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
- UI public template membaca flag/quota dari konten D1 per deployment; rute API berbasis `siteSlug` (`/api/public/sites/*`) sudah dihapus.

## Client UI Boundary
- UI client/pembeli hanya boleh memanggil endpoint client/site-scoped atau endpoint content yang resolve `siteId`.
- UI client tidak boleh memanggil endpoint master/platform seperti admin login, admin password/PIN, clear-cache, revalidate, health, settings platform, atau metrics internal.
- Route pembeli: public site di `/`, public project di `/projects` (+ `/projects/:slug`). Tidak ada route login per-site; login panel ada di `/admin/login`.
- Rute tenant `/{slug}` & API public per-slug sudah dihapus (2026-10-07) — jangan buat UI yang membangun path per-slug.
