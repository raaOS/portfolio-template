import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkDataRateLimitMock,
  resetPasswordWithTokenMock,
  getClientIPMock,
} = vi.hoisted(() => ({
  checkDataRateLimitMock: vi.fn(),
  resetPasswordWithTokenMock: vi.fn(),
  getClientIPMock: vi.fn(),
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: checkDataRateLimitMock,
}));

vi.mock('@/lib/services/passwordResetService', () => ({
  resetPasswordWithToken: resetPasswordWithTokenMock,
}));

vi.mock('@/lib/security/request', () => ({
  getClientIP: getClientIPMock,
}));

import { POST } from './route';

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getClientIPMock.mockReturnValue('8.8.8.8');
    checkDataRateLimitMock.mockResolvedValue({ allowed: true });
  });

  it('diblokir rate limit -> 429 dengan lamanya penantian, layanan tidak disentuh', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 1800 });

    const response = await POST(buildPost({ token: 't', newPassword: 'panjang-banget' }) as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain('30 menit');
    expect(resetPasswordWithTokenMock).not.toHaveBeenCalled();
  });

  it('token kosong -> diteruskan ke layanan (validasi ada di 1 tempat)', async () => {
    resetPasswordWithTokenMock.mockResolvedValue({
      success: false,
      error: 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.',
      status: 400,
    });

    const response = await POST(buildPost({ token: '', newPassword: 'panjang-banget' }) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('tidak valid');
  });

  it('token kedaluwarsa/terpakai -> 400 dengan pesan "minta tautan baru"', async () => {
    resetPasswordWithTokenMock.mockResolvedValue({
      success: false,
      error: 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.',
      status: 400,
    });

    const response = await POST(
      buildPost({ token: 'token-sudah-pakai', newPassword: 'panjang-banget' }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Minta tautan baru');
  });

  it('sukses -> 200 + arahan login', async () => {
    resetPasswordWithTokenMock.mockResolvedValue({ success: true });

    const response = await POST(
      buildPost({ token: 'token-valid', newPassword: 'panjang-banget' }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toContain('login');
    expect(resetPasswordWithTokenMock).toHaveBeenCalledWith(
      expect.any(String),
      'token-valid',
      'panjang-banget'
    );
  });

  it('galat tak terduga -> 500 jujur tanpa menyalahkan database', async () => {
    resetPasswordWithTokenMock.mockRejectedValue(new Error('D1 REST gagal sesaat'));

    const response = await POST(
      buildPost({ token: 't', newPassword: 'panjang-banget' }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/database/i);
  });
});
