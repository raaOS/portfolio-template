/**
 * Shared Core — Change Password Handler
 * Self-service password change for authenticated site users.
 *
 * @module
 */
import { queryD1, bootstrapD1Schema } from '@/crud/shared/db/connection';
import { verifyStoredPassword, createScryptPasswordRecord, type StoredPasswordConfig } from './password';
import { setSessionNotBefore } from '@/lib/services/passwordResetService';

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export type ChangePasswordResult =
  | { success: true }
  | { success: false; error: string; status: number };

const MIN_PASSWORD_LENGTH = 8;

/**
 * Change password for an authenticated site user.
 * Verifies the current password before writing a fresh scrypt record.
 */
export async function changeSiteUserPassword(
  siteId: string,
  userId: string,
  request: ChangePasswordRequest
): Promise<ChangePasswordResult> {
  const { currentPassword, newPassword } = request;

  if (!currentPassword || !newPassword) {
    return { success: false, error: 'Password saat ini dan password baru wajib diisi', status: 400 };
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      success: false,
      error: `Password baru minimal ${MIN_PASSWORD_LENGTH} karakter`,
      status: 400,
    };
  }

  if (newPassword === currentPassword) {
    return {
      success: false,
      error: 'Password baru harus berbeda dari password saat ini',
      status: 400,
    };
  }

  await bootstrapD1Schema();

  const rows = await queryD1<{
    id: string;
    password_hash: string;
    password_salt: string | null;
    password_algorithm: string | null;
  }>(
    `SELECT id, password_hash, password_salt, password_algorithm
     FROM site_users
     WHERE site_id = ? AND id = ?
     LIMIT 1`,
    [siteId, userId]
  );

  const user = rows[0];
  if (!user) {
    return { success: false, error: 'Akun tidak ditemukan', status: 404 };
  }

  const config: StoredPasswordConfig = {
    passwordHash: user.password_hash,
    passwordSalt: user.password_salt ?? undefined,
    passwordAlgorithm: (user.password_algorithm as 'scrypt' | 'sha256') ?? undefined,
  };

  const { valid } = verifyStoredPassword(currentPassword, config);
  if (!valid) {
    return { success: false, error: 'Password saat ini salah', status: 401 };
  }

  // Always write a fresh scrypt record with a new salt.
  const record = createScryptPasswordRecord(newPassword);

  await queryD1(
    `UPDATE site_users
     SET password_hash = ?, password_salt = ?, password_algorithm = 'scrypt'
     WHERE id = ?`,
    [record.passwordHash, record.passwordSalt || '', user.id]
  );

  // Cabut semua sesi login lama (cookie stateless tidak bisa dihapus dari
  // sisi server) — guard menolak sesi yang terbit sebelum saat ini.
  await setSessionNotBefore(userId);

  return { success: true };
}
