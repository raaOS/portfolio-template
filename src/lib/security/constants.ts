/**
 * Security-related constants
 *
 * Single source of truth untuk nama cookie, header, dan key auth/CSRF.
 * Sebelumnya string literal tersebar di 10+ files — rawan typo drift
 * (mis. rename cookie di satu tempat tapi lupa di tempat lain) dan
 * mempersulit audit security.
 *
 * Jangan rename tanpa search-and-replace global. Cookie name dipakai di:
 * - middleware.ts (validation)
 * - middleware/auth.ts (sliding refresh)
 * - middleware/csrf.ts (CSRF token check)
 * - lib/auth.ts (signing/verification)
 * - app/api/admin/login/route.ts (set/clear cookie)
 * - app/api/admin/logout/route.ts
 */

/** Cookie name untuk admin JWT. Legacy `admin-token` dibaca untuk backward-compat. */
export const ADMIN_TOKEN_COOKIE = 'admin_token';

/** Legacy cookie name (read-only, untuk backward compat). */
export const ADMIN_TOKEN_COOKIE_LEGACY = 'admin-token';

/** Cookie name untuk client-site JWT. */
export const CLIENT_TOKEN_COOKIE = 'client_token';

/** Cookie name untuk CSRF token (di-share dengan client via GET /api/admin/login). */
export const CSRF_TOKEN_COOKIE = 'csrf_token';

/** Header name untuk CSRF token (dikirim dari client per mutation request). */
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

// FIX #49: Uniform maxAge untuk cookie CSRF token di semua endpoint.
// Sebelumnya bervariasi 1 jam / 7 hari antar route.
export const CSRF_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

/** Authorization header prefix untuk bearer token admin. */
export const BEARER_PREFIX = 'Bearer ';

/** Trusted proxy/CDN header untuk client IP detection (Cloudflare). */
export const CLOUDFLARE_CONNECTING_IP_HEADER = 'cf-connecting-ip';

/** Spoofable fallback headers (catat risiko di JSDoc). */
export const X_FORWARDED_FOR_HEADER = 'x-forwarded-for';
export const X_REAL_IP_HEADER = 'x-real-ip';

/** Identifier IP fallback kalau tidak ada header trusted. */
export const UNKNOWN_IP = 'unknown';
