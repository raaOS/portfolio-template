# Support Response Templates

Status: Sprint 48 operational baseline.

Template jawaban support untuk operator. Copy-paste dan sesuaikan bagian dalam kurung siku `[...]` dengan data spesifik buyer. Jangan pernah menyertakan password, token, API key, atau data internal sistem dalam jawaban ke buyer.

## SLA

- **Semua buyer**: respon maksimal 1×24 jam hari kerja.

---

## Login Gagal

### Template

```
Halo [nama buyer],

Terima kasih sudah menghubungi kami. Untuk masalah login, coba langkah berikut:

1. Pastikan Anda mengakses halaman login yang benar: [domain]/[slug]/login
2. Pastikan email dan password yang Anda gunakan sesuai dengan yang kami kirimkan saat onboarding.
3. Jika masih gagal, coba:
   - Clear cookies browser untuk domain [domain]
   - Refresh halaman login
   - Coba lagi

Jika tetap tidak bisa, Anda bisa reset password melalui halaman:
[domain]/client/reset-password

Masukkan site slug "[slug]" dan email Anda, lalu ikuti instruksi di email.

Jika masih bermasalah setelah langkah di atas, balas pesan ini dan kami akan bantu lebih lanjut.

Salam,
[nama operator]
```

---

## Email Reset Password Tidak Masuk

### Template

```
Halo [nama buyer],

Jika email reset password belum masuk, coba langkah berikut:

1. Cek folder Spam / Junk / Promotions di email Anda.
2. Tunggu beberapa menit — kadang email butuh waktu untuk sampai.
3. Pastikan email yang Anda masukkan sama persis dengan yang terdaftar di akun Anda.
4. Coba kirim ulang permintaan reset dari halaman: [domain]/client/reset-password

Catatan: link reset password berlaku selama 30 menit. Jika sudah lewat, silakan kirim ulang.

Jika setelah kirim ulang masih tidak masuk, kabari kami dan kami akan bantu reset secara manual.

Salam,
[nama operator]
```

---

## Upload Gagal

### Template

```
Halo [nama buyer],

Mohon maaf atas ketidaknyamanannya. Untuk masalah upload, cek beberapa hal berikut:

1. **Ukuran file**: 
   - Gambar: maksimal 30 MB
   - Video: maksimal 60 MB untuk upload biasa
   
2. **Format file**:
   - Gambar: JPEG, PNG, WebP, atau AVIF
   - Video: MP4 (direkomendasikan)

3. **Quota storage**: 
   - Cek sisa quota di Dashboard Anda. Jika quota hampir penuh, Anda bisa menghapus media yang tidak dipakai atau menghubungi kami untuk upgrade.

4. **Koneksi internet**: Upload file besar memerlukan koneksi stabil. Coba dengan koneksi yang lebih baik atau kompres file terlebih dulu.

Jika masih bermasalah setelah mengecek poin di atas, balas pesan ini dengan informasi:
- Nama file yang gagal di-upload
- Ukuran file
- Screenshot error (jika ada)

Salam,
[nama operator]
```

---

## Quota Penuh

### Template

```
Halo [nama buyer],

Storage atau quota project Anda saat ini sudah mencapai batas quota.

Detail quota Anda:
- Project: maksimal [X] project
- Storage: maksimal [X] MB
- Media per project: maksimal [X] file

Beberapa opsi yang tersedia:
1. **Hapus media/project yang tidak dipakai** — ini akan mengurangi usage dan memberi ruang untuk upload baru.
2. **Custom quota add-on** — hubungi kami jika Anda butuh penambahan quota spesifik.

Silakan kabari kami jika Anda butuh penambahan quota, dan kami akan bantu prosesnya.

Salam,
[nama operator]
```

---

## Site Tidak Tampil

### Template

```
Halo [nama buyer],

Untuk masalah site yang tidak tampil, kami akan cek beberapa hal:

1. Pastikan Anda mengakses URL yang benar: [domain]/[slug]
2. Pastikan Anda sudah mempublish minimal 1 project di Dashboard.
   - Project yang masih draft tidak akan tampil di halaman publik.

Jika URL dan project sudah benar tapi site tetap tidak muncul, kemungkinan ada gangguan sementara di server kami. Kami akan segera mengecek dan menginformasikan hasilnya.

Salam,
[nama operator]
```

---

## Billing / Payment (Placeholder)

### Template

```
Halo [nama buyer],

Terima kasih sudah menghubungi kami terkait pembayaran.

[Bagian ini akan dilengkapi setelah sistem billing otomatis aktif di Sprint 47.]

Untuk sementara, jika ada masalah terkait aktivasi plan atau status pembayaran, silakan hubungi kami langsung dan kami akan bantu secara manual.

Salam,
[nama operator]
```

---

## Umum / Penutup

### Template Penutup Tiket

```
Halo [nama buyer],

Senang bisa membantu! Jika ada pertanyaan atau masalah lain di kemudian hari, jangan ragu menghubungi kami.

Salam,
[nama operator]
```
