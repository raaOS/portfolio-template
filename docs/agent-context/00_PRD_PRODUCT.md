# 00. PRD Product Context

## Ringkasan Produk
Produk yang dibangun adalah **Portfolio OS Template**: template portfolio dengan tampilan desktop OS, dijual dengan model **managed service** — 1 klien = 1 instalasi di akun Cloudflare milik klien. Harga tunggal **Rp199.000** (tanpa paket Lite/Pro, tanpa langganan).

## Keputusan Arsitektur Terkunci
- Target hosting dan backend adalah **Cloudflare-only**: Cloudflare Pages/Workers untuk aplikasi/API, Cloudflare D1 untuk data relasional, dan Cloudflare R2 untuk media.
- Jangan merancang fitur baru dengan asumsi Vercel sebagai deployment target. Referensi Vercel yang masih ada di repo adalah legacy/migration debt sampai dibersihkan.
- Model produk adalah **managed service: 1 klien = 1 akun Cloudflare milik klien**. Owner mendaftarkan Gmail klien, mengambil Account ID & API Token dari akun Cloudflare klien, lalu menginputnya di portal `PENGELOLA_KLIEN.bat` (`localhost:4567`) — portal itu yang melakukan provisioning D1 + R2 **di akun klien** dan deploy ke akun klien.
- Bukan platform multi-site di satu akun, dan bukan "satu dashboard untuk banyak pembeli": **tidak ada Master Dashboard multi-klien**, dan **tidak ada pembelian/pengelolaan site dari dalam panel admin**.
- Pengelolaan isi situs dilakukan klien sendiri dengan login `/admin` di situs miliknya; kredensial disimpan owner di `arsip-klien/<slug>/config.env`.
- Tooling onboarding owner memakai akun Cloudflare milik owner (untuk bootstrap/monitoring), terpisah dari akun Cloudflare per klien.

## Masalah yang Diselesaikan
- Kreator butuh portfolio premium, bukan sekadar landing page.
- Setiap klien mendapat instalasi mandiri: database, storage, dan deployment terpisah di akun Cloudflare miliknya sendiri.
- Setup teknis (D1, R2, skema tabel, build, deploy) dikerjakan sekali lewat portal — klien tidak perlu menyentuh Cloudflare.
- Biaya operasional harus bisa dikontrol; Firebase dieliminasi karena potensi biaya yang tak terduga.

## Target User
- **Owner (penjual):** Onboarding klien baru lewat portal `PENGELOLA_KLIEN.bat`, maintenance lewat Wrangler CLI, dan reset password klien via `scripts/cloudflare/reset-customer-password.ts`.
- **Klien (pembeli):** Self-service lewat panel `/admin` (login `/admin/login` di situsnya sendiri, kredensial dari `arsip-klien/<slug>/config.env`). Bisa mengedit profil/site, membuat/mengedit/menghapus project sendiri dalam batas quota, upload/ganti media, reorder project, dan publish/draft project miliknya. Fitur opsional (custom domain, AI, analytics, testimonial manager) mengikuti flag `FEATURE_*`. Tidak ada reset password self-service.
- **Visitor:** Melihat desktop portfolio dengan project detail & narasi.

## MVP Definition (Minimum Viable Product)
- Onboarding via portal `PENGELOLA_KLIEN.bat`: provisioning D1 + R2 di akun klien, penanaman skema + admin user, lalu build & deploy ke akun klien.
- Panel `/admin` per situs → klien self-service edit profil/site dan CRUD project sesuai quota.
- Upload media ke Cloudflare R2 (path selalu `sites/{siteId}/...`).
- Membuat project (draft -> publish).
- Template OS menampilkan site + project berdasarkan `siteSlug` (dibaca langsung dari D1 lewat `siteDataAdapter`; kontrak HTTP read-only tersedia di `/api/public/sites/:siteSlug*`).
- **Non-Goals MVP:** Master Dashboard multi-klien, pembuatan/pembelian/pengelolaan site dari dalam panel admin, paket Lite/Pro, langganan/billing otomatis, integrasi WhatsApp API resmi, custom domain otomatis penuh, marketplace template, dan migrasi massal klien lama.
