/**
 * Shared Core — Input Validation
 * Common validators for forms and API inputs.
 *
 * @module
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email wajib diisi' };
  }
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email terlalu panjang' };
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Format email tidak valid' };
  }
  return { valid: true };
}

export function validatePassword(password: string, minLength = 8): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password wajib diisi' };
  }
  if (password.length < minLength) {
    return { valid: false, error: `Password minimal ${minLength} karakter` };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password terlalu panjang' };
  }
  return { valid: true };
}

export function validateSlug(slug: string): ValidationResult {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Slug wajib diisi' };
  }
  const trimmed = slug.trim().toLowerCase();
  if (trimmed.length < 3) {
    return { valid: false, error: 'Slug minimal 3 karakter' };
  }
  if (trimmed.length > 63) {
    return { valid: false, error: 'Slug maksimal 63 karakter' };
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(trimmed)) {
    return { valid: false, error: 'Slug hanya boleh huruf kecil, angka, dan dash' };
  }
  return { valid: true };
}

export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { valid: false, error: `${fieldName} wajib diisi` };
  }
  return { valid: true };
}

export function validateMaxLength(value: string, maxLength: number, fieldName: string): ValidationResult {
  if (typeof value === 'string' && value.length > maxLength) {
    return { valid: false, error: `${fieldName} maksimal ${maxLength} karakter` };
  }
  return { valid: true };
}
