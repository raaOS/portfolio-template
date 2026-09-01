/**
 * Shared Core — Security Module
 * Re-exports all security utilities.
 *
 * @module
 */
export { checkRateLimit } from './rateLimit';
export {
  validateEmail,
  validatePassword,
  validateSlug,
  validateRequired,
  validateMaxLength,
  type ValidationResult,
} from './validation';
