# Log: Perbaikan App "Harga Jual" Window Kosong (v1.3.29)

**Tanggal:** 2026-10-08
**Status:** ✅ Selesai & tervalidasi penuh (gerbang: `tsc --noEmit` 0, ESLint 0 error, **123 file / 972 test PASS**)
**Laporan owner:** _"halaman crud atur harga kok kosong ya ? aku gak bisa atur harga jadinya"_

---

## Akar Masalah

App `harga` ("Harga Jual") sudah terdaftar di dua tempat, tapi terlewat di satu tempat yang justru menentukan isi window:

| Tempat | Status |
|---|---|
| `src/app/admin/desktop/registry.ts:192` (app di zona "Sistem & Tampilan") | ✅ ada |
| `src/app/admin/desktop/registry.ts:272` (`APP_ROUTE_MAP` → `/admin/harga`) | ✅ ada |
| `src/app/admin/harga/page.tsx` (halaman route) | ✅ ada |
| **`PANEL_MAP` di `src/app/admin/desktop/WindowContentRenderer.tsx`** | ❌ **tidak ada** |

**Kenapa halaman route tidak menolong:** `ClientAdminLayout.tsx:81-91` tidak me-render `children` (kecuali halaman login) — ia mengganti seluruh isi dengan `AdminDesktopShell`. Semua isi window admin diambil dari `PANEL_MAP` berdasarkan `appId`. Karena `PANEL_MAP['harga']` undefined, `WindowContentRenderer.tsx:172-178` merender _"Panel 'harga' belum tersedia"_ → user melihat halaman kosong/tidak bisa atur harga.

**Kapan terjadi:** fitur harga (PK4 + perpindahan ke `/admin/harga`, F-05) ditambahkan di rilis 1.3.27–1.3.28 (`1adfe7c`) tanpa mendaftarkan key `harga` di `PANEL_MAP`. Bug serupa pada app `ai` sudah tercatat di CHANGELOG 1.3.28 sebagai temuan yang belum ditangani (sengaja — fitur AI mati per keputusan owner).

---

## Perbaikan (mengikuti pola panel yang sudah ada)

1. **`src/app/admin/desktop/panels/HargaPanel.tsx` (BARU)** — isi `HargaClientContent` diekstraksi utuh dari `page.tsx` menjadi panel default-export. Diff murni struktural: hapus 2 impor (`AdminAuthGuard`, `AdminHeader`) + ganti nama fungsi + pindahkan pembungkus ke page. **Nol perubahan logika** (dibuktikan `git diff --no-index`: 1 hapus/18 baris hanya impor & wrapper).
2. **`src/app/admin/harga/page.tsx`** — kini pembungkus `AdminAuthGuard` + `AdminHeader` + `<HargaPanel />` (pola identik dengan `admin/system/backup/page.tsx` ↔ `panels/BackupPanel.tsx`).
3. **`src/app/admin/desktop/WindowContentRenderer.tsx`** — tambah dynamic import `HargaPanel` (`ssr: false`) + key `harga: HargaPanel` di `PANEL_MAP`.

**Deep-link tetap jalan:** `ClientAdminLayout` memetakan pathname `/admin/harga` → `appId 'harga'` → `openApp` → window kini render `HargaPanel`.

**Cakupan dicek ulang:** 21 app id di `ADMIN_ZONES` vs 20 key di `PANEL_MAP` — satu-satunya yang tidak terdaftar `ai` (sengaja, keputusan owner v1.3.28; jangan didaftarkan tanpa izin).

## File yang Dimodifikasi

- `src/app/admin/desktop/panels/HargaPanel.tsx` (baru)
- `src/app/admin/harga/page.tsx` (dijadikan wrapper)
- `src/app/admin/desktop/WindowContentRenderer.tsx` (registrasi PANEL_MAP)
- `src/app/api/admin/pricing/route.ts` (GET auth → `validateAdminRequest`)
- `src/app/api/admin/pricing/route.test.ts` (baru, +7 test)
- `src/app/api/admin/audit-logs/route.ts` + `route.test.ts` (GET auth → `validateAdminRequest`, +1 guard regresi)
- `src/app/api/admin/orders/route.ts` (GET auth → `validateAdminRequest`)
- `src/app/api/admin/payment-config/route.ts` (GET auth → `validateAdminRequest`)
- `src/lib/constants.ts` (`APP_VERSION` 1.3.28 → 1.3.29, dipaksa test sinkronisasi CHANGELOG)
- `CHANGELOG.md` (entri `[1.3.29]`)

## Verifikasi

- `npx tsc --noEmit` → 0 error
- `npx eslint` pada file berubah → 0 error
- `npx vitest run --silent` → **124 file / 980 test PASS** (+8 test baru; tanpa regresi)
- Catatan: worktree ini tidak punya `node_modules` sendiri — dipasang junction ke repo utama `Documents\tamplate-portofolio\node_modules` (package.json & HEAD identik `1adfe7c`) untuk keperluan verifikasi.

## Bug yang Diperbaiki

1. App "Harga Jual" di desktop admin selalu menampilkan panel tidak tersedia (tidak bisa atur harga) — key `harga` tidak terdaftar di `PANEL_MAP`.
2. **(ditemukan saat uji nyata owner)** GET route admin selalu 401 "Unauthorized" → panel tampil "Gagal memuat harga" / "Gagal memuat log". Akar: route GET memakai `checkAdminAuth` polos (hanya cookie legacy `admin_token`), padahal login admin kini menerbitkan sesi customer `site_user_token` (`/api/auth/login` → `createLoginResponse`). Diperbaiki ke `validateAdminRequest(request, { checkCsrf: false })` — pola sama dengan GET `backup`/`storage-stats` yang berfungsi; handler PUT/POST sudah benar. **4 route diperbaiki:** `/api/admin/pricing` + `/api/admin/audit-logs` (dua-duanya dilaporkan owner lewat uji nyata: panel Harga Jual & Log Aktivitas), lalu `/api/admin/orders` + `/api/admin/payment-config` (endpoint dormant — tidak ada pemanggil UI aktif — disamakan sekalian supaya tidak jadi bom waktu). Test: `pricing/route.test.ts` baru (+7) + guard regresi auth di `audit-logs/route.test.ts` (+1).

**Route legacy yang sengaja TIDAK diubah:** `GET/POST /api/admin/check-auth` & `/api/admin/logout` (hanya cookie legacy `admin_token`, sudah tidak dipanggil UI mana pun — desktop pakai `/api/auth/check-auth` & `/api/auth/logout`); jalur `checkAdminAuth` di route `billing/orders/[orderId]*` (elevasi privasi opsional, bukan gate utama, berbeda semantik — dilaporkan, tidak disentuh).
