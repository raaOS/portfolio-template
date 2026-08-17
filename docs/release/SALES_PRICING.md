# Sales & Pricing Guide

Dokumen ini adalah baseline komersial untuk menjual Portfolio OS Template. Angka harga final boleh disesuaikan, tetapi struktur paket, quota, dan aturan upgrade sebaiknya konsisten supaya support tidak kacau.

## Model Jual yang Direkomendasikan

Gunakan model managed subscription per site:

- Client membayar biaya setup awal jika kamu membantu onboarding/konten awal.
- Client membayar biaya bulanan/tahunan untuk hosting, maintenance ringan, quota, dan akses dashboard.
- Upgrade quota dijual sebagai add-on, bukan dibuat gratis permanen tanpa pencatatan.
- Pembayaran awal bisa manual invoice. Otomasi payment gateway bisa menjadi sprint terpisah setelah produk stabil.

## Paket Lite

Untuk portfolio kecil dan client yang hanya butuh tampil online cepat.

- Dashboard client self-service.
- CRUD project.
- Upload cover dan gallery dalam quota.
- Preview/public site.
- Reset password client self-service via email.
- Quota default dari env:
  - `PLAN_LITE_PROJECT_LIMIT`
  - `PLAN_LITE_STORAGE_MB`
  - `PLAN_LITE_MEDIA_PER_PROJECT`
- Tidak termasuk AI, analytics lanjutan, custom domain otomatis, dan testimonial manager Pro.

## Paket Pro

Untuk client yang butuh portfolio lebih berat atau layanan lebih managed.

- Semua fitur Lite.
- Quota lebih besar.
- Testimonial manager/WhatsApp-style testimonial.
- Gallery video.
- Opsional AI copy/case study jika `FEATURE_AI=true`.
- Opsional analytics/leads/custom domain jika feature flag terkait aktif.
- Cocok untuk add-on maintenance, content support, atau priority support.

## Add-on Quota

Custom quota per site adalah sumber upsell yang aman karena sudah dicatat di D1.

Contoh add-on yang bisa dijual:

- Tambahan project limit.
- Tambahan storage R2.
- Tambahan media per project.
- Upgrade Lite ke Pro.
- Paket video gallery.

Aturan:

- Custom quota hanya menaikkan batas di atas default plan.
- Menurunkan quota harus ditolak jika usage client sudah melewati batas baru.
- Semua perubahan quota harus dicatat di billing/support note internal.

## Payment & Licensing

Baseline paling praktis untuk awal:

- Manual invoice untuk setup dan subscription.
- Billing status dicatat di Master Dashboard: `trialing`, `active`, `past_due`, `canceled`.
- Site bisa di-suspend jika pembayaran lewat jatuh tempo sesuai aturan bisnis kamu.
- Source code tetap milik penjual kecuali kontrak menyatakan transfer ownership.
- Client mendapat akses dashboard dan public URL, bukan akses ke Cloudflare credential.

## Suggested Sales Copy

Portfolio OS adalah template portfolio interaktif multi-site berbasis Cloudflare. Client bisa login, mengelola project sendiri, mengunggah media, melihat quota, dan membuka public site dengan slug masing-masing.

Lite cocok untuk portfolio kecil. Pro cocok untuk client yang butuh quota lebih besar, testimonial manager, video gallery, dan opsi integrasi lanjutan.

## Yang Tidak Dijanjikan Secara Default

- Payment gateway otomatis.
- Email marketing.
- CRM penuh.
- Multi-user/team enterprise.
- Custom integration pribadi tanpa scope baru.
- Migrasi data besar tanpa biaya tambahan.

## Pre-Sale Checklist

- Tentukan harga Lite, Pro, setup, dan add-on quota.
- Tentukan apakah domain custom termasuk paket atau add-on.
- Tentukan SLA support.
- Pastikan provider email reset password sudah aktif.
- Siapkan demo site bersih.
- Siapkan template invoice/manual payment.
- Jelaskan bahwa client mengelola konten lewat dashboard, bukan lewat akses Cloudflare.
