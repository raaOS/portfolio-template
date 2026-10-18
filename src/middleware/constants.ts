/**
 * Middleware Constants — Definisi route protegeksi dan route publik.
 *
 * `protectedRoutes`: prefix path yang wajib melewati auth check + sliding-window
 * token refresh di proxy pipeline.
 *
 * `publicRoutes`: path yang dikecualikan dari auth check meskipun match prefix
 * protected (login, logout, check-auth, pin-verify).
 *
 * @module middleware/constants
 */

// Protected routes — proxy menjalankan auth check + sliding-window
// token refresh untuk request yang match prefix di sini.
//
// `/api/admin` ditambahkan supaya endpoint admin (termasuk
// `/api/admin/verify` yang dipakai BackgroundUploadContext sebagai
// heartbeat) lewat proxy auth pipeline. Tanpa ini, sliding refresh
// tidak akan trigger pada heartbeat ping → session admin bisa expired
// di tengah upload wallpaper besar.
//
// Catatan: route handler `/api/admin/*` umumnya sudah memanggil
// `validateAdminRequest`/`checkAdminAuth` sendiri. Adding ke proxy
// adalah extra layer (defense-in-depth) — kalau proxy reject, handler
// tidak kepanggil; kalau proxy approve, handler tetap re-validate.
export const protectedRoutes = ['/admin', '/api/admin'];

// Public routes — explicitly excluded dari auth check meski match
// `protectedRoutes`. Login endpoints harus di sini supaya user yang
// belum login bisa pernah login. Logout juga public supaya user dengan
// session expired tetap bisa clear cookie sisa. Check-auth harus public
// karena endpoint itu memang menjawab status auth untuk visitor/admin.
export const publicRoutes = [
  '/admin/login',
  '/admin/lupa-password',
  '/admin/reset-password',
  '/api/admin/check-auth',
  '/api/admin/login',
  '/api/admin/logout',
  '/api/admin/upload/direct',
  '/api/admin/pin/verify',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/check-auth',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

// Catatan: `/api/cron/*` sengaja TIDAK didaftarkan di sini. Path itu memang
// tidak pernah match `protectedRoutes` (hanya `/admin` dan `/api/admin`),
// jadi lolos auth by-design — pengaman utamanya ada di handler sendiri
// (`CRON_SECRET`, lihat `src/app/api/cron/daily/route.ts`), dan CSRF-nya
// diizinkan khusus untuk path ini di `src/middleware/csrf.ts`.

// Note: RATE_LIMIT_* previously defined here was removed. Rate limiting is
// enforced inside mutating handlers via `enforceRequestRateLimit` /
// `checkDataRateLimit`, not in Edge middleware — see `src/middleware.ts` comments.
