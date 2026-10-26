import crypto from 'crypto';
import { hashPasswordScrypt } from '../../src/crud/shared/auth/password';
import { readEnvFile, upsertEnvFile } from './env-file';

export const VAULT_HASH_KEY = 'PORTAL_VAULT_HASH';
export const VAULT_SALT_KEY = 'PORTAL_VAULT_SALT';
export const VAULT_COOKIE_NAME = 'portal_vault';
export const VAULT_SESSION_TTL_MS = 120_000;
export const VAULT_MAX_FAILURES = 5;
export const VAULT_LOCK_MS = 5 * 60_000;

export interface VaultVerification {
  configured: boolean;
  valid: boolean;
}

export function isVaultConfigured(envPath: string): boolean {
  const env = readEnvFile(envPath);
  return Boolean(env[VAULT_HASH_KEY] && env[VAULT_SALT_KEY]);
}

/** Validasi password baru. Password tidak di-trim: spasi adalah karakter sah. */
export function validateNewVaultPassword(password: unknown): string | null {
  if (typeof password !== 'string') return 'Kata sandi brankas wajib diisi.';
  if (password.length < 12) return 'Kata sandi brankas minimal 12 karakter.';
  if (password.length > 200) return 'Kata sandi brankas maksimal 200 karakter.';
  return null;
}

export function createVaultPassword(envPath: string, password: string): void {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPasswordScrypt(password, salt);
  upsertEnvFile(envPath, {
    [VAULT_HASH_KEY]: hash,
    [VAULT_SALT_KEY]: salt,
  });
}

export function verifyVaultPassword(envPath: string, password: string): VaultVerification {
  const env = readEnvFile(envPath);
  const expectedHex = env[VAULT_HASH_KEY] || '';
  const salt = env[VAULT_SALT_KEY] || '';

  if (!expectedHex || !salt) return { configured: false, valid: false };
  // Batasi input sebelum scrypt agar permintaan raksasa tidak membebani portal.
  if (password.length === 0 || password.length > 1024) {
    return { configured: true, valid: false };
  }

  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(hashPasswordScrypt(password, salt), 'hex');
  if (expected.length === 0 || expected.length !== actual.length) {
    return { configured: true, valid: false };
  }

  return { configured: true, valid: crypto.timingSafeEqual(expected, actual) };
}

export interface AttemptStatus {
  allowed: boolean;
  attemptsLeft: number;
  retryAfterMs: number;
}

/** Pencatat percobaan buka brankas (in-memory, cukup untuk portal loopback). */
export class VaultAttemptLimiter {
  private readonly failures = new Map<string, { count: number; lockedUntil: number }>();

  constructor(
    private readonly maxFailures = VAULT_MAX_FAILURES,
    private readonly lockMs = VAULT_LOCK_MS,
    private readonly now: () => number = Date.now
  ) {}

  check(key: string): AttemptStatus {
    const record = this.failures.get(key);
    if (!record) {
      return { allowed: true, attemptsLeft: this.maxFailures, retryAfterMs: 0 };
    }

    const current = this.now();
    if (record.lockedUntil > current) {
      return {
        allowed: false,
        attemptsLeft: 0,
        retryAfterMs: record.lockedUntil - current,
      };
    }

    if (record.lockedUntil > 0) {
      this.failures.delete(key);
      return { allowed: true, attemptsLeft: this.maxFailures, retryAfterMs: 0 };
    }

    return {
      allowed: true,
      attemptsLeft: Math.max(0, this.maxFailures - record.count),
      retryAfterMs: 0,
    };
  }

  recordFailure(key: string): AttemptStatus {
    const current = this.now();
    const record = this.failures.get(key) ?? { count: 0, lockedUntil: 0 };
    if (record.lockedUntil > 0 && record.lockedUntil <= current) {
      record.count = 0;
      record.lockedUntil = 0;
    }

    record.count += 1;
    if (record.count >= this.maxFailures) {
      record.lockedUntil = current + this.lockMs;
    }
    this.failures.set(key, record);

    if (record.lockedUntil > current) {
      return {
        allowed: false,
        attemptsLeft: 0,
        retryAfterMs: record.lockedUntil - current,
      };
    }

    return {
      allowed: true,
      attemptsLeft: Math.max(0, this.maxFailures - record.count),
      retryAfterMs: 0,
    };
  }

  reset(key: string): void {
    this.failures.delete(key);
  }
}

/** Token sesi brankas berumur pendek; disimpan di memory, bukan di disk. */
export class VaultSessionStore {
  private readonly sessions = new Map<string, number>();

  constructor(
    private readonly ttlMs = VAULT_SESSION_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  create(): string {
    this.prune();
    const token = crypto.randomBytes(32).toString('hex');
    this.sessions.set(token, this.now() + this.ttlMs);
    return token;
  }

  verify(token: string | undefined): boolean {
    if (!token) return false;
    this.prune();
    const expiresAt = this.sessions.get(token);
    return Boolean(expiresAt && expiresAt > this.now());
  }

  revoke(token: string | undefined): void {
    if (token) this.sessions.delete(token);
  }

  private prune(): void {
    const current = this.now();
    for (const [token, expiresAt] of this.sessions) {
      if (expiresAt <= current) this.sessions.delete(token);
    }
  }
}

export function getCookie(cookieHeader: string | undefined, name: string): string {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    if (part.slice(0, eqIdx).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(eqIdx + 1).trim());
    } catch {
      return '';
    }
  }
  return '';
}
