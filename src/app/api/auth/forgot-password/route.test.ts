import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  checkDataRateLimitMock,
  isEmailProviderConfiguredMock,
  requestPasswordResetMock,
  getClientIPMock,
} = vi.hoisted(() => ({
  checkDataRateLimitMock: vi.fn(),
  isEmailProviderConfiguredMock: vi.fn(),
  requestPasswordResetMock: vi.fn(),
  getClientIPMock: vi.fn(),
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: checkDataRateLimitMock,
}));

vi.mock('@/lib/services/passwordResetService', () => ({
  isEmailProviderConfigured: isEmailProviderConfiguredMock,
  requestPasswordReset: requestPasswordResetMock,
}));

vi.mock('@/lib/security/request', () => ({
  getClientIP: getClientIPMock,
}));

import { POST } from './route';

function buildPost(body: unknown): Request {
  return new Request('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getClientIPMock.mockReturnValue('7.7.7.7');
    checkDataRateLimitMock.mockResolvedValue({ allowed: true });
    isEmailProviderConfiguredMock.mockReturnValue(true);
    requestPasswordResetMock.mockResolvedValue({ emailSent: true });
  });

  it('diblokir rate limit -> 429 dengan lamanya penantian, layanan tidak disentuh', async () => {
    checkDataRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 3600 });

    const response = await POST(buildPost({ email: 'a@b.c' }) as never);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain('60 menit');
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('provider email belum dikonfigurasi -> 503 jujur "belum aktif" untuk SEMUA orang', async () => {
    isEmailProviderConfiguredMock.mockReturnValue(false);

    const response = await POST(buildPost({ email: 'a@b.c' }) as never);
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toContain('belum aktif');
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('email kosong -> 400', async () => {
    const response = await POST(buildPost({ email: '   ' }) as never);

    expect(response.status).toBe(400);
    expect(requestPasswordResetMock).not.toHaveBeenCalled();
  });

  it('email TERDAFTAR -> 200 dengan pesan generik', async () => {
    requestPasswordResetMock.mockResolvedValue({ emailSent: true });

    const response = await POST(buildPost({ email: 'pemilik@contoh.com' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.message).toContain('Jika email terdaftar');
  });

  it('anti-enumeration: email TIDAK terdaftar -> 200 dengan pesan IDENTIK', async () => {
    requestPasswordResetMock.mockResolvedValue({ emailSent: false });

    const response = await POST(buildPost({ email: 'tidak-ada@contoh.com' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    // Bandingkan langsung dengan pesan kasus email terdaftar.
    requestPasswordResetMock.mockResolvedValue({ emailSent: true });
    const responseTerdaftar = await POST(buildPost({ email: 'ada@contoh.com' }) as never);
    const bodyTerdaftar = await responseTerdaftar.json();

    expect(body.message).toBe(bodyTerdaftar.message);
  });

  it('layanan melempar galat internal -> tetap 200 generik (tidak bocor kegagalan)', async () => {
    requestPasswordResetMock.mockRejectedValue(new Error('D1 sedang sibuk'));

    const response = await POST(buildPost({ email: 'a@b.c' }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
  });
});
