# Tracker Log: Sprint 88 — Customer Password Management + Owner Client Status Board (v1.3.2)

**Status:** 🟢 Completed
**Mulai:** 2026-09-13
**Selesai:** 2026-09-13

## 🎯 Tujuan (Objective)
Menutup 2 item backlog managed service:
1. **Password reset customer** (satu-satunya backlog valid yang tersisa) — self-service change password untuk customer yang masih bisa login + owner-assisted reset untuk customer yang terkunci total.
2. **Owner client status board** — menghidupkan kembali konsep "owner dashboard" sebagai tool owner-side (bukan fitur di dalam template): panel ringkasan multi-klien di portal onboarding yang membaca `arsip-klien/`, health-check URL tiap klien, versi template terpasang, dan status domain.

## 📋 Task List
- [x] Service `changeSiteUserPassword` (verify current password → fresh scrypt record, auto-upgrade legacy sha256)
- [x] Endpoint `POST /api/auth/change-password` (requireAuth + CSRF + rate limit 5/5min per IP+user, blokir 15min)
- [x] Rewire `ChangePasswordModal` (menu Keamanan di MenuBar admin) dari endpoint legacy `/api/admin/password` (K/V `settings/adminPassword`) ke endpoint `site_users` baru; tab PIN legacy dihapus (endpoint `/api/admin/pin` juga legacy K/V — PIN flow sudah tidak dipakai sejak Sprint 23)
- [x] CLI `scripts/cloudflare/reset-customer-password.ts` — owner-assisted reset via Cloudflare D1 HTTP API dari arsip klien, sinkron `config.env`, output pesan WhatsApp siap salin
- [x] `GET /api/status` di portal onboarding server — health-check paralel semua klien arsip (timeout 8s, fetch `/api/health`), bandingkan versi deployed vs CHANGELOG lokal
- [x] Tab "Status Klien" di portal (`scripts/onboarding/public/index.html`) — tabel ringkasan + badge versi + tombol periksa ulang
- [x] Update menu `PENGELOLA_KLIEN.bat` (4 menu)
- [x] QA visual via agent-browser: tab render, empty state, baris klien dummy (Toko Uji Coba → Offline benar), kolom tabel lengkap

## 📂 File yang Dimodifikasi (Modified Files)
**Baru:**
- `src/crud/shared/auth/changePassword.ts` — service change password (scoped siteId+userId, fresh salt, upgrade path)
- `src/crud/shared/auth/changePassword.test.ts` — 7 test service
- `src/app/api/auth/change-password/route.ts` — endpoint (CSRF → auth → rate limit → service)
- `src/app/api/auth/change-password/route.test.ts` — 6 test route
- `scripts/cloudflare/reset-customer-password.ts` — CLI owner-assisted reset (--list/--email/--password/--generate/--yes)

**Dimodifikasi:**
- `src/crud/shared/index.ts` — export `changePassword`
- `src/app/admin/components/ChangePasswordModal.tsx` — rewired ke `/api/auth/change-password`, payload `{currentPassword, newPassword}`, tab PIN dihapus, field id/autocomplete ditambahkan
- `scripts/onboarding/server.ts` — endpoint `GET /api/status`
- `scripts/onboarding/public/index.html` — tab Status Klien (view + logika render/refresh, `compareVersions` badge terbaru/perlu-update)
- `PENGELOLA_KLIEN.bat` — menu info 4 item

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Bug 1 (ditemukan saat eksplorasi):** Menu "Keamanan" di MenuBar admin desktop memanggil `/api/admin/password` yang menulis ke K/V legacy `settings/adminPassword` — padahal customer login via tabel `site_users`. Akibatnya customer yang ganti password lewat menu itu tetap harus login dengan password lama.
  - **Perbaikan:** Modal dialihkan ke endpoint baru `/api/auth/change-password` yang menulis ke `site_users`. Endpoint legacy `/api/admin/password` & `/api/admin/pin` dibiarkan (dipakai admin_token owner-template deployment) tapi tidak lagi dipakai UI customer.
- **Bug 2 (minor):** Test route change-password awalnya gagal karena `vi.resetAllMocks()` menghapus implementasi mock `getClientIP` — fix dengan re-mock di `beforeEach`.

## ✅ Verifikasi
- tsc 0 error, eslint 0 error
- 111 test files / 838 tests PASS (naik dari 825; +13 test baru)
- Smoke test portal `GET /api/status` → 200 `{success:true, clients:[], latestVersion:"1.3.1"}`
- QA visual agent-browser: tab switch, tabel render, baris dummy klien offline tampil benar

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Endpoint `/api/auth/change-password` **tidak** ada di CSRF allowlist middleware — ini disengaja: user terautentikasi selalu punya cookie csrf_token (diset saat login via `createLoginResponse`).
- CLI reset memakai Cloudflare D1 HTTP API (bukan binding lokal) karena tiap klien hidup di akun Cloudflare sendiri — kredensial dibaca dari `arsip-klien/<folder>/config.env`.
- `/api/status` portal adalah tool owner-side lokal (localhost:4567), bukan bagian template customer — tidak menambah quota/minta request di deployment klien.
- Backlog managed service kini **kosong**. Item "owner dashboard" sudah terjawab dengan Status Board; password reset selesai end-to-end (self-service + owner-assisted).
- Deploy ke klien existing diperlukan agar fitur change password aktif di deployment mereka (via portal Update Versi Template / GitHub Actions).
