/**
 * Application-wide constants
 * Centralized configuration values for better maintainability
 */

/**
 * Animation Configuration
 */
export const ANIMATION = {
  /** Intersection Observer threshold for triggering scroll animations (0-1) */
  BLUR_THRESHOLD: 0.1,

  /** Duration of each animation step in seconds */
  STEP_DURATION: 0.35,

  /** Delay between word/letter animations in milliseconds */
  BLUR_DELAY: 200,

  /** Default root margin for Intersection Observer */
  ROOT_MARGIN: '0px',
} as const;

/**
 * Data Polling Configuration
 *
 * NOTE: Polling interval dinaikkan untuk hemat bandwidth CLOUDFLARE_D1.
 * Default: 30 detik (non-admin), 60 detik (admin).
 * StaleTime: 5 menit untuk cache client lebih lama.
 */
export const POLLING = {
  /** Auto-update interval in milliseconds (30 seconds - hemat bandwidth) */
  UPDATE_INTERVAL: 30000,

  /** Auto-update interval for admin (60 seconds - admin jarang perlu realtime) */
  ADMIN_UPDATE_INTERVAL: 60000,

  /** Client cache stale time (5 menit - jangan refetch jika data masih fresh) */
  CLIENT_STALE_TIME: 5 * 60 * 1000,

  /** Maximum number of retry attempts for failed requests */
  MAX_RETRIES: 3,

  /** Retry delay multiplier (exponential backoff) */
  RETRY_DELAY_BASE: 1000,
} as const;

/**
 * Layout Configuration
 */
export const LAYOUT = {
  /** Number of masonry columns on desktop (>1280px) */
  MASONRY_COLUMNS_DESKTOP: 4,

  /** Number of masonry columns on tablet (768-1280px) */
  MASONRY_COLUMNS_TABLET: 3,

  /** Number of masonry columns on mobile (<768px) */
  MASONRY_COLUMNS_MOBILE: 2,

  /** Maximum width for container (in pixels) */
  MAX_CONTAINER_WIDTH: 1200,
} as const;

/**
 * Cache & Revalidation
 */
export const CACHE = {
  /** ISR (Incremental Static Regeneration) revalidation time in seconds (1 hour) */
  REVALIDATE_TIME: 3600,

  /** Browser cache time for static assets (1 day in seconds) */
  STATIC_CACHE_TIME: 86400,
} as const;

/**
 * Toast Notification Configuration
 */
export const TOAST = {
  /** Default toast duration in milliseconds (5 seconds) */
  DEFAULT_DURATION: 5000,

  /** Error toast duration in milliseconds (6 seconds, longer for errors) */
  ERROR_DURATION: 6000,

  /** Maximum number of toasts shown simultaneously */
  MAX_TOASTS: 5,
} as const;

/**
 * Media & Upload Configuration
 */
export const MEDIA = {
  /** Maximum file size for uploads in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,

  /** Accepted image formats */
  IMAGE_FORMATS: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

  /** Accepted video formats */
  VIDEO_FORMATS: ['video/mp4', 'video/webm'],
} as const;

/**
 * Rate Limiting
 */
export const RATE_LIMIT = {
  /** Maximum requests per window */
  MAX_REQUESTS: 10,

  /** Rate limit window in milliseconds (1 minute) */
  WINDOW_MS: 60000,
} as const;

/**
 * Breakpoints (matching Tailwind defaults)
 */
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

/**
 * Transition Durations (in seconds)
 */
export const TRANSITIONS = {
  FAST: 0.15,
  NORMAL: 0.3,
  SLOW: 0.6,
} as const;

/**
 * Global Application Version (cache busting + /api/health + /api/os/version).
 * WAJIB sama dengan entri teratas CHANGELOG.md — dijaga test
 * `src/lib/constants.test.ts` supaya tidak pernah melenceng.
 */
export const APP_VERSION = '1.3.67';

/**
 * Canonical site URL — used as fallback when NEXT_PUBLIC_SITE_URL is not set.
 * Centralized here to avoid contradictory fallback values across modules.
 */
export const DEFAULT_SITE_URL = 'https://makeitbetter.my.id';

const LOOPBACK_BASE_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

/**
 * Base URL untuk link yang dibagikan ke pembeli lewat email/Telegram
 * (struk order, link aktivasi, notifikasi pembatalan/kedaluwarsa).
 *
 * Urutan: NEXT_PUBLIC_APP_URL → NEXT_PUBLIC_SITE_URL → DEFAULT_SITE_URL,
 * dengan dua aturan pengaman:
 *   - Mode development: localhost dipakai apa adanya (uji lokal).
 *   - Luar development: URL loopback DIABAIKAN — build `.env.local` lokal
 *     (bernilai http://localhost:3000) tidak boleh membuat email produksi
 *     menautkan pembeli ke link mati.
 */
export function getPublicBaseUrl(): string {
  const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

  if (process.env.NODE_ENV === 'development') {
    return trimTrailingSlash(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
  }

  for (const candidate of [process.env.NEXT_PUBLIC_APP_URL, process.env.NEXT_PUBLIC_SITE_URL]) {
    const value = candidate ? trimTrailingSlash(candidate) : '';
    if (value && !LOOPBACK_BASE_URL.test(value)) return value;
  }

  return DEFAULT_SITE_URL;
}

/**
 * Helper to get asset path with automatic cache busting for visitors
 * @param path The relative path to the asset (e.g. '/sounds/click.wav')
 */
export const getAssetPath = (path: string): string => {
  if (!path) return '';
  // If it already has a query param or is external, return as is
  if (path.includes('?') || path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }
  return `${path}?v=${APP_VERSION}`;
};
