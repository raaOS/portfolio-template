/**
 * SSR-safe viewport dimensions helper — single source of truth.
 *
 * Dipakai oleh window manager, sticky notes, dan position sync.
 * Fallback 1440x900 menjaga hydration konsisten saat render di server.
 */
export function getViewport() {
  if (typeof window === 'undefined') return { width: 1440, height: 900 };
  return { width: window.innerWidth, height: window.innerHeight };
}
