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

Ketika ada klien memesan jasa website portofolio ini, ikuti **4 langkah mudah** berikut:

```
[LANGKAH 1]          [LANGKAH 2]           [LANGKAH 3]            [LANGKAH 4]
Chat & Deal  ───►  Buat Order + Link  ───►  Pasang ke Cloudflare ──► Kirim Kunci
di WhatsApp         Checkout (panel)        (Sekali di awal)         ke Klien
```

> **Aturan emas pembayaran:** order **bisa** dibuat duluan, tapi **website jangan dipasang
> sebelum uangnya benar-benar masuk ke rekeningmu**. Notifikasi Telegram atau unggahan
> bukti bayar bukan bukti bayar — buktinya adalah mutasi rekeningmu sendiri dengan
> nominal yang persis cocok.

---

### Langkah 1: Chat, Deal, dan Siapkan Data Klien

Cukup tanyakan / sepakati 3 hal ini di WhatsApp:
1. **Nama Lengkap / Nama Portofolio** (contoh: *Budi Pratama - Fotografer*)
2. **Alamat website yang diinginkan** (contoh: *budipratama* untuk `budipratama.workers.dev`, atau domain sendiri)
3. **Gaya template**: macOS Desktop OS, Infinite Canvas, atau 3D Spatial Gallery

---

### Langkah 2: Buat Order di Panel, Kirim Link Checkout, Tunggu Bayar

1. Buka **`/admin/system/orders`** (aplikasi **Pesanan** di zona Sistem) → klik **Buat Pesanan**.
2. Isi nama, email, dan WhatsApp klien (slug boleh dikosongkan — otomatis dari nama). Klik **Buat & Dapatkan Link**.
3. **Salin link checkout** dari kotak hijau yang muncul, lalu kirim ke klien via WhatsApp.
   ⚠️ Kotak itu muncul **hanya sekali** — linknya sudah tersimpan juga di email struk klien, jadi kalau terlanjur tertutup, klien tetap punya tautannya.
4. Klien membuka link, melihat nominal unik + QRIS, lalu upload bukti bayar.
5. Kamu menerima notifikasi Telegram. **Buka rekening bankmu dan cek mutasinya dulu** — nominal harus persis. Baru setelah cocok, klik **Aktifkan** di panel (atau tombol **Verifikasi & Aktifkan** di Telegram).
6. Baru lanjut ke Langkah 3.

> Kalau klien ingin mengisi form sendiri tanpa chat, halaman `/checkout` di website juga
> tetap terbuka — dua jalur ini sama-sama aman dan tercatat di panel Pesanan.

---

### Langkah 3: Pasang Website Klien Secara Otomatis (1-Klik Tanpa Terminal!)
*Kamu TIDAK PERLU mengetik perintah terminal atau pusing membuka file kode:*

1. Buatkan akun Cloudflare gratis untuk klien (cukup daftar di `dash.cloudflare.com`).
2. Di folder proyek ini (atau Desktop laptop kamu), cukup **Double-Click (Klik Dua Kali)** file:
   👉 **`PENGELOLA_KLIEN.bat`**
3. Browser Google Chrome akan otomatis terbuka menampilkan portal kontrol visual yang ramah:
   - Masukkan **Nama Klien** (misal: *Budi Pratama*).
   - Pilih gaya template: **macOS Desktop OS** atau **Infinite Canvas**.
   - Masukkan **Account ID** & **API Token** Cloudflare klien (ada panduan bergambarnya di layar).
4. Klik tombol: **`🚀 PROSES OTOMATIS SEKARANG`**.
5. Sistem otomatis membuat database D1, storage R2, migrasi tabel, dan mengarsipkan file ke folder `arsip-klien/` di laptop kamu (± 30 detik), **lalu otomatis build & deploy sampai website benar-benar online** (proses build ± beberapa menit — log tampil di layar, jangan tutup halamannya).
6. Kalau semua sukses, kartu sukses menampilkan alamat website asli dan tombol **"📋 Salin Pesan WhatsApp untuk Klien"** aktif. Kalau deploy gagal, muncul kotak peringatan **"Website BELUM online"** — tekan tombol **"Coba Deploy Ulang Sekarang"** dulu, jangan kirim pesan ke klien sebelum peringatan hilang.

---

### Langkah 4: Serahkan Website ke Klien
Setelah websitenya online, tugas teknis kamu sudah selesai! Sekarang tinggal berikan link website, link ruang admin, dan kredensial login (email + password yang tercetak di `arsip-klien/<slug>/SURAT_SERAH_TERIMA.txt` / `config.env`) ke klien.

Kamu tinggal copy-paste pesan WhatsApp di bawah ini:

---

## 💬 Template Chat WhatsApp untuk Dikirim ke Klien

### Template A — Kirim Link Checkout (saat deal, BELUM bayar)

> *Kirim ini setelah membuat order di panel Pesanan. Ganti tulisan dalam tanda kurung siku.*

```text
Halo kak [Nama Klien]! Siap ya kita buatkan website portofolionya. 🚀

Berikut link pesanan kakak (berlaku 24 jam):
[link checkout dari panel Pesanan]

Di dalamnya ada QRIS + nominal unik — mohon transfer sesuai angka pas ya, biar
otomatis tercatat. Setelah bayar, langsung upload bukti bayarnya di halaman yang sama.

Kalau ada yang kurang jelas, chat saya aja. Makasih kak! 🙏
```

> ⚠️ Link checkout hanya tampil **sekali** di panel saat order dibuat. Kalau klien
> bilang linknya hilang, tenang — link yang sama juga dikirim otomatis ke email klien
> (email struk). 

### Template B — Serah Terima (setelah website online)

> *(Tinggal copy teks di bawah ini dan ganti tulisan di dalam tanda kurung siku)*

```text
Halo kak [Nama Klien]! 👋
Website portofolio interaktif kamu sudah resmi aktif dan siap dipakai! 🚀

🌐 Website Kamu:
https://[slug-klien].workers.dev

🔐 Ruang Admin Pribadi (untuk kelola karya, foto, & profil):
https://[slug-klien].workers.dev/admin
Email    : [email login]
Password : [password admin]

Semua foto, video karya, dan kontak bisa kamu tambahkan sendiri dengan sangat mudah di ruang admin. Selamat berkarya dan sukses selalu! 🎉✨
```

> Pesan di atas **sama persis** dengan template resmi yang disimpan portal ke
> `arsip-klien/<slug>/SURAT_SERAH_TERIMA.txt` (`scripts/onboarding/server.ts:256-269`).
> Kalau klien sudah pasang custom domain, ganti `https://[slug-klien].workers.dev` dengan
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
| **Konsep Tampilan** | Simulasi laptop Mac interaktif (Menu Bar, Dock, Wallpaper video bergerak, jendela aplikasi). | Kanvas spasial futuristik melayang tanpa batas (bisa di-zoom in/out, di-pan/geser, dan ada HUD navigasi kompas). |
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

> 💡 **Semua data yang kamu isi di Desktop Mac ini otomatis tampil di kedua tema (Desktop Mac maupun Kanvas 3D). Kamu tidak perlu menginput data dua kali!**

#### Langkah 3: Melihat Pratinjau Kedua Tema
Jika ingin melihat hasil tampilan portofolio untuk pengunjung:
- Pratinjau Tema macOS Desktop: `https://[domain-kamu.com]/preview/os-desktop`
- Pratinjau Tema 3D Infinite Canvas: `https://[domain-kamu.com]/preview/infinite-canvas`

---

### 5. Asisten AI — BELUM AKTIF (jangan dijanjikan ke klien)

Kabar jujur: fitur AI **belum aktif** di build yang beredar sekarang. Tiga lapisnya sama-sama mati — panel admin AI tidak muncul di desktop, endpoint chat pakai kunci fallback yang tidak pernah terbaca, dan build klien selalu dijalankan dengan `FEATURE_AI=false`. Karena itu:

- **Jangan menjual atau menjanjikan "Asisten AI" ke klien.** Baris "AI assistant" sudah dihapus dari halaman checkout dan panduan klien (dicek 2026-10-06).
- API key per-site (`ai_settings` di D1, panel `/admin/system/ai`) memang sudah terpasang rapi di backend — tapi belum ada gunanya sampai ketiga lapis di atas dibuka.
- Kalau suatu saat kamu mau mengaktifkannya (misal pakai Google Gemini / OpenRouter yang gratis), itu pekerjaan kecil tapi nyata: pasang entri `ai` di `PANEL_MAP`, arahkan endpoint `chat/send` ke kunci per-site, dan buka flag `FEATURE_AI` di pipeline deploy. Setelah itu, tulis ulang bagian ini.

---

### 6. Mengapa alur ini aman dan praktis buat bisnis kamu?
- Kamu tidak perlu pusing mengurus perpanjangan server VPS bulanan.
- Kalau ada satu klien yang mengunggah banyak video, akun klien lain tidak akan terpengaruh sama sekali.
- Klien merasa bangga karena punya website portofolio yang interaktif, mewah, dan bisa mereka kelola sendiri kapan saja sesuai template pilihan mereka.

---

### 6b. Bagaimana Melihat Detail Klien & Kredensial dengan Aman?

Di tab **Status Klien**, setiap baris klien sekarang punya tombol **Detail**. Isinya: nama, slug, template, alamat website/admin, Custom Domain, Worker, status kesehatan, serta infrastruktur Cloudflare (Account ID, D1, R2, KV).

1. **Buka Detail:** klik `PENGELOLA_KLIEN.bat` → tab **Status Klien** → tombol **Detail** di baris klien.
2. **Buat kata sandi brankas (sekali saja):** saat pertama kali membuka Detail, portal meminta kata sandi brankas minimal 12 karakter. **Buat kata sandi baru yang berbeda** dari password admin website dan password Cloudflare. Simpan di password manager atau catatan offline. Jangan kirim kata sandi ini ke AI, WhatsApp, atau chat mana pun.
3. **Lihat infrastruktur:** Account ID, D1, R2, dan KV langsung terlihat dalam bentuk disamarkan (contoh `3bc768...27d9`). Ini bukan rahasia penuh, jadi aman untuk pengecekan cepat.
4. **Buka kredensial:** masukkan kata sandi brankas. Password admin, Cloudflare API token, dan D1 API token akan terlihat. Portal menyembunyikannya otomatis setelah **30 detik**, saat modal ditutup, atau saat tombol **Sembunyikan Sekarang** diklik.
5. **Kalau salah 5 kali:** brankas dikunci 5 menit. Tutup modal, tunggu, lalu coba lagi.
6. **Kalau lupa kata sandi brankas:** minta bantuan AI untuk menghapus baris `PORTAL_VAULT_HASH` dan `PORTAL_VAULT_SALT` dari `.env.local`, lalu restart portal dan buat kata sandi baru. **Jangan pernah mengirim kata sandi brankas ke AI.**

> 🔒 **Catatan keamanan:** portal ini hanya untuk laptop kamu (`127.0.0.1`). Jangan membuka port `4567` ke jaringan publik. File `arsip-klien/<slug>/config.env` tetap menyimpan kredensial asli dalam teks biasa; brankas portal hanya melindungi tampilan di layar, bukan mengenkripsi file arsip.

---

### 7. Bagaimana Cara Memasang Custom Domain Klien (Otomatis 1-Klik)?

Jika suatu saat klien baru membeli nama domain sendiri (contoh: `budipratama.com`), kamu **tidak perlu membuka dashboard Cloudflare atau mengetik token lagi**:

1. **Buka Asisten:** Cukup klik dua kali `PENGELOLA_KLIEN.bat`.
2. **Pilih Tab:** Klik tab **"Kelola Custom Domain"** di bagian atas.
3. **Pilih Klien:** Pilih nama klien dari daftar dropdown (sistem otomatis membaca data klien dari folder `arsip-klien/` di laptop kamu).
4. **Ketik Domain:** Masukkan nama domain yang dibeli klien (misal: `budipratama.com`).
5. **Klik Tombol:** Klik **"Hubungkan Domain ke Cloudflare"**.
6. **Selesai!** Sistem otomatis mendaftarkan domain ke Cloudflare (Worker) milik klien.
7. Kamu tinggal klik tombol **"Salin Pesan WhatsApp Serah Terima Domain"** lalu kirim ke klien. Tidak ada lagi langkah CNAME: Cloudflare membuat record DNS dan HTTPS **otomatis** (syaratnya nama domain sudah berada di akun Cloudflare klien — kalau belum, pindahkan nameserver domain ke Cloudflare klien dulu).

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
