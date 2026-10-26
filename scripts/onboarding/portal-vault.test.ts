import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  VAULT_HASH_KEY,
  VAULT_SALT_KEY,
  VaultAttemptLimiter,
  VaultSessionStore,
  createVaultPassword,
  getCookie,
  isVaultConfigured,
  validateNewVaultPassword,
  verifyVaultPassword,
} from './portal-vault';

const tempDirs: string[] = [];

function makeEnvPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'portal-vault-'));
  tempDirs.push(dir);
  return path.join(dir, '.env.local');
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('vault password', () => {
  it('stores only a scrypt hash and salt, never the plain password', () => {
    const envPath = makeEnvPath();
    const password = 'kopi-hijau-bulan-72!';

    expect(isVaultConfigured(envPath)).toBe(false);
    createVaultPassword(envPath, password);

    const raw = fs.readFileSync(envPath, 'utf8');
    expect(raw).not.toContain(password);
    expect(raw).toContain(VAULT_HASH_KEY);
    expect(raw).toContain(VAULT_SALT_KEY);
    expect(isVaultConfigured(envPath)).toBe(true);
  });

  it('accepts the correct password and rejects a wrong one', () => {
    const envPath = makeEnvPath();
    createVaultPassword(envPath, 'password-brankas-yang-kuat');

    expect(verifyVaultPassword(envPath, 'password-brankas-yang-kuat')).toEqual({
      configured: true,
      valid: true,
    });
    expect(verifyVaultPassword(envPath, 'password-yang-salah')).toEqual({
      configured: true,
      valid: false,
    });
  });

  it('reports unconfigured when hash/salt are missing', () => {
    const envPath = makeEnvPath();
    expect(verifyVaultPassword(envPath, 'apa-saja')).toEqual({
      configured: false,
      valid: false,
    });
  });

  it('enforces a minimum length without trimming spaces', () => {
    expect(validateNewVaultPassword('pendek')).toBe(
      'Kata sandi brankas minimal 12 karakter.'
    );
    expect(validateNewVaultPassword('dua belas karakter')).toBeNull();
    expect(validateNewVaultPassword(123)).toBe(
      'Kata sandi brankas wajib diisi.'
    );
  });
});

describe('VaultAttemptLimiter', () => {
  it('locks after five failures and unlocks after five minutes', () => {
    let now = 1_000;
    const limiter = new VaultAttemptLimiter(5, 5 * 60_000, () => now);

    for (let i = 1; i <= 4; i += 1) {
      const result = limiter.recordFailure('127.0.0.1');
      expect(result.allowed).toBe(true);
      expect(result.attemptsLeft).toBe(5 - i);
    }

    const fifth = limiter.recordFailure('127.0.0.1');
    expect(fifth.allowed).toBe(false);
    expect(fifth.attemptsLeft).toBe(0);
    expect(limiter.check('127.0.0.1').allowed).toBe(false);

    now += 5 * 60_000 + 1;
    expect(limiter.check('127.0.0.1').allowed).toBe(true);
  });

  it('resets failures after a successful unlock', () => {
    const limiter = new VaultAttemptLimiter(5, 5 * 60_000, () => 1);
    limiter.recordFailure('key');
    limiter.reset('key');
    expect(limiter.check('key').attemptsLeft).toBe(5);
  });
});

describe('VaultSessionStore', () => {
  it('expires short-lived tokens', () => {
    let now = 1_000;
    const store = new VaultSessionStore(120_000, () => now);
    const token = store.create();

    expect(store.verify(token)).toBe(true);
    now += 120_001;
    expect(store.verify(token)).toBe(false);
  });

  it('revokes a token', () => {
    const store = new VaultSessionStore();
    const token = store.create();
    store.revoke(token);
    expect(store.verify(token)).toBe(false);
  });
});

describe('getCookie', () => {
  it('reads a cookie value and ignores other cookies', () => {
    expect(getCookie('a=1; portal_vault=abc123; b=2', 'portal_vault')).toBe('abc123');
    expect(getCookie(undefined, 'portal_vault')).toBe('');
    expect(getCookie('a=1', 'portal_vault')).toBe('');
  });
});
