@echo off
setlocal
title Salin Cadangan Portofolio

echo ================================================================
echo      SALIN CADANGAN PORTOFOLIO
echo ====================================================
echo.
echo Perintah ini MENYALIN tiga hal ke folder cadangan bertanggal:
echo    1. backups\       - hasil npm run backup:d1 dan backup:r2
echo    2. arsip-klien\   - arsip config.env tiap klien
echo    3. .env.local     - secret environment utama
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

call :tanggal
if "%PILIHAN%"=="" (
  set "DEST=%~dp0cadangan-flashdisk\%TANGGAL%"
  goto :mulai
)
set "DRIVE=%PILIHAN::=%"
if not exist "%DRIVE%:\" goto :drive_salah
set "DEST=%DRIVE%:\cadangan-portfolio\%TANGGAL%"
goto :mulai

:mulai
echo.
echo Menyalin ke: %DEST%
echo Mohon tunggu sebentar...
echo.
if not exist "%DEST%" mkdir "%DEST%"

rem --- 1. backups\ : database + media hasil backup harian/manual ---
robocopy "%~dp0backups" "%DEST%" /E /NFL /NDL /NP /R:2 /W:2
set "RC=%ERRORLEVEL%"
set "RCX=0"
if %RC% GEQ 8 set "RCX=8"

rem --- 2. arsip-klien\ : arsip kredensial tiap klien (wajib ikut ter-copy) ---
if not exist "%~dp0arsip-klien" goto :tanpa_arsip
robocopy "%~dp0arsip-klien" "%DEST%\arsip-klien" /E /NFL /NDL /NP /R:2 /W:2
set "RC2=%ERRORLEVEL%"
if %RC2% GEQ 8 (echo [X] arsip-klien GAGAL tersalin.) else (echo [OK] arsip-klien ikut tersalin.)
if %RC2% GEQ 8 set "RCX=8"
goto :arsip_selesai
:tanpa_arsip
echo [i] arsip-klien tidak ditemukan - dilewati (wajar bila belum ada klien).
:arsip_selesai

rem --- 3. .env.local : secret environment (wajib ikut ter-copy) ---
if not exist "%~dp0.env.local" goto :tanpa_env
robocopy "%~dp0." "%DEST%" .env.local /NFL /NDL /NP /R:2 /W:2
set "RC2=%ERRORLEVEL%"
if %RC2% GEQ 8 (echo [X] .env.local GAGAL tersalin.) else (echo [OK] .env.local ikut tersalin.)
if %RC2% GEQ 8 set "RCX=8"
goto :env_selesai
:tanpa_env
echo [i] .env.local tidak ditemukan - dilewati.
:env_selesai

if %RCX% GEQ 8 set "RC=8"

echo.
if %RC% GEQ 8 goto :gagal
echo [OK] Selesai. Cadangan sudah tersalin ke:
echo      %DEST%
rem RC robocopy = bit-flag: 0=tiada perubahan, 1=file tersalin, 2=ekstra di tujuan.
rem Pesan "tidak ada file baru" tampil bila bit 0 (file tersalin) tidak terpasang.
set /a "RC_KOPI = RC & 1"
if %RC_KOPI% EQU 0 echo      Tidak ada file baru di backups\, semua sudah sama dengan salinan sebelumnya.
echo.
pause
exit /b 0

:gagal
echo [X] Gagal menyalin. Kode masalah: %RC%
echo     Cek tiga hal: flashdisk masih terpasang, huruf drive benar,
echo     dan kapasitas flashdisk cukup.
echo.
pause
exit /b 1

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

rem --- tanggal folder tujuan (locale-independent; fallback bila PowerShell gagal) ---
:tanggal
set "TANGGAL="
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "TANGGAL=%%i"
if not defined TANGGAL set "TANGGAL=tanpa-tanggal"
exit /b 0
