CADANGAN FLASHDISK
===================

Folder ini adalah tempat salinan cadangan di komputer (dipakai oleh
SALIN_CADANGAN.bat saat Anda menekan Enter tanpa memasukkan huruf
flashdisk). Isinya TIDAK ikut di-commit ke GitHub (di-kecualikan di
.gitignore) kecuali file README ini.


ISI SALINAN (per tanggal)
-------------------------
SALIN_CADANGAN.bat menyalin TIGA hal ke dalam subfolder bertanggal:

   cadangan-flashdisk\YYYY-MM-DD\        (di komputer ini)
   E:\cadangan-portfolio\YYYY-MM-DD\     (di flashdisk, misal drive E)

Isinya:
  1. backups\        hasil `npm run backup:d1` dan `npm run backup:r2`
                     (subfolder d1\ dan r2\, nama folder = tanggal+jam)
  2. arsip-klien\    arsip config.env tiap klien (dilewati bila belum ada)
  3. .env.local      secret environment utama (dilewati bila belum ada)

Tiap hari punya folder sendiri, jadi salinan lama tidak tertimpa.


CARA PAKAI (pemilik, tanpa tim teknis)
--------------------------------------
1. Buat backup dulu (di folder repo ini, butuh Node.js):

      npm run backup:d1      <- cadangan database
      npm run backup:r2      <- cadangan media/foto-video

2. Double-click SALIN_CADANGAN.bat, lalu:
   - Ketik huruf flashdisk (mis. E) lalu Enter
     -> tersalin ke E:\cadangan-portfolio\YYYY-MM-DD\
   - Atau tekan Enter saja
     -> tersalin ke folder ini (cadangan-flashdisk\YYYY-MM-DD\)

   Salinan bersifat incremental di dalam folder tanggal yang sama:
   file lama yang sudah sama tidak disalin ulang, jadi proses rutin cepat.


ENKRIPSI (SANGAT DISARANKAN)
----------------------------
Isi cadangan berisi data sensitif: data pembeli, kredensial klien
(arsip-klien\), dan secret website (.env.local). Sebelum flashdisk
dibawa keluar rumah / disimpan / dikirim, kompres folder bertanggal
dengan 7-Zip berpassword:

   7z a -p -mhe=on cadangan.7z cadangan-flashdisk\2026-10-08

   -p        = diminta memasukkan password saat membuat & membuka
   -mhe=on   = nama file ikut dienkripsi (privacy lebih kuat)

Simpan password di tempat TERPISAH dari flashdisk (mis. dicatat di
buku catatan fisik yang disimpan di tempat lain). Tanpa password,
siapa pun yang menemukan flashdisk bisa membaca semua data di atas.


CATATAN PENTING
---------------
- Jangan hapus folder backups\ sebelum proses salin selesai.
- Simpan flashdisk di tempat aman; ulangi langkah 1-2 minimal
  seminggu sekali.
- File backup TIDAK pernah dikirim ke GitHub - flashdisk / folder
  ini adalah satu-satunya salinan fisik Anda.
- Restore (mengembalikan database dari cadangan): lihat
  docs/operations/backup-restore-runbook.md (perintah
  npm run restore:d1).
