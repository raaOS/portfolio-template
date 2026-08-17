import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  validateAdminRequestMock,
  verifyAdminPasswordMock,
  hashPasswordScryptMock,
  dbSetMock,
  dbRemoveMock,
  dbRefMock,
  getClientIdentifierMock,
  logAdminActivityMock,
} = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
  verifyAdminPasswordMock: vi.fn(),
  hashPasswordScryptMock: vi.fn(),
  dbSetMock: vi.fn(),
  dbRemoveMock: vi.fn(),
  dbRefMock: vi.fn(),
  getClientIdentifierMock: vi.fn(),
  logAdminActivityMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
  verifyAdminPassword: verifyAdminPasswordMock,
  hashPasswordScrypt: hashPasswordScryptMock,
}));

vi.mock('@/lib/database', () => ({
  db: { ref: dbRefMock },
}));

vi.mock('@/lib/security/request', () => ({
  getClientIdentifier: getClientIdentifierMock,
}));

vi.mock('@/lib/services/auditLogger', () => ({
  logAdminActivity: logAdminActivityMock,
}));

import { POST } from './route';

const HASH_OUTPUT = 'abcd1234abcd1234abcd1234abcd1234';
const originalPasswordSalt = process.env.PASSWORD_SALT;

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/admin/password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': 'a'.repeat(64),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/password', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dbRefMock.mockReturnValue({ set: dbSetMock, remove: dbRemoveMock });
    dbSetMock.mockResolvedValue(undefined);
    dbRemoveMock.mockResolvedValue(undefined);
    (process.env as Record<string, string | undefined>).PASSWORD_SALT = 'testsalt';
    hashPasswordScryptMock.mockReturnValue(HASH_OUTPUT);
    getClientIdentifierMock.mockReturnValue('1.2.3.4|TestBrowser');
    logAdminActivityMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    (process.env as Record<string, string | undefined>).PASSWORD_SALT = originalPasswordSalt;
  });

  it('returns 401 when validateAdminRequest fails', async () => {
    validateAdminRequestMock.mockResolvedValue(false);
    const res = await POST(makeRequest({ oldPassword: 'x', newPassword: 'newpassword123' }));

    expect(res.status).toBe(401);
  });

  it('returns 400 when oldPassword is missing', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    const res = await POST(makeRequest({ newPassword: 'newpassword123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Sandi lama wajib diisi');
  });

  it('returns 400 when newPassword is shorter than 8 characters', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    const res = await POST(makeRequest({ oldPassword: 'oldpassword', newPassword: 'short' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Sandi baru wajib diisi dan minimal 8 karakter');
  });

  it('returns 401 when old password is wrong', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    verifyAdminPasswordMock.mockResolvedValue(false);
    const res = await POST(
      makeRequest({ oldPassword: 'wrongold', newPassword: 'newpassword123' })
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Sandi lama tidak sesuai');
  });

  it('returns 200 success on valid password change', async () => {
    validateAdminRequestMock.mockResolvedValue(true);
    verifyAdminPasswordMock.mockResolvedValue(true);

    const res = await POST(
      makeRequest({ oldPassword: 'correctold', newPassword: 'newpassword123' })
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toBe('Sandi admin berhasil diubah.');
    expect(dbRefMock).toHaveBeenCalledWith('settings/adminPassword');
    expect(dbSetMock).toHaveBeenCalledWith(HASH_OUTPUT);
    expect(dbRefMock).toHaveBeenCalledWith('settings/adminPasswordOtp');
    expect(dbRemoveMock).toHaveBeenCalled();
    expect(logAdminActivityMock).toHaveBeenCalled();
  });
});
