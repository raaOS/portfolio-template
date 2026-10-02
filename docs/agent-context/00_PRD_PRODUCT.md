# 00. PRD Product Context

## Ringkasan Produk
Produk yang dibangun adalah **Portfolio OS Template**: sistem portfolio multi-client dengan tampilan desktop OS dan CRUD Master berbasis **full Cloudflare**.

## Keputusan Arsitektur Terkunci
- Target hosting dan backend adalah **Cloudflare-only**: Cloudflare Pages/Workers untuk aplikasi/API, Cloudflare D1 untuk data relasional, dan Cloudflare R2 untuk media.
- Jangan merancang fitur baru dengan asumsi Vercel sebagai deployment target. Referensi Vercel yang masih ada di repo adalah legacy/migration debt sampai dibersihkan.
- Model produk adalah **multi-site / multi-tenant single platform**, bukan 1 pembeli = 1 deployment project.
- Repo template public dan repo CRUD Master boleh dipisah, tetapi keduanya harus berbagi kontrak `site_id`, `siteSlug`, D1, dan R2 yang sama.

## Masalah yang Diselesaikan
- Kreator butuh portfolio premium, bukan sekadar landing page.
- Mengelola banyak klien lebih mudah lewat satu CRUD master.
- Biaya operasional harus bisa dikontrol, Firebase dieliminasi karena potensi biaya yang tak terduga.

## Target User
- **Client (pembeli)**: Self-service lewat panel `/admin` (login `/admin/login`, dashboard `/admin/client-dashboard`). Bisa mengedit profil/site, membuat/mengedit/menghapus project sendiri dalam batas quota, upload/ganti media, reorder project, dan publish/draft project miliknya. Fitur opsional (custom domain, AI, analytics, testimonial manager) mengikuti flag `FEATURE_*`. Tidak ada login per-site dan tidak ada reset password self-service.
- **Admin Master**: Mengelola banyak `site_id`, membuat site client, mengatur status site dan quota/feature flags, suspend/activate, reset akses, melihat usage storage, override data jika client minta bantuan, dan audit.
- **Visitor**: Melihat desktop portfolio dengan project detail & narasi.

## MVP Definition (Minimum Viable Product)
- 1 Dashboard Master -> Membuat 1 site client dan menentukan status serta quota-nya.
- 1 Dashboard Client -> pembeli self-service edit profil/site dan CRUD project sesuai quota lewat `/admin/client-dashboard`.
- Upload media ke Cloudflare R2.
- Membuat 2 project (draft -> publish).
- Template OS menampilkan site + project dari public API berdasarkan `siteSlug`.
- **Non-Goals MVP:** Billing otomatis, integrasi WhatsApp API resmi, custom domain otomatis penuh, marketplace template, dan migrasi massal client lama.
