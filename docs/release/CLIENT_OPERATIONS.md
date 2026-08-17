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
3. Pilih plan Lite atau Pro.
4. Atur billing status dan period end.
5. Buat client access:
   - email client
   - password awal
   - status `active`
6. Kirim ke client:
   - link login `/[siteSlug]/login`
   - email akses
   - password awal
   - instruksi reset password

## Reset Password Client

Ada dua jalur:

1. Self-service client:
   - Client buka `/[siteSlug]/login`.
   - Klik `Lupa Password`.
   - Isi site slug dan email.
   - Sistem mengirim reset link ke email jika akses cocok.
   - Client membuat password baru di `/client/reset-password?token=...`.

2. Master override:
   - Master buka site di dashboard.
   - Isi field `Reset password`.
   - Simpan client access.
   - Gunakan ini hanya untuk support manual.

Reset self-service production membutuhkan provider email:

```env
FEATURE_CLIENT_PASSWORD_RESET="true"
NOTIFICATION_PROVIDER="resend"
NOTIFICATION_API_KEY=""
NOTIFICATION_DEFAULT_FROM=""
NEXT_PUBLIC_SITE_URL="https://domain-kamu.com"
```

## Flow Project Client

Client bisa:

- membuat project baru;
- mengedit title, slug, status, dan metadata;
- upload cover;
- upload gallery image/video sesuai plan dan quota;
- publish/unpublish project;
- melihat preview public site setelah ada project published.

Lite dan Pro sama-sama self-service. Beda utamanya ada di quota dan fitur Pro.

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
- cek billing status;
- cek quota project/storage/media;
- cek apakah client login dengan slug yang benar;
- cek apakah media berada di prefix `sites/{siteId}/...`;
- cek plan Lite/Pro jika fitur tidak muncul;
- cek provider email jika reset password tidak sampai.

## Boundary

Client tidak mendapat:

- akses Cloudflare;
- akses endpoint admin master;
- API token D1/R2;
- akses ke data client lain.

Master tetap bertanggung jawab atas plan, quota, billing metadata, reset manual, suspend/activate, dan support override.
