# Tracker Log: Sprint 76 — Customer Auth, CSRF, Admin API & Dev Runtime Bug Fixes

**Status:** 🟢 Completed  
**Tanggal:** 2026-09-06  
**Verified:** tsc 0 error, eslint 0 error (13 warnings), 107 files / 803 tests PASS  

---

## 🎯 Tujuan (Objective)

Memperbaiki cacat logika (*logic defects*) dan cacat kode (*code defects*) fatal pada lapisan Managed Service Customer Auth, Setup Wizard CSRF, Admin API session validation, serta script dev orchestrator port binding.

---

## 🐛 Bug & Perbaikan (Bug Tracker)

### 1. [CRITICAL] Mismatched HMAC Key Derivation di `customer-auth.ts`
- **File:** `src/middleware/customer-auth.ts`, `src/crud/shared/auth/session.ts`
- **Penyebab:** `deriveSiteSecret` di middleware mengimpor `siteId` sebagai kunci HMAC dan menandatangani `siteId`, sedangkan `session.ts` mengimpor `baseSecret` (`JWT_SECRET`) sebagai kunci HMAC dan menandatangani `siteId`. Token valid yang dibuat saat login selalu gagal diverifikasi di middleware dengan `ERR_JWS_SIGNATURE_VERIFICATION_FAILED`.
- **Perbaikan:** Mengekstrak fungsi tunggal `deriveSiteSecret` di `session.ts` dan mengimpornya langsung di `customer-auth.ts`, memastikan derivasi kunci 100% identik dan konsisten.

### 2. [FATAL] CSRF Token Kosong pada `GET /api/auth/check-auth`
- **File:** `src/app/api/auth/check-auth/route.ts`
- **Penyebab:** Handler memeriksa `if (!session) return NextResponse.json({ authenticated: false, csrfToken: '' })` tanpa memasang cookie `csrf_token`. Akibatnya hook `useAdminLogin.ts` memblokir pengiriman form login dengan pesan *"CSRF token tidak tersedia. Silakan refresh halaman."*.
- **Perbaikan:** `GET /api/auth/check-auth` selalu menghasilkan token CSRF 64-karakter dan memasang cookie `csrf_token` meskipun pengguna belum login.

### 3. [FATAL] Endpoint `/api/setup` & `/api/auth/*` Diblokir Middleware CSRF
- **File:** `src/middleware/csrf.ts`
- **Penyebab:** `/api/setup`, `/api/auth/login`, dan `/api/auth/logout` belum terdaftar di `allowlistPaths` middleware CSRF. Request form setup pertama kali dari browser baru tanpa cookie CSRF langsung ditolak HTTP 403.
- **Perbaikan:** Menambahkan `/api/auth/login`, `/api/auth/logout`, dan `/api/setup` ke `allowlistPaths` di `src/middleware/csrf.ts`.

### 4. [HIGH] Sesi Customer `site_user_token` Ditolak di Endpoint Admin API
- **File:** `src/lib/auth.ts`
- **Penyebab:** Puluhan route admin (Settings, Explorer, Upload, Storage Stats, dll.) memanggil `validateAdminRequest()` yang hanya memvalidasi cookie legacy `admin_token`.
- **Perbaikan:** Menambahkan fallback di `validateAdminRequest()` untuk memeriksa `getSiteUserSession()` via `site_user_token` jika `checkAdminAuth()` tidak menemukan `admin_token`.

### 5. [RUNTIME] Deteksi Port Salah & Silent Exit pada `scripts/core/dev.js`
- **File:** `scripts/core/dev.js`
- **Penyebab:** `isPortAvailable` hanya memeriksa bind IPv4 `0.0.0.0`, melewatkan proses aktif pada interface dual-stack IPv6 `[::]:3000` di Windows. Event `child.on('exit')` langsung memanggil `process.exit()` sebelum stream stderr sempat di-flush.
- **Perbaikan:** Probe port diperluas dengan koneksi aktif (`127.0.0.1` & `::1`) dan bind test (`0.0.0.0` & `::`). Event `child.on('exit')` diganti ke `child.on('close')`.

### 6. [CLEANUP] Pembersihan Unused Variables & Lint Warnings
- `src/app/setup/page.tsx`: Prefix unused `status` state menjadi `_status`.
- `src/components/templates/infinite-canvas/hooks/useCanvasControls.ts`: Hapus import unused `useEffect`.
- `src/app/preview/[template]/page.tsx`: Hapus import unused `SYSTEM_DEFAULT_TEMPLATE_ID`.
- `src/app/(site)/projects/_components/ProjectsFinderHeader.tsx`: Prefix unused prop `itemCount` menjadi `_itemCount`.

---

## 📂 File yang Dimodifikasi

1. `src/crud/shared/auth/session.ts` — Ekspor `deriveSiteSecret` konsisten.
2. `src/middleware/customer-auth.ts` — Pakai `deriveSiteSecret` dari session.
3. `src/app/api/auth/check-auth/route.ts` — Selalu sediakan CSRF token & cookie.
4. `src/middleware/csrf.ts` — Allowlist `/api/setup`, `/api/auth/login`, `/api/auth/logout`.
5. `src/lib/auth.ts` — `validateAdminRequest` dukung sesi `site_user_token`.
6. `scripts/core/dev.js` — Probe IPv4/IPv6 dual-stack & ganti ke event `close`.
7. `src/app/setup/page.tsx` — Fix unused var.
8. `src/components/templates/infinite-canvas/hooks/useCanvasControls.ts` — Fix unused var.
9. `src/app/preview/[template]/page.tsx` — Fix unused var.
10. `src/app/(site)/projects/_components/ProjectsFinderHeader.tsx` — Fix unused prop.
11. `panduan/README.md` — Direktori panduan operasional non-IT.
12. `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` — Panduan langkah setup/deploy untuk owner tanpa bahasa teknis rumit.
13. `panduan/PANDUAN_UNTUK_KLIEN.md` — Panduan penggunaan ramah pengguna untuk klien (/setup, login, input karya).
14. `src/middleware/__tests__/csrf.test.ts` — Update tests allowlist.
15. `src/middleware/__tests__/customerAuth.test.ts` — [NEW] Unit tests customer auth middleware & key derivation.
16. `src/app/api/auth/check-auth/__tests__/route.test.ts` — [NEW] Unit tests check-auth CSRF cookie.
17. `src/lib/__tests__/validateAdminRequest.test.ts` — [NEW] Unit tests customer session support.
18. `src/app/admin/page.tsx` — Server-side guard dukung sesi customer `site_user_token`.
19. `src/app/admin/projects/explorer/page.tsx` — Server-side guard dukung sesi customer `site_user_token`.
