import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  sanitize,
  validate,
  generateSecureToken,
  createScryptPasswordRecord,
  hashPasswordSha256,
  verifyStoredPassword,
} from '../security';

describe('security utils', () => {
  describe('generateSecureToken', () => {
    it('should generate a 64-character hex string', () => {
      const token = generateSecureToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('checkRateLimit', () => {
    const ip = '127.0.0.1';

    beforeEach(() => {
      resetRateLimit(ip);
    });

    it('should allow requests within limit', async () => {
      for (let i = 0; i < 5; i++) {
        expect(await checkRateLimit(ip)).toBe(true);
      }
    });

    it('should block requests exceeding limit', async () => {
      // Mocking 100 as the limit from the source code
      for (let i = 0; i < 100; i++) {
        await checkRateLimit(ip);
      }
      expect(await checkRateLimit(ip)).toBe(false);
    });
  });

  describe('sanitize', () => {
    it('should sanitize HTML', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = sanitize.html(input);
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('should sanitize rich text using a DOM allowlist', () => {
      const input =
        '<script>alert(1)</script><p onclick="alert(1)">Hello</p><input type="checkbox" checked onclick="evil()" data-note-checklist-item="true">';
      const sanitized = sanitize.richText(input);

      expect(sanitized).not.toContain('<script');
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).toContain('<p>Hello</p>');
      expect(sanitized).toContain('type="checkbox"');
      expect(sanitized).toContain('disabled=""');
      expect(sanitized).toContain('checked=""');
      expect(sanitized).toContain('data-note-checklist-item="true"');
    });

    it('should sanitize email', () => {
      expect(sanitize.email(' USER@Example.com ')).toBe('user@example.com');
    });

    it('should sanitize filenames', () => {
      expect(sanitize.filename('my document!.pdf')).toBe('my_document_.pdf');
      expect(sanitize.filename('.hidden')).toBe('filehidden');
    });

    it('should sanitize SQL', () => {
      expect(sanitize.sql('SELECT * FROM users; DROP TABLE--')).toBe(
        'SELECT * FROM users DROP TABLE'
      );
    });
  });

  describe('validate', () => {
    it('should validate strong passwords', () => {
      expect(validate.strongPassword('Short1!').valid).toBe(false);
      expect(validate.strongPassword('NoSpecial1').valid).toBe(false);
      expect(validate.strongPassword('ValidPassword1!').valid).toBe(true);
    });

    it('should validate emails', () => {
      expect(validate.email('invalid-email')).toBe(false);
      expect(validate.email('valid@email.com')).toBe(true);
    });
  });

  describe('password migration', () => {
    it('should validate legacy sha256 records and request a scrypt upgrade', () => {
      const password = 'CorrectHorseBatteryStaple!';
      const legacyRecord = {
        passwordHash: hashPasswordSha256(password),
        passwordAlgorithm: 'sha256' as const,
      };

      const result = verifyStoredPassword(password, legacyRecord);

      expect(result.valid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
      expect(result.upgradedRecord?.passwordAlgorithm).toBe('scrypt');
      expect(result.upgradedRecord?.passwordSalt).toBeTruthy();
    });

    it('should validate modern scrypt records without forcing an upgrade', () => {
      const password = 'CorrectHorseBatteryStaple!';
      const record = createScryptPasswordRecord(password);

      const result = verifyStoredPassword(password, record);

      expect(result.valid).toBe(true);
      expect(result.needsUpgrade).toBe(false);
      expect(result.upgradedRecord).toBeUndefined();
    });
  });

});
