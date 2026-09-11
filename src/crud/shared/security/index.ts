/**
 * Shared Core — Security Module
 * Re-exports all security utilities.
 *
 * @module
 */
export {
  validateEmail,
  validatePassword,
  validateSlug,
  validateRequired,
  validateMaxLength,
  type ValidationResult,
} from './validation';
