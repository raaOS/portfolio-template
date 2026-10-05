# 📱 Panduan Mengelola Klien Langsung dari HP (Tanpa Menyalakan PC)

> **Kabar Gembira:** Anda kini bisa mendaftarkan klien baru, memperbarui versi template portofolio, atau memasang custom domain langsung dari smartphone (Android / iPhone) kapan saja dan di mana saja tanpa perlu menyalakan komputer/laptop!

---

## 🚀 Cara Menggunakan dari HP (Hanya 3 Langkah Mudah)

### Langkah 1: Buka Menu Actions di HP
Anda bisa menggunakan salah satu dari dua cara berikut di HP Anda:
- **Cara A (Rekomendasi - Lewat Aplikasi):**
  Unduh aplikasi **GitHub** resmi dari Google Play Store (Android) atau App Store (iPhone). Buka aplikasi, masuk ke repositori **`portfolio-template`**, lalu pilih tab **Actions**.
- **Cara B (Lewat Browser HP):**
  Buka browser Chrome / Safari di HP Anda, lalu kunjungi alamat:  
  👉 **`https://github.com/raaOS/portfolio-template/actions`**

---

### Langkah 2: Jalankan Workflow "Pengelola Klien (Cloud Master)"
1. Pada daftar workflow, ketuk **`Pengelola Klien (Cloud Master)`**.
2. Ketuk tombol biru / tombol dropdown **`Run workflow`**.
3. Di layar HP Anda akan langsung muncul formulir input:

| Field Formulir | Keterangan Pengisian |
|---|---|
| **Pilih Tindakan / Aksi** | Pilih salah satu: <br>• `onboard_client` (Daftarkan Klien Baru)<br>• `update_template` (Update Versi Template)<br>• `custom_domain` (Pasang Custom Domain) |
| **Nama Lengkap Klien** | Masukkan nama klien (contoh: *Budi Pratama*) |
| **Slug Website** | Nama link subdomain (contoh: *budi-pratama*). Boleh dikosongkan agar dibuat otomatis. |
| **Pilihan Gaya Template** | Pilih `os-desktop` (macOS Mac) atau `infinite-canvas` (Kanvas 3D) |
| **Email Login Admin Klien** | Masukkan email klien untuk login ke `/admin` |
| **Cloudflare Account ID & API Token** | Masukkan kredensial Cloudflare milik klien |
| **Password Admin** | Boleh dikosongkan agar sistem membuatkan password acak yang aman otomatis |

4. Ketuk tombol hijau **`Run workflow`**!

---

### Langkah 3: Tunggu Beberapa Menit & Salin Pesan WhatsApp Klien
1. Server cloud GitHub (dengan RAM 16GB dan internet gigabit) akan otomatis menyala di cloud untuk:
   - Membuat Database D1 (`db-budi-pratama`)
   - Membuat Storage Media R2 (`media-budi-pratama`)
   - Memasang seluruh tabel database dan template
   - Build & mendeploy website ke Cloudflare Worker milik klien (proses build ini yang paling lama — total biasanya beberapa menit, sabar ya)
2. Setelah status centang hijau **✓** selesai, ketuk hasil eksekusi tersebut.
3. Pada halaman **Summary (Ringkasan)** di layar HP Anda, akan langsung tampil:
   - Link Website Klien
   - Link Ruang Admin Klien (`/admin`)
   - Email & Password Login
   - **Kotak Teks WhatsApp Siap Copy:** Tinggal sentuh dan tahan (copy), lalu paste langsung ke chat WhatsApp klien Anda!

---

## 💡 Fitur Tambahan: Mengunduh Berkas Kredensial Klien (Artifact)
Setiap kali Anda mendaftarkan klien dari HP, GitHub Actions otomatis membungkus berkas `config.env` dan `SURAT_SERAH_TERIMA.txt` ke dalam file zip privat (**Artifacts**) yang tersimpan di GitHub selama 7 hari (retensi sengaja dipendek karena berkas ini memuat kredensial klien — salinan utamanya selalu ada di folder `arsip-klien/` di laptop Anda). Anda bisa mengunduh file ini kapan saja langsung ke memori HP atau laptop Anda.
