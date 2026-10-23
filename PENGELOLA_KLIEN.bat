@echo off
title Pengelola Klien & Portal Owner Portofolio (Master Control)
cls

echo ========================================================
echo   PENGELOLA KLIEN & PORTAL OWNER PORTOFOLIO (MASTER)
echo ========================================================
echo.
echo [1/2] Memeriksa Node.js di komputer...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terpasang di komputer ini!
    echo Silakan unduh dan pasang Node.js terlebih dahulu di https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [2/2] Membuka Portal Pengelola Klien di Browser...
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

:: Tunggu 2 detik lalu buka browser
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:4567"

:: Jalankan server asisten lokal
npx tsx scripts/onboarding/server.ts

pause
