/**
 * Exit-Intent Feedback helpers — session throttling flags & client identity.
 *
 * Dipisah dari ExitIntentFeedback.tsx supaya logika session storage bisa
 * dites terpisah dari UI modal. Detail throttling (mode sopan):
 * - `portfolio_os_exit_feedback_shown` → modal tidak muncul 2x per session
 *   (satu tab, sampai ditutup).
 * - `portfolio_os_exit_feedback_sent`  → setelah sukses submit, modal
 *   disable sampai user buka tab baru.
 * - `portfolio_os_client_id` (localStorage) → stable identifier supaya
 *   server bisa dedup lintas session. Bukan fingerprint — cukup random UUID.
 *
 * Layer pertahanan lapis kedua tetap di server: rate-limit per IP + dedup
 * per clientId (1 jam window).
 */

export const SESSION_SHOWN_KEY = 'portfolio_os_exit_feedback_shown';
export const SESSION_SENT_KEY = 'portfolio_os_exit_feedback_sent';
// localStorage — stable client identifier supaya server bisa dedup lintas
// session (berbeda dari sessionStorage flag yang reset tiap tab baru).
export const CLIENT_ID_KEY = 'portfolio_os_client_id';

/**
 * Baca session flags sekali di client. Server selalu return true (enabled)
 * supaya hydration konsisten; hook `useExitIntent` no-op di server jadi
 * perbedaan nilai awal aman.
 */
export function readEnabledFromSession(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const shown = sessionStorage.getItem(SESSION_SHOWN_KEY) === '1';
    const sent = sessionStorage.getItem(SESSION_SENT_KEY) === '1';
    return !shown && !sent;
  } catch {
    return true;
  }
}

/** Tandai modal sudah pernah muncul di session ini (best-effort). */
export function markFeedbackShown(): void {
  try {
    sessionStorage.setItem(SESSION_SHOWN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Tandai feedback sukses terkirim (best-effort). */
export function markFeedbackSent(): void {
  try {
    sessionStorage.setItem(SESSION_SENT_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * Generate or load stable clientId dari localStorage. Dipakai server untuk
 * dedup per-client tanpa perlu auth. Bukan fingerprint — cukup random UUID.
 */
export function getOrCreateClientId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    // crypto.randomUUID tersedia di semua browser target (Chrome 92+, FF 95+, Safari 15.4+)
    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(CLIENT_ID_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

export function detectDevice(): 'desktop' | 'tablet' | 'mobile' | null {
  if (typeof window === 'undefined') return null;
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}
