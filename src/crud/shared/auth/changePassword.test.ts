import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryD1Mock, bootstrapD1SchemaMock } = vi.hoisted(() => ({
  queryD1Mock: vi.fn(),
  bootstrapD1SchemaMock: vi.fn(),
}));

vi.mock('@/crud/shared/db/connection', () => ({
  queryD1: queryD1Mock,
  bootstrapD1Schema: bootstrapD1SchemaMock,
}));

import { changeSiteUserPassword } from './changePassword';
import { createScryptPasswordRecord, hashPasswordSha256 } from './password';

describe('changeSiteUserPassword', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    bootstrapD1SchemaMock.mockResolvedValue(undefined);
  });

  function seedUser(record: { passwordHash: string; passwordSalt?: string; algorithm?: string }) {
    queryD1Mock.mockResolvedValueOnce([
      {
        id: 'user-1',
        password_hash: record.passwordHash,
        password_salt: record.passwordSalt ?? null,
        password_algorithm: record.algorithm ?? null,
      },
    ]);
  }

  it('validates missing fields', async () => {
    const result = await changeSiteUserPassword('site-1', 'user-1', {
      currentPassword: '',
      newPassword: '',
    });
    expect(result.success).toBe(false);
    expect(result).toEqual({ success: false, error: expect.any(String), status: 400 });
  });

  it('rejects short new password', async () => {
    const result = await changeSiteUserPassword('site-1', 'user-1', {
      currentPassword: 'PasswordLama123',
      newPassword: 'short',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
  });

  it('rejects new password identical to current', async () => {
    const result = await changeSiteUserPassword('site-1', 'user-1', {
      currentPassword: 'PasswordSama123',
      newPassword: 'PasswordSama123',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(400);
  });

  it('returns 404 when user is not found', async () => {
    queryD1Mock.mockResolvedValueOnce([]);

    const result = await changeSiteUserPassword('site-1', 'user-hilang', {
      currentPassword: 'PasswordLama123',
      newPassword: 'PasswordBaru123',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(404);
  });

  it('rejects wrong current password (401) without updating', async () => {
    seedUser(createScryptPasswordRecord('PasswordBenar123'));

    const result = await changeSiteUserPassword('site-1', 'user-1', {
      currentPassword: 'PasswordSalah123',
      newPassword: 'PasswordBaru123',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.status).toBe(401);
    expect(queryD1Mock).toHaveBeenCalledTimes(1);
  });

  it('updates to a fresh scrypt record on success', async () => {
    const oldRecord = createScryptPasswordRecord('PasswordLama123');
    seedUser(oldRecord);

    const result = await changeSiteUserPassword('site-1', 'user-1', {
      currentPassword: 'PasswordLama123',
      newPassword: 'PasswordBaru456',
    });

    expect(result.success).toBe(true);

    const updateCall = queryD1Mock.mock.calls[1];
    expect(updateCall[0]).toContain('UPDATE site_users');
    const [newHash, newSalt, targetId] = updateCall[1] as [string, string, string];
    expect(targetId).toBe('user-1');
    expect(newHash).not.toBe(oldRecord.passwordHash);
    expect(newSalt).not.toBe(oldRecord.passwordSalt);
    // New hash must verify against the new password with the new salt.
    const { verifyStoredPassword } = await import('./password');
    const check = verifyStoredPassword('PasswordBaru456', {
      passwordHash: newHash,
      passwordSalt: newSalt,
      passwordAlgorithm: 'scrypt',
    });
    expect(check.valid).toBe(true);
  });

  it('upgrades legacy sha256 password to scrypt on successful change', async () => {
    seedUser({
      passwordHash: hashPasswordSha256('PasswordLama123'),
      algorithm: 'sha256',
    });

    const result = await changeSiteUserPassword('site-1', 'user-1', {
      currentPassword: 'PasswordLama123',
      newPassword: 'PasswordBaru456',
    });

    expect(result.success).toBe(true);
    const updateCall = queryD1Mock.mock.calls[1];
    const updateSql = updateCall[0] as string;
    expect(updateSql).toContain("password_algorithm = 'scrypt'");
  });
});
