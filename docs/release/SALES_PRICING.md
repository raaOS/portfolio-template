# Sales & Pricing Guide

Dokumen ini adalah baseline komersial untuk menjual Portfolio OS Template. Angka harga final boleh disesuaikan, tetapi struktur harga dan aturan quota sebaiknya konsisten supaya support tidak kacau.

## Model Jual

Satu produk, satu kali beli lewat halaman pesan di website (tanpa langganan berulang):

- Pembeli mengisi form checkout (`/checkout`); slug website dibuat otomatis sistem dari nama pembeli.
- Sistem membuat order dengan nominal unik + QRIS/transfer, berlaku 24 jam.
- Pembeli upload bukti bayar di halaman order, lalu order diverifikasi admin.
- Setelah verifikasi, order diaktifkan: email "✅ Pembayaran Terverifikasi — Website Sedang Disiapkan" (ringkasan order + janji online maksimal 1×24 jam, TANPA link) dikirim ke email pembeli; kabar "🎉 Website Sudah Online" berikut URL `https://<slug>.workers.dev` dikirim otomatis oleh portal setelah deploy. Akses login diserahkan owner lewat WhatsApp saat serah terima (lihat support-playbook).
- Tidak ada tagihan bulanan/tahunan. Upgrade quota dijual sebagai add-on, bukan langganan.

Harga dasar disimpan di D1 (`platform_settings`, key `pricing_config`) dan bisa diubah owner kapan saja lewat panel admin **Harga Jual** (`/admin` → zona Sistem) tanpa deploy ulang — nominal order selalu dihitung server dari harga tersebut. `BASE_PRICE` di `src/constants/pricing.ts` (Rp199.000) tetap dipakai sebagai nilai cadangan bila belum pernah disimpan.

## Isi Paket

Semua pembeli mendapat paket yang sama:

- Dashboard kelola konten sendiri lewat `/admin/login`.
- CRUD project.
- Upload cover dan gallery sesuai quota.
- Preview/public site dengan slug sendiri.
- Reset password dibantu owner (tanpa self-service).
- Quota default dari env:
  - `PROJECT_LIMIT`
  - `STORAGE_MB`
  - `MEDIA_PER_PROJECT`
- Fitur opsional (AI, analytics, custom domain, notifikasi) mengikuti flag `FEATURE_*`, bukan tiers.

## Add-on Quota

Custom quota per site adalah sumber upsell yang aman karena sudah dicatat di D1 (`site_quota_overrides`).

Contoh add-on yang bisa dijual:

- Tambahan project limit.
- Tambahan storage R2.
- Tambahan media per project.

Aturan:

- Custom quota hanya menaikkan batas di atas default.
- Menurunkan quota harus ditolak jika usage client sudah melewati batas baru.
- Semua perubahan quota harus dicatat di catatan support internal.

## Payment & Licensing

Baseline paling praktis untuk awal:

- Pembayaran manual invoice (QRIS/transfer) lewat halaman order; tidak ada payment gateway otomatis.
- Status order: `pending_payment` -> `waiting_verification` -> `activated` (atau `expired`/`canceled`).
- Order yang tidak dibayar dalam 24 jam kedaluwarsa otomatis dan nominal dilepas.
- Site bisa di-suspend oleh admin jika ada masalah pembayaran.
- Source code tetap milik penjual kecuali kontrak menyatakan transfer ownership.
- Client mendapat akses dashboard dan public URL, bukan akses ke Cloudflare credential.

## Suggested Sales Copy

Portfolio OS adalah template portfolio interaktif berbasis Cloudflare. Pembeli login ke panel `/admin` untuk mengelola project sendiri, mengunggah media, melihat quota, dan membuka public site dengan slug masing-masing.

Cocok untuk portfolio kecil maupun client yang butuh quota lebih besar lewat add-on.

## Yang Tidak Dijanjikan Secara Default

- Pembayaran recurring otomatis / langganan.
- Payment gateway otomatis.
- Email marketing.
- CRM penuh.
- Multi-user/team enterprise.
- Custom integration pribadi tanpa scope baru.
- Migrasi data besar tanpa biaya tambahan.

## Pre-Sale Checklist

- Tentukan harga jual, harga setup, dan harga add-on quota.
- Tentukan apakah domain custom termasuk harga atau add-on.
- Tentukan SLA support.
- Pastikan jalur reset password owner-assisted (`scripts/cloudflare/reset-customer-password.ts`) dicoba sekali.
- Siapkan demo site bersih.
- Siapkan template invoice/manual payment.
- Jelaskan bahwa client mengelola konten lewat dashboard, bukan lewat akses Cloudflare.
