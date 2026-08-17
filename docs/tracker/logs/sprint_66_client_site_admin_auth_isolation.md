# Sprint 66 - Client Site Admin Auth Isolation

## Ringkasan Pekerjaan
Memperbaiki bug besar desinkronisasi sesi otentikasi di mana login **Master Admin** (`/admin`) menyebabkan web client publik (`/[siteSlug]` seperti `/urgent`) ikut berjalan dalam **Mode Admin** (`• MODE ADMIN` & tombol `KELUAR ADMIN`).

## Detail Masalah & Penyebab
1. `DesktopEnvironment` pada web client publik memanggil `useAdminAuth()`.
2. `useAdminAuth()` mengecek endpoint `/api/admin/check-auth` yang membaca cookie `admin_token` milik Master Admin Dashboard.
3. Apabila admin sedang login di Master Admin Dashboard (`/admin`), browser menyimpan cookie `admin_token`.
4. Akibatnya, saat membuka web client publik (`/urgent`), site menganggap pengunjung tersebut adalah admin site client dan mengaktifkan **Mode Admin**.

## Solusi & Perubahan
1. **Pemisahan Sesi Ketat (Strict Auth Isolation)**:
   - **Master Admin (`admin_token`)**: Hanya berlaku untuk Dashboard Administrasi Pusat (`/admin/*`). Master Admin yang membuka web client publik akan tetap melihat tampilan sebagai **Visitor (Mode Visitor)**.
   - **Client Admin (`client_token`)**: Hanya berlaku ketika client/admin site tersebut login secara khusus melalui portal login client (`/client/login` atau `/[siteSlug]/login`).
2. **Hook Baru `useClientSiteAuth(siteId)` (`src/hooks/useClientSiteAuth.ts`)**:
   - Mengecek sesi client via `/api/client/check-auth`.
   - Mengaktifkan `isAdmin = true` **HANYA BILA** sesi client aktif DAN `client.site.id` / `client.site.slug` cocok persis dengan `siteId` layar yang dibuka.
   - Fungsi `logout()` memanggil `POST /api/client/logout` yang secara bersih menghapus `client_token` dan merefresh halaman ke Mode Visitor.
3. **Pembaruan `DesktopEnvironment.tsx` & `MenuBar.tsx`**:
   - Menggantikan `useAdminAuth()` dengan `useClientSiteAuth(siteId)` untuk mengendalikan visual desktop simulator publik.
   - Mengubah link logo Lottie mata pada header `MenuBar.tsx` dari hardcoded `/admin/login` menjadi dinamis `/${siteSlug}/login` (e.g. `/urgent/login`), sehingga pembeli/client yang mengeklik logo di site publik mereka langsung diarahkan ke portal login client site tersebut.

4. **Visibilitas & Kontrol Sinkron Custom Domain di Master Admin & Client Dashboard**:
   - Menambahkan field `customDomain` pada tipe `AdminSiteSummary` dan endpoint `GET/PUT /api/admin/sites`.
   - **Tabel Master Site (`MasterSiteTable.tsx`)**: Menampilkan indikator status domain kustom real-time (e.g. `🌐 urgent.com` hijau jika terisi/aktif, atau `/urgent` jika belum di-set).
   - **Sidebar Master Editor (`MasterSiteEditorSidebar.tsx`)**: Menambahkan input Custom Domain di tab Pengaturan, sehingga Master Admin dapat melihat status domain client dan membantu menginputkan/mengubah domain kustom client secara langsung dari Master Dashboard.

## File yang Dimodifikasi / Dibuat
- `src/hooks/useClientSiteAuth.ts` (NEW)
- `src/components/os/core/DesktopEnvironment.tsx`
- `docs/tracker/logs/sprint_66_client_site_admin_auth_isolation.md`
- `docs/tracker/INDEX_TRACKER.md`

## Status Verifikasi
- Typecheck (`tsc --noEmit`): **Passed** (0 error).
- Unit Tests (`npm test`): **Passed** (807 tests, 116 test files).
