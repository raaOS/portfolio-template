/**
 * Shared Core — CSRF Protection
 * Double-submit cookie pattern.
 *
 * @module
 */

/**
 * Generates a cryptographically secure random token.
 * @returns A 64-character hexadecimal string.
 */
export function generateSecureToken(): string {
  const array = new Uint8Array(32);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a random CSRF token.
 * @returns A 64-character hexadecimal string.
 */
export function generateCSRFToken(): string {
  return generateSecureToken();
}

/**
 * Validates a CSRF token against a session token.
 * @param token - The token provided in the request.
 * @param sessionToken - The token stored in the session/cookie.
 * @returns true if tokens match and are valid.
 */
export function validateCSRFToken(token: string, sessionToken: string): boolean {
  if (!token || !sessionToken) return false;
  if (token.length !== 64 || sessionToken.length !== 64) return false;
  if (!/^[a-f0-9]+$/i.test(token) || !/^[a-f0-9]+$/i.test(sessionToken)) return false;

  let diff = 0;
  for (let i = 0; i < token.length; i += 1) {
    diff |= token.charCodeAt(i) ^ sessionToken.charCodeAt(i);
  }
  return diff === 0;
}

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';
