import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifySiteUserJWTMock, getSessionNotBeforeMock } = vi.hoisted(() => ({
  verifySiteUserJWTMock: vi.fn(),
  getSessionNotBeforeMock: vi.fn(),
}));

vi.mock('./session', () => ({
  verifySiteUserJWT: verifySiteUserJWTMock,
  AUTH_COOKIE_NAME: 'site_user_token',
}));

vi.mock('@/lib/services/passwordResetService', () => ({
  getSessionNotBefore: getSessionNotBeforeMock,
}));

import { getSiteUserSession, isSessionRevoked } from './guard';

const SESSION = {
  userId: 'user-1',
  siteId: 'site-a',
  email: 'pemilik@contoh.com',
  role: 'admin',
};

function buildRequest(cookie?: string): Request {
  return new Request('http://localhost/admin', {
    headers: cookie ? { cookie } : {},
  });
}

describe('guard — pencabutan sesi setelah password diganti', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionNotBeforeMock.mockResolvedValue(null);
  });

  it('tanpa cookie -> null', async () => {
    expect(await getSiteUserSession(buildRequest())).toBeNull();
  });

  it('token valid, tanpa pencabutan -> sesi diterima', async () => {
    verifySiteUserJWTMock.mockResolvedValue({ ...SESSION, issuedAt: 1_800_000_000 });

    const session = await getSiteUserSession(buildRequest('site_user_token=abc'));

    expect(session?.userId).toBe('user-1');
  });

  it('token terbit SEBELUM pencabutan (lebih tua dari 5 dtk) -> sesi DITOLAK', async () => {
    // Tanda pencabutan "sekarang"; token terbit 1 menit sebelumnya.
    const notBefore = Date.now();
    getSessionNotBeforeMock.mockResolvedValue(notBefore);
    const iatLama = Math.floor((notBefore - 60_000) / 1000);
    verifySiteUserJWTMock.mockResolvedValue({ ...SESSION, issuedAt: iatLama });

    const session = await getSiteUserSession(buildRequest('site_user_token=abc'));

    expect(session).toBeNull();
  });

  it('token terbit SESUDAH pencabutan (login baru) -> sesi diterima', async () => {
    const notBefore = Date.now();
    getSessionNotBeforeMock.mockResolvedValue(notBefore);
    const iatBaru = Math.floor((notBefore + 60_000) / 1000);
    verifySiteUserJWTMock.mockResolvedValue({ ...SESSION, issuedAt: iatBaru });

    const session = await getSiteUserSession(buildRequest('site_user_token=abc'));

    expect(session?.userId).toBe('user-1');
  });

  it('toleransi 5 detik: sesi terbit < 5 dtk sebelum pencabutan TETAP diterima', async () => {
    const notBefore = Date.now();
    getSessionNotBeforeMock.mockResolvedValue(notBefore);
    // iat detik dibulatkan ke bawah — jangan sampai login tepat setelah reset ikut ditolak.
    const iatMepet = Math.floor((notBefore - 2_000) / 1000);
    verifySiteUserJWTMock.mockResolvedValue({ ...SESSION, issuedAt: iatMepet });

    const session = await getSiteUserSession(buildRequest('site_user_token=abc'));

    expect(session?.userId).toBe('user-1');
  });

  it('isSessionRevoked: tanpa tanda pencabutan -> false', async () => {
    getSessionNotBeforeMock.mockResolvedValue(null);

    expect(await isSessionRevoked({ ...SESSION, issuedAt: 1_800_000_000 })).toBe(false);
  });
});
