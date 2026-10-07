@echo off
setlocal
title Salin Cadangan Portofolio

echo ================================================================
echo      SALIN CADANGAN PORTOFOLIO
echo ================================================================
echo.
echo Perintah ini MENYALIN hasil backup (folder backups) ke flashdisk
echo atau ke folder cadangan-flashdisk di repo ini.
echo File lama yang sudah sama tidak disalin ulang, jadi cepat.
echo.
echo Ingat: buat backup dulu sebelum menyalin, dengan perintah:
echo    npm run backup:d1
echo    npm run backup:r2
echo.

if not exist "%~dp0backups" goto :belum_adabackups
if not exist "%~dp0backups\d1" if not exist "%~dp0backups\r2" goto :belum_adabackups

set "PILIHAN="
set /p PILIHAN=Masukkan huruf flashdisk, misalnya E   (atau Enter untuk folder cadangan-flashdisk):

if "%PILIHAN%"=="" goto :ke_lokal
set "DRIVE=%PILIHAN::=%"
if not exist "%DRIVE%:\" goto :drive_salah
set "DEST=%DRIVE%:\cadangan-portfolio"
goto :mulai

:ke_lokal
set "DEST=%~dp0cadangan-flashdisk"

:mulai
echo.
echo Menyalin ke: %DEST%
echo Mohon tunggu sebentar...
echo.
if not exist "%DEST%" mkdir "%DEST%"

robocopy "%~dp0backups" "%DEST%" /E /NFL /NDL /NP /R:2 /W:2
set "RC=%ERRORLEVEL%"

echo.
if %RC% GEQ 8 goto :gagal
echo [OK] Selesai. Cadangan sudah tersalin ke:
echo      %DEST%
if %RC% EQU 0 echo      Tidak ada file baru, semua sudah sama dengan salinan sebelumnya.
goto :selesai

:gagal
echo [X] Gagal menyalin. Kode masalah: %RC%
echo     Cek tiga hal: flashdisk masih terpasang, huruf drive benar,
echo     dan kapasitas flashdisk cukup.

:selesai
echo.
pause
exit /b 0

:belum_adabackups
echo [X] Belum ada isi backup di folder backups.
echo     Buat dulu dengan perintah:
echo        npm run backup:d1
echo        npm run backup:r2
echo.
pause
exit /b 1

:drive_salah
echo [X] Drive "%DRIVE%:" tidak ditemukan.
echo     Periksa lagi huruf flashdisk di File Explorer, lalu coba ulang.
echo.
pause
exit /b 1
