# Buyer Onboarding Checklist

Status: Sprint 48 operational baseline.

Checklist ini untuk operator yang meng-onboard buyer baru ke Portfolio OS Template. Ikuti langkah berurutan. Jangan membagikan password, token, atau API key ke dokumen publik.

## Prasyarat

- Akses admin aktif (sudah login ke `/admin`).
- Master Dashboard tersedia (`FEATURE_MASTER_DASHBOARD=true`).
- Notification provider sudah dikonfigurasi jika ingin mengirim email reset password otomatis.

## Checklist

### 1. Buat Site Baru

- [ ] Buka Master Dashboard → klik **Client/Site Baru**.
- [ ] Isi:
  - **Nama site**: nama bisnis/portfolio buyer.
  - **Slug**: URL-friendly identifier (contoh: `studio-andi`). Akan menjadi `<domain>/<slug>`.
  - **Plan**: pilih `lite` atau `pro` sesuai paket yang dibeli.
- [ ] Klik **Simpan**.
- [ ] Catat **Site ID** dan **Slug** yang sudah terbuat.

### 2. Set Client Access

- [ ] Di Master Dashboard → klik site yang baru dibuat → bagian **Client Access**.
- [ ] Isi:
  - **Email**: email buyer yang akan dipakai login.
  - **Password**: password sementara yang kuat (minimal 8 karakter).
- [ ] Klik **Simpan**.

### 3. Kirim Kredensial ke Buyer

- [ ] Kirim informasi berikut ke buyer (via email/chat pribadi, BUKAN publik):
  - URL login: `<domain>/<slug>/login`
  - Email: (yang sudah didaftarkan)
  - Password sementara: (yang sudah di-set)
  - Instruksi: "Silakan login, lalu segera ubah password Anda melalui menu reset password."
- [ ] Jangan kirim password via channel yang bisa diakses publik.

### 4. Verifikasi Buyer Bisa Login

- [ ] Minta buyer konfirmasi bahwa mereka sudah berhasil login.
- [ ] Jika gagal, lihat [support-playbook.md](file:///c:/Users/USER/Documents/portfolio-template/docs/operations/support-playbook.md) bagian "Client Tidak Bisa Login".

### 5. Buyer Isi Profil

- [ ] Buyer membuka Client Dashboard setelah login.
- [ ] Buyer mengisi konten profil melalui modul yang tersedia:
  - Profil / About (Lite & Pro)
  - Kontak (Lite & Pro)
  - Pengalaman / Hard Skills (Lite & Pro)
  - Pengaturan Sistem / Tampilan (Pro only)
  - Testimoni (Pro only)

### 6. Buyer Buat Project Pertama

- [ ] Buyer klik **Tambah Project** di Client Dashboard.
- [ ] Buyer isi judul, deskripsi, dan upload cover image.
- [ ] Buyer tambahkan gallery image dan/atau video jika diinginkan.
- [ ] Buyer klik **Publish**.

### 7. Verifikasi Site Public

- [ ] Buka `<domain>/<slug>` di browser.
- [ ] Pastikan:
  - [ ] Desktop environment tampil.
  - [ ] Project yang di-publish muncul.
  - [ ] Cover image dimuat dengan benar.
  - [ ] Gallery/video (jika ada) bisa dibuka.

### 8. Opsional: Custom Quota

Jika buyer memerlukan quota di luar default plan:

- [ ] Buka Master Dashboard → site → bagian **Quota Override**.
- [ ] Set custom values:
  - Project limit
  - Storage (MB)
  - Media per project
- [ ] Klik **Simpan**.

### 9. Selesai

- [ ] Buyer sudah bisa mengelola site sendiri melalui Client Dashboard.
- [ ] Informasikan buyer bahwa mereka bisa menghubungi support jika ada masalah.
- [ ] Simpan catatan onboarding (tanggal, site slug, plan) untuk referensi internal.

## Catatan

- Jangan buat lebih dari satu client access per site kecuali memang dibutuhkan.
- Jika buyer membeli plan Pro, pastikan plan di Master Dashboard sudah benar sebelum mengirim kredensial.
- Reset password self-service hanya tersedia jika `FEATURE_CLIENT_PASSWORD_RESET=true` dan notification provider aktif.
