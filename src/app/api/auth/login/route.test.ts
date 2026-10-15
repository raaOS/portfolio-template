import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkDataRateLimitMock,
  resetDataRateLimitMock,
  authenticateUserMock,
  createLoginResponseMock,
  getClientIPMock,
} = vi.hoisted(() => ({
  checkDataRateLimitMock: vi.fn(),
  resetDataRateLimitMock: vi.fn(),
  authenticateUserMock: vi.fn(),
  createLoginResponseMock: vi.fn(),
  getClientIPMock: vi.fn(),
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: checkDataRateLimitMock,
  resetDataRateLimit: resetDataRateLimitMock,
}));

vi.mock('@/crud/shared/auth/login', () => ({
  authenticateUser: authenticateUserMock,
  createLoginResponse: createLoginResponseMock,
}));

vi.mock('@/lib/security/request', () => ({
  getClientIP: getClientIPMock,
}));

import { POST } from './route';

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login — rate limit & pesan', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getClientIPMock.mockReturnValue('9.9.9.9');
    checkDataRateLimitMock.mockResolvedValue({ allowed: true });
    resetDataRateLimitMock.mockResolvedValue(undefined);
    createLoginResponseMock.mockReturnValue(
      new Response(JSON.stringify({ success: true }), { status: 200 })
    );
  });

  it('menyampaikan LAMANYA penantian saat diblokir (429 bukan pesan kabur)', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 1800 });

    const response = await POST(buildPost({ email: 'a@b.c', password: 'x' }) as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain('30 menit');
    expect(response.headers.get('Retry-After')).toBe('1800');
    // Diblokir: jangan sentuh autentikasi sama sekali.
    expect(authenticateUserMock).not.toHaveBeenCalled();
  });

  it('membulatkan retryAfter pendek (mis. 60 detik gagal tulis D1) jadi ±1 menit', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const response = await POST(buildPost({ email: 'a@b.c', password: 'x' }) as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain('1 menit');
  });

  it('password salah -> 401, dan counter TIDAK direset (kegagalan tetap dihitung)', async () => {
    authenticateUserMock.mockResolvedValue({
      success: false,
      error: 'Email atau password salah',
    });

    const response = await POST(
      buildPost({ email: 'a@b.c', password: 'salah' }) as never
    );

    expect(response.status).toBe(401);
    expect(resetDataRateLimitMock).not.toHaveBeenCalled();
  });

  it('login SUKSES -> counter direset (guard brute-force hanya menghitung kegagalan)', async () => {
    authenticateUserMock.mockResolvedValue({ success: true, token: 'token-xyz' });

    const response = await POST(
      buildPost({ email: 'a@b.c', password: 'benar' }) as never
    );

    expect(response.status).toBe(200);
    expect(resetDataRateLimitMock).toHaveBeenCalledTimes(1);
    expect(resetDataRateLimitMock).toHaveBeenCalledWith('login_9.9.9.9');
    expect(createLoginResponseMock).toHaveBeenCalledWith('token-xyz');
  });

  it('login sah TETAP berhasil walau reset counter gagal (reset best-effort)', async () => {
    authenticateUserMock.mockResolvedValue({ success: true, token: 'token-xyz' });
    resetDataRateLimitMock.mockRejectedValue(new Error('D1 sedang sibuk'));

    const response = await POST(
      buildPost({ email: 'a@b.c', password: 'benar' }) as never
    );

    expect(response.status).toBe(200);
  });

  it('galat tak terduga -> 500 dengan pesan sementara yang jujur (bukan menyalahkan database)', async () => {
    authenticateUserMock.mockRejectedValue(new Error('D1 REST gagal sesaat'));

    const response = await POST(
      buildPost({ email: 'a@b.c', password: 'benar' }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).not.toMatch(/database/i);
    expect(body.error).toContain('Coba lagi');
  });
});
