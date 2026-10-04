# Client Operations Guide

Panduan ini menjelaskan flow operasional setelah produk dijual ke client.

## Link Client

Setiap klien = 1 deployment sendiri di akun Cloudflare milik klien (contoh slug `urgent`):

- Public site: `https://<slug>.workers.dev` (atau custom domain klien)
- Panel kelola konten: `https://<slug>.workers.dev/admin/login`

Tidak ada halaman login per-site, dan tidak ada path `/<slug>` di depan halaman —
satu deployment sudah dikhususkan untuk satu klien. Semua login lewat `/admin/login`
(email + password admin sudah di-seed portal onboarding, tercatat di
`arsip-klien/<slug>/config.env` dan di API portal `/api/clients`).
`/setup` bukan bagian alur normal: `POST /api/setup` membalas 400 kalau admin sudah ada.

## Membuat Client Baru

1. Order masuk lewat `/checkout` -> diverifikasi -> diaktifkan (tiket kerja masuk ke
   Telegram admin; lihat `docs/operations/BENGKEL_HANDOFF.md`).
2. Onboarding lewat portal `PENGELOLA_KLIEN.bat` (Tab "Pendaftaran Klien Baru"):
   Account ID + API Token dari akun Cloudflare klien -> provisioning D1 `db-<slug>` dan
   R2 `media-<slug>` -> seed row site + admin user -> deploy.
3. Kirim ke klien:
   - link public site
   - link panel `/admin/login`
   - email + password admin dari `arsip-klien/<slug>/config.env` (kirim lewat jalur privat)
   - pengingat: kalau lupa password, minta owner reset
     (`npx tsx scripts/cloudflare/reset-customer-password.ts`)

## Notifikasi Email ke Pembeli

Email struk (saat order dibuat) dan email serah-terima (setelah pembayaran
diverifikasi & order aktif) dikirim lewat provider email generik:

```env
NOTIFICATION_PROVIDER="resend"
NOTIFICATION_API_KEY=""
NOTIFICATION_DEFAULT_FROM=""
NEXT_PUBLIC_SITE_URL="https://<slug>.workers.dev"
```

Tanpa keempat nilai tersebut, pembeli tidak menerima email sama sekali.

## Flow Project Client

Pembeli mengelola project sendiri lewat panel `/admin` (menu Content & Berkas):

- membuat project baru;
- mengedit title, slug, status, dan metadata;
- upload cover;
- upload gallery image/video sesuai quota;
- publish/unpublish project;
- melihat preview public site setelah ada project published.

Semua self-service lewat panel. Beda kapasitas hanya pada quota site masing-masing.

## Preview Site

Preview public site aktif jika:

- site status `active`;
- site punya minimal 1 project `published`;
- public slug valid;
- media project tersedia di R2.

Jika project masih kosong, UI menampilkan empty state dan tombol tambah project.

## Support Checklist

Saat client melapor error:

- cek site status (`active` atau `suspended`);
- cek status site (active/suspended);
- cek quota project/storage/media;
- cek apakah pembeli masuk lewat `/admin/login` dengan email yang benar;
- cek apakah media berada di prefix `sites/{siteId}/...`;
- cek quota override site jika fitur tidak muncul;
- reset password dari komputermu kalau pembeli lupa (tanpa self-service).

## Boundary

Client tidak mendapat:

- akses Cloudflare (token tetap di `arsip-klien/<slug>/config.env` milik owner);
- akses portal owner (`PENGELOLA_KLIEN.bat`);
- API token D1/R2;
- akses ke data client lain (setiap client punya deployment sendiri).

Owner tetap bertanggung jawab atas quota, reset manual, suspend/activate, dan support override.
