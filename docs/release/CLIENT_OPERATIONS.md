# Client Operations Guide

Panduan ini menjelaskan flow operasional setelah produk dijual ke client.

## Link Client

Untuk site dengan slug `urgent`:

- Public site: `https://domain-kamu.com/urgent`
- Public projects: `https://domain-kamu.com/urgent/projects`
- Login client: `https://domain-kamu.com/urgent/login`
- Dashboard client: `https://domain-kamu.com/client/dashboard`

Alias `/urgent/login` mengisi site slug otomatis lalu mengarah ke login client.

## Membuat Client Baru

Di Master Dashboard:

1. Buat `Client/Site Baru`.
2. Isi site name dan public slug.
3. Buat client access:
   - email client
   - password awal
   - status `active`
4. Kirim ke client:
   - link login `/[siteSlug]/login`
   - email akses
   - password awal

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

Client bisa:

- membuat project baru;
- mengedit title, slug, status, dan metadata;
- upload cover;
- upload gallery image/video sesuai quota;
- publish/unpublish project;
- melihat preview public site setelah ada project published.

Semua client self-service. Beda kapasitas hanya pada quota site masing-masing.

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
- cek apakah client login dengan slug yang benar;
- cek apakah media berada di prefix `sites/{siteId}/...`;
- cek quota override site jika fitur tidak muncul;
- cek provider email jika reset password tidak sampai.

## Boundary

Client tidak mendapat:

- akses Cloudflare;
- akses endpoint admin master;
- API token D1/R2;
- akses ke data client lain.

Master tetap bertanggung jawab atas quota, reset manual, suspend/activate, dan support override.
