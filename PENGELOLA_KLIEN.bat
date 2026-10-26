@echo off
setlocal
title Pengelola Klien ^& Portal Owner Portofolio (Master Control)
cd /d "%~dp0"

:: Pintasan untuk uji/otomatisasi:
::   PENGELOLA_KLIEN.bat portal     -> langsung buka portal
::   PENGELOLA_KLIEN.bat cadangan   -> langsung salin cadangan
if /i "%~1"=="portal" goto :jalur_portal
if /i "%~1"=="cadangan" goto :jalur_cadangan

:menu
cls
title Pengelola Klien ^& Portal Owner Portofolio (Master Control)
echo ========================================================
echo   PENGELOLA KLIEN ^& PORTOFOLIO (MASTER CONTROL)
echo ========================================================
echo.
echo   [1] Buka Portal Klien
echo       Onboarding klien baru, status, custom domain, update versi.
echo.
echo   [2] Salin Cadangan ke Flashdisk
echo       Menyalin backups\, arsip-klien\, dan .env.local.
echo.
echo   [3] Keluar
echo.
echo   Pilih 1, 2, atau 3. Tanpa memilih, otomatis [1] dalam 15 detik.
echo.
choice /c 123 /n /t 15 /d 1 >nul
if errorlevel 3 goto :keluar
if errorlevel 2 (call :cadangan) else (call :portal)
goto :menu

:keluar
echo.
echo Sampai jumpa.
exit /b 0

:jalur_portal
call :portal
set "RC=%errorlevel%"
exit /b %RC%

:jalur_cadangan
call :cadangan
set "RC=%errorlevel%"
exit /b %RC%

:: ============================================================
:: [1] PORTAL KLIEN
:: ============================================================
:portal
cls
echo ========================================================
echo   PORTAL PENGELOLA KLIEN
echo ========================================================
echo.
echo [1/3] Memeriksa Node.js di komputer...

where node >nul 2>nul
if errorlevel 1 goto :tanpa_node

echo [2/3] Memeriksa dependensi proyek (tsx)...

:: Pakai tsx LOKAL, bukan "npx tsx". Kalau npx tidak menemukan tsx,
:: npx bertanya "Ok to proceed? (y)" lalu mencoba mengunduh dari internet.
if not exist "node_modules\.bin\tsx.cmd" goto :tanpa_tsx

:: Kalau portal sudah jalan di jendela lain, jangan tampilkan error EADDRINUSE.
powershell -NoProfile -Command "try{$c=[Net.Sockets.TcpClient]::new('127.0.0.1',4567);$c.Close();exit 1}catch{exit 0}" >nul 2>nul
if errorlevel 1 goto :sudah_jalan

echo [3/3] Membuka Portal Pengelola Klien di Browser...
echo.
echo Server siap di http://localhost:4567
echo.
echo Menu yang tersedia di browser:
echo   [1] Pendaftaran Klien Baru (1-Klik Setup Cloudflare)
echo   [2] Status Klien (Pantau Online/Offline, Versi ^& Domain Semua Klien)
echo   [3] Kelola Custom Domain Klien
echo   [4] Update Versi Template ke Klien (Bugfix ^& Fitur Baru)
echo   [5] Peta Bisnis (Diagram Alur Jualan ^& Peta Aset - Khusus Owner)
echo.
echo JANGAN TUTUP JENDELA INI SELAMA PORTAL SEDANG DIGUNAKAN.
echo ========================================================
echo.

:: Beri waktu tsx menyala dulu, baru buka browser.
start "" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:4567"

call "node_modules\.bin\tsx.cmd" "scripts\onboarding\server.ts"
set "RC=%errorlevel%"

echo.
if not "%RC%"=="0" (
    echo ========================================================
    echo [ERROR] Server portal berhenti dengan kode: %RC%
    echo Baca pesan error di atas. Jendela ini TIDAK menutup sendiri
    echo supaya Anda sempat membaca pesannya.
    echo ========================================================
) else (
    echo [i] Server portal sudah berhenti.
)
echo.
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b %RC%

:tanpa_node
echo [ERROR] Node.js belum terpasang di komputer ini!
echo Silakan unduh dan pasang Node.js terlebih dahulu di https://nodejs.org
echo.
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b 1

:tanpa_tsx
echo [ERROR] Dependensi proyek belum terpasang!
echo Folder node_modules kosong atau tidak lengkap.
echo.
echo Cara memperbaiki:
echo   1. Buka terminal di folder ini
echo   2. Jalankan: npm install
echo   3. Setelah selesai, klik dua kali file ini lagi.
echo.
echo Folder: %CD%
echo.
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b 1

:sudah_jalan
echo [i] Portal sudah berjalan di http://localhost:4567
echo     Browser akan dibuka. Kalau ingin memulai ulang, tutup dulu
echo     jendela portal yang lama.
echo.
start "" http://localhost:4567
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b 0

:: ============================================================
:: [2] SALIN CADANGAN
:: ============================================================
:cadangan
cls
echo ================================================================
echo      SALIN CADANGAN PORTOFOLIO
echo ================================================================
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
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b 0

:gagal
echo [X] Gagal menyalin. Kode masalah: %RC%
echo     Cek tiga hal: flashdisk masih terpasang, huruf drive benar,
echo     dan kapasitas flashdisk cukup.
echo.
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b 1

:belum_adabackups
echo [X] Belum ada isi backup di folder backups.
echo     Buat dulu dengan perintah:
echo        npm run backup:d1
echo        npm run backup:r2
echo.
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b 1

:drive_salah
echo [X] Drive "%DRIVE%:" tidak ditemukan.
echo     Periksa lagi huruf flashdisk di File Explorer, lalu coba ulang.
echo.
echo Tekan Enter untuk kembali ke menu...
pause >nul
exit /b 1

rem --- tanggal folder tujuan (locale-independent; fallback bila PowerShell gagal) ---
:tanggal
set "TANGGAL="
for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set "TANGGAL=%%i"
if not defined TANGGAL set "TANGGAL=tanpa-tanggal"
exit /b 0
