# 📘 Panduan untuk Kamu (Owner / Penyedia Jasa Web)

> **Catatan:** Panduan ini dibuat khusus dengan bahasa sehari-hari tanpa istilah koding yang bikin pusing. Simpan panduan ini sebagai pegangan setiap kali ada klien baru yang memesan website portofolio ke kamu.

---

## 💡 Konsep Dasar (Biar Kamu Paham Gambar Besarnya)

Kamu di sini bertindak seperti **developer / kontraktor** yang membangun rumah. Klien kamu adalah **pemilik rumah** yang tinggal terima kunci.

- **1 Klien = 1 Akun Cloudflare Sendiri:**
  Setiap klien punya "rumah" sendiri. Akun Cloudflare standar itu gratis dan kapasitasnya sangat besar untuk portofolio. Jadi kamu tidak perlu keluar biaya langganan bulanan dari kantongmu sendiri.
- **Klien Mengisi Datanya Sendiri:**
  Setelah website dipasang, kamu **tidak perlu** menginput foto proyek atau teks biodata klien satu per satu. Klien punya ruang admin sendiri yang sangat gampang dipakai (seperti pakai laptop Mac).

---

## 🚀 Alur Kerja Saat Ada Klien Baru Memesan

Ketika ada klien memesan jasa website portofolio ini, ikuti **3 langkah mudah** berikut:

```
[LANGKAH 1]                [LANGKAH 2]                [LANGKAH 3]
Minta Data Singkat  ───►  Pasang ke Cloudflare  ───►  Kirim Kunci ke Klien
(Nama & Domain)           (Sekali di awal)            (Klien isi sendiri)
```

---

### Langkah 1: Siapkan Informasi Klien
Cukup tanyakan 2 hal ini ke klien:
1. **Nama Lengkap / Nama Portofolio** (contoh: *Budi Pratama - Fotografer*)
2. **Nama Domain / Alamat Website yang diinginkan** (contoh: *budipratama.com* atau subdomain gratisan dari Cloudflare).

---

### Langkah 2: Pasang Website Klien Secara Otomatis (1-Klik Tanpa Terminal!)
*Kamu TIDAK PERLU mengetik perintah terminal atau pusing membuka file kode:*

1. Buatkan akun Cloudflare gratis untuk klien (cukup daftar di `dash.cloudflare.com`).
2. Di folder proyek ini (atau Desktop laptop kamu), cukup **Double-Click (Klik Dua Kali)** file:
   👉 **`PENGELOLA_KLIEN.bat`**
3. Browser Google Chrome akan otomatis terbuka menampilkan portal kontrol visual yang ramah:
   - Masukkan **Nama Klien** (misal: *Budi Pratama*).
   - Pilih gaya template: **macOS Desktop OS** atau **Infinite Canvas**.
   - Masukkan **Account ID** & **API Token** Cloudflare klien (ada panduan bergambarnya di layar).
4. Klik tombol: **`🚀 PROSES OTOMATIS SEKARANG`**.
5. Sistem otomatis membuat database D1, storage R2, migrasi tabel, dan mengarsipkan file ke folder `arsip-klien/` di laptop kamu secara rapi dalam waktu ~30 detik!
6. Setelah selesai, klik tombol **"📋 Salin Pesan WhatsApp untuk Klien"**.

---

### Langkah 3: Serahkan Website ke Klien
Setelah websitenya online, tugas teknis kamu sudah selesai! Sekarang tinggal berikan link website, link ruang admin, dan kredensial login (email + password yang tercetak di `arsip-klien/<slug>/SURAT_SERAH_TERIMA.txt` / `config.env`) ke klien.

Kamu tinggal copy-paste pesan WhatsApp di bawah ini:

---

## 💬 Template Chat WhatsApp untuk Dikirim ke Klien

> *(Tinggal copy teks di bawah ini dan ganti tulisan di dalam tanda kurung siku)*

```text
Halo kak [Nama Klien]! 👋
Website portofolio interaktif kamu sudah resmi aktif dan siap dipakai! 🚀

🌐 Website Kamu:
https://[slug-klien].pages.dev

🔐 Ruang Admin Pribadi (untuk kelola karya, foto, & profil):
https://[slug-klien].pages.dev/admin
Email    : [email login]
Password : [password admin]

Semua foto, video karya, dan kontak bisa kamu tambahkan sendiri dengan sangat mudah di ruang admin. Selamat berkarya dan sukses selalu! 🎉✨
```

> Pesan di atas **sama persis** dengan template resmi yang disimpan portal ke
> `arsip-klien/<slug>/SURAT_SERAH_TERIMA.txt` (`scripts/onboarding/server.ts:256-269`).
> Kalau klien sudah pasang custom domain, ganti `https://[slug-klien].pages.dev` dengan
> alamat domain klien. **Klien tidak perlu membuka `/setup`** — email + password sudah
> dibuatkan portal onboarding.

*(Jangan lupa kirimkan juga file `PANDUAN_UNTUK_KLIEN.md` yang ada di folder ini ke klien kamu, bisa dikirim dalam bentuk teks atau diekspor ke PDF).*

---

## ❓ Tanya Jawab Umum (FAQ untuk Kamu)

### 1. Bagaimana jika klien lupa password akun mereka?
Tidak ada reset mandiri untuk klien. Portal onboarding sudah membuatkan akun admin, jadi halaman `/setup` bukan bagian alur normal (endpoint-nya menolak dengan **400** selama admin sudah ada). Reset dilakukan manual dari komputermu dengan perintah: `npx tsx scripts/cloudflare/reset-customer-password.ts <folder-arsip> --email admin@klien.com --generate` (ganti `<folder-arsip>` dengan nama folder klien di `arsip-klien/`, dan `--generate` akan membuat password baru yang tinggal kamu kirimkan ke klien).

### 2. Apakah ada biaya bulanan yang harus saya bayar?
Tidak ada untuk skala normal. Cloudflare memberikan kuota gratis yang sangat besar (jutaan request per bulan dan penyimpanan database D1 yang cukup untuk ratusan portofolio standar).

### 3. Ada berapa template yang tersedia dan apakah CRUD-nya berbeda?
**ARSITEKTUR TERBAIK: 1 Pusat CRUD (Desktop Mac) untuk 2 Gaya Tampilan Pengunjung!**

| Fitur / Template | 🍏 Tema 1: `os-desktop` (macOS Desktop) | 🌌 Tema 2: `infinite-canvas` (3D Canvas) |
| :--- | :--- | :--- |
| **Konsep Tampilan** | Simulasi laptop Mac interaktif (Menu Bar, Dock, Wallpaper video bergerak, efek suara klik, jendela aplikasi). | Kanvas spasial futuristik melayang tanpa batas (bisa di-zoom in/out, di-pan/geser, dan ada HUD navigasi kompas). |
| **Pusat Pengelolaan (CRUD)** | **Terpusat di Desktop Mac (`/admin`)** | **Terpusat di Desktop Mac (`/admin`)** |
| **Data yang Ditampilkan** | Menampilkan seluruh modul lengkap: *About, Projects, Experience, Skills, Testimoni, Kontak*. | Menampilkan 100% data terintegrasi: *Profil, Galeri Proyek (+ Modal Detail), Riwayat Karir, Keahlian Teknis, dan Kontak*. *(Otomatis disinkronkan tanpa perlu input ulang).* |
| **Ruang Kerja CRUD** | **`https://[domain-klien.com]/admin`** | **`https://[domain-klien.com]/admin`** |
| **Link Pratinjau Publik**| `https://[domain-klien.com]/preview/os-desktop` | `https://[domain-klien.com]/preview/infinite-canvas` |

---

### 4. Bagaimana Cara Kamu dan Klien Mengelola Konten?

Sangat sederhana dan tidak membingungkan:

#### Langkah 1: Login ke Admin
Buka link admin dan login dengan akun admin kamu:
```text
https://[domain-kamu.com]/admin/login
```
*(Atau cukup buka `http://localhost:3000/admin` saat di laptop kamu sendiri, sistem akan otomatis mengarahkan ke form login).*

#### Langkah 2: Kelola Seluruh Data di Desktop Mac (`/admin`)
Setelah login, kamu langsung masuk ke layar **Desktop macOS Simulator** (`/admin`):
- Mau tambah/edit karya? Klik ikon aplikasi **Projects**.
- Mau ganti bio dan foto profil? Klik ikon **About**.
- Mau ganti nomor WhatsApp? Klik ikon **Contact**.
- Mau ganti wallpaper video / lagu latar? Klik ikon **Wallpaper**.
- Mau setting Asisten AI? Klik ikon **Asisten AI**.

> 💡 **Semua data yang kamu isi di Desktop Mac ini otomatis tampil di kedua tema (Desktop Mac maupun Kanvas 3D). Kamu tidak perlu menginput data dua kali!**

#### Langkah 3: Melihat Pratinjau Kedua Tema
Jika ingin melihat hasil tampilan portofolio untuk pengunjung:
- Pratinjau Tema macOS Desktop: `https://[domain-kamu.com]/preview/os-desktop`
- Pratinjau Tema 3D Infinite Canvas: `https://[domain-kamu.com]/preview/infinite-canvas`

---

### 5. Bagaimana Konsumen Mengatur Asisten AI (Termasuk 9router dll)?

Konsumen sekarang **bisa mengatur mesin AI dan memasukkan kunci API mereka sendiri** langsung dari dashboard admin mereka tanpa perlu bantuan kamu!

- **Menu Aplikasi:** Buka menu **`/admin/system/ai`** (atau klik ikon aplikasi **Asisten AI** di folder *Sistem & Tampilan* pada desktop Mac).
- **Pilihan Provider yang Didukung:**
  1. **Google Gemini:** Gratis & cepat via Google AI Studio.
  2. **OpenRouter:** Bisa memilih ratusan model (ChatGPT, Claude, Llama 3, DeepSeek, dll.).
  3. **Groq:** Kecepatan ultra tinggi.
  4. **OpenAI Official:** Kunci resmi ChatGPT langsung dari OpenAI.
  5. **Pihak Ketiga / 9router / Custom:** Cukup masukkan alamat *Base URL* (misal: `https://api.9router.com/v1` atau DeepSeek API) dan API key mereka!
- **Fitur Canggih:**
  - Ada tombol **"⚡ Tes Koneksi AI"** untuk mencoba koneksi sebelum disimpan.
  - Jika konsumen tidak mengisi kunci sendiri, sistem otomatis memakai kunci server bawaan kamu (jika ada) atau tetap berjalan aman tanpa error.

---

### 6. Mengapa alur ini aman dan praktis buat bisnis kamu?
- Kamu tidak perlu pusing mengurus perpanjangan server VPS bulanan.
- Kalau ada satu klien yang mengunggah banyak video, akun klien lain tidak akan terpengaruh sama sekali.
- Klien merasa bangga karena punya website portofolio yang interaktif, mewah, dan bisa mereka kelola sendiri kapan saja sesuai template pilihan mereka.

---

### 7. Bagaimana Cara Memasang Custom Domain Klien (Otomatis 1-Klik)?

Jika suatu saat klien baru membeli nama domain sendiri (contoh: `budipratama.com`), kamu **tidak perlu membuka dashboard Cloudflare atau mengetik token lagi**:

1. **Buka Asisten:** Cukup klik dua kali `PENGELOLA_KLIEN.bat`.
2. **Pilih Tab:** Klik tab **"Kelola Custom Domain"** di bagian atas.
3. **Pilih Klien:** Pilih nama klien dari daftar dropdown (sistem otomatis membaca data klien dari folder `arsip-klien/` di laptop kamu).
4. **Ketik Domain:** Masukkan nama domain yang dibeli klien (misal: `budipratama.com`).
5. **Klik Tombol:** Klik **"Hubungkan Domain ke Cloudflare"**.
6. **Selesai!** Sistem otomatis mendaftarkan domain ke Cloudflare Pages.
7. Kamu tinggal klik tombol **"Salin Pesan WhatsApp Serah Terima Domain"** untuk memberikan petunjuk 1 baris CNAME ke klien, atau kamu pasang sendiri di tempat pembelian domain.

---

### 8. Bagaimana Cara Update Template ke Klien Saat Ada Fitur Baru atau Bug Diperbaiki?

Jika kamu menambah fitur baru, mendesain ulang tampilan, atau memperbaiki bug di template ini, kamu bisa mengirim update tersebut ke website seluruh klien secara instan:

1. **Buka Master Control:** Klik dua kali file **`PENGELOLA_KLIEN.bat`**.
2. **Pilih Tab 3:** Klik tab **"Update Versi Template"**.
3. **Pilih Opsi:**
   - Centang **"Kompilasi build baru terlebih dahulu"** jika kamu baru saja mengedit kode template.
   - Klik **"Update Klien Ini"** di samping nama klien yang ingin diperbarui, ATAU
   - Klik **"🚀 Update Semua Klien Sekaligus"** untuk memperbarui seluruh klien dalam 1 klik!
4. **Pantau Terminal:** Kotak hitam di layar akan menampilkan status proses kompilasi dan deploy secara langsung (live).

> 🛡️ **Apakah Data Klien Akan Hilang?**
> **TIDAK AKAN HILANG SAMA SEKALI!**
> Data profil, foto karya proyek, video wallpaper, nomor kontak, dan password login klien tersimpan aman di Database D1 dan Storage R2 mereka masing-masing. Proses update ini **hanya memperbarui kode aplikasi tampilan**, sehingga semua karya dan data klien tetap 100% utuh dan aman.
