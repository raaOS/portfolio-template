CADANGAN FLASHDISK
==================

Folder ini adalah tempat salinan cadangan di komputer (dipakai oleh
SALIN_CADANGAN.bat saat Anda menekan Enter tanpa memasukkan huruf
flashdisk). Isinya TIDAK ikut di-commit ke GitHub (di-kecualikan di
.gitignore) kecuali file README ini.


CARA PAKAI (pemilik, tanpa tim teknis)
--------------------------------------
1. Buat backup dulu (di folder repo ini, butuh Node.js):

      npm run backup:d1      <- cadangan database
      npm run backup:r2      <- cadangan media/foto-video

   Hasil masuk ke folder backups\ (subfolder d1\ dan r2\, nama folder
   = tanggal + jam pembuatan).

2. Double-click SALIN_CADANGAN.bat, lalu:
   - Ketik huruf flashdisk (mis. E) lalu Enter
     -> tersalin ke E:\cadangan-portfolio\
   - Atau tekan Enter saja
     -> tersalin ke folder ini (cadangan-flashdisk\)

   Salinan bersifat incremental: file lama yang sudah sama tidak
   disalin ulang, jadi proses rutin cepat.


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
