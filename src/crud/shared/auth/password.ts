/**
 * Shared Core — Password Hashing
 * Scrypt + SHA256 dengan upgrade path.
 *
 * @module
 */
import crypto from 'crypto';

export type PasswordAlgorithm = 'sha256' | 'scrypt';

export interface StoredPasswordConfig {
  passwordHash: string;
  passwordSalt?: string;
  passwordAlgorithm?: PasswordAlgorithm;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();

  if (!/^[a-f0-9]+$/.test(normalizedA) || !/^[a-f0-9]+$/.test(normalizedB)) {
    return false;
  }

  const bufA = Buffer.from(normalizedA, 'hex');
  const bufB = Buffer.from(normalizedB, 'hex');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

export function hashPasswordSha256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function hashPasswordScrypt(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function createScryptPasswordRecord(password: string): StoredPasswordConfig {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPasswordScrypt(password, passwordSalt);

  return {
    passwordHash,
    passwordSalt,
    passwordAlgorithm: 'scrypt',
  };
}

export function verifyStoredPassword(
  password: string,
  config: StoredPasswordConfig
): { valid: boolean; needsUpgrade: boolean; upgradedRecord?: StoredPasswordConfig } {
  if (!password || !config.passwordHash) {
    return { valid: false, needsUpgrade: false };
  }

  const algorithm = config.passwordAlgorithm ?? (config.passwordSalt ? 'scrypt' : 'sha256');

  if (algorithm === 'scrypt') {
    if (!config.passwordSalt) {
      return { valid: false, needsUpgrade: false };
    }

    const inputHash = hashPasswordScrypt(password, config.passwordSalt);
    return {
      valid: timingSafeEqualHex(inputHash, config.passwordHash),
      needsUpgrade: false,
    };
  }

  const inputHash = hashPasswordSha256(password);
  const valid = timingSafeEqualHex(inputHash, config.passwordHash);

  if (!valid) {
    return { valid: false, needsUpgrade: false };
  }

  return {
    valid: true,
    needsUpgrade: true,
    upgradedRecord: createScryptPasswordRecord(password),
  };
}
