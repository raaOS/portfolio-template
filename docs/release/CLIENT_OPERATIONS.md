# Client Operations Guide

Panduan ini menjelaskan flow operasional setelah produk dijual ke client.

## Link Client

Untuk site dengan slug `urgent`:

- Public site: `https://domain-kamu.com/urgent`
- Public projects: `https://domain-kamu.com/urgent/projects`
- Panel kelola konten: `https://domain-kamu.com/admin/login`

Tidak ada halaman login per-site. Semua pembeli masuk lewat `/admin/login`
(setup awal lewat `/setup` membuat email + password admin).

## Membuat Client Baru

1. Order masuk lewat `/checkout` -> diverifikasi -> diaktifkan (site dibuat,
   link website dikirim via email). Site juga bisa dibuat langsung dari panel admin.
2. Pembeli membuka `/setup` sekali untuk membuat email + password panel.
3. Kirim ke pembeli:
   - link public site
   - link panel `/admin/login`
   - pengingat: kalau lupa password, minta owner reset
     (`npx tsx scripts/cloudflare/reset-customer-password.ts`)

## Notifikasi Email ke Pembeli

Email struk (saat order dibuat) dan email serah-terima (setelah pembayaran
diverifikasi & order aktif) dikirim lewat provider email generik:

```env
NOTIFICATION_PROVIDER="resend"
NOTIFICATION_API_KEY=""
NOTIFICATION_DEFAULT_FROM=""
NEXT_PUBLIC_SITE_URL="https://domain-kamu.com"
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

- akses Cloudflare;
- akses endpoint admin master;
- API token D1/R2;
- akses ke data client lain.

Master tetap bertanggung jawab atas quota, reset manual, suspend/activate, dan support override.
