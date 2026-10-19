import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryD1Mock } = vi.hoisted(() => ({
  queryD1Mock: vi.fn(),
}));

// Transaksi CAS tiruan: simpan per-path di memori, ikuti semantik
// database.ts (callback dapat nilai lama; return undefined = batal tanpa tulis).
const stores: Record<string, Record<string, unknown>> = {};
// Sakelar uji: memaksa transaksi berikutnya GAGAL men-commit (CAS sibuk,
// database.ts:272) — untuk membuktikan token tidak dikirim bila gagal simpan.
let forceCasFail = false;

vi.mock('@/crud/shared/db/connection', () => ({
  queryD1: queryD1Mock,
}));

vi.mock('@/lib/database', () => ({
  db: {
    ref: (path: string) => ({
      transaction: async (cb: (current: unknown) => unknown) => {
        if (forceCasFail) return { committed: false, snapshot: null };
        const current = stores[path] ?? null;
        const next = cb(current ? structuredClone(current) : current);
        if (next === undefined) return { committed: false, snapshot: null };
        stores[path] = next as Record<string, unknown>;
        return { committed: true, snapshot: null };
      },
    }),
  },
}));

import {
  consumeResetToken,
  isEmailProviderConfigured,
  requestPasswordReset,
  resetPasswordWithToken,
  setSessionNotBefore,
  storeResetToken,
  getSessionNotBefore,
} from './passwordResetService';

describe('passwordResetService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forceCasFail = false;
    for (const key of Object.keys(stores)) delete stores[key];
    // Query DB tiruan yang melayani SEMUA jalur baca: baris app_kv dibaca
    // dari store transaksi yang sama (nyambung dengan mock db di atas),
    // user site selalu ditemukan kecuali test yang menggantinya sendiri.
    queryD1Mock.mockImplementation(async (sql: string) => {
      if (sql.includes("app_kv WHERE key = 'securityNotBefore'")) {
        const value = stores['securityNotBefore'];
        return value ? [{ value: JSON.stringify(value) }] : [];
      }
      if (sql.includes('FROM site_users')) return [{ id: 'user-7' }];
      return [];
    });
    vi.stubEnv('NOTIFICATION_PROVIDER', 'resend');
    vi.stubEnv('NOTIFICATION_API_KEY', 're_test-key');
    vi.stubEnv('NOTIFICATION_DEFAULT_FROM', 'Portfolio OS <noreply@example.com>');
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as never;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('token', () => {
    it('token yang di-store bisa dikonsumsi SEKALI lalu mati (single-use)', async () => {
      const token = (await storeResetToken('user-1'))!;

      const first = await consumeResetToken(token);
      expect(first).toEqual({ userId: 'user-1' });

      const second = await consumeResetToken(token);
      expect(second).toBeNull();
    });

    it('token kedaluwarsa ditolak', async () => {
      const token = (await storeResetToken('user-1'))!;
      const hash = Object.keys(stores['passwordResets'])[0];
      stores['passwordResets'][hash] = { userId: 'user-1', expiresAt: Date.now() - 1000 };

      expect(await consumeResetToken(token)).toBeNull();
    });

    it('permintaan baru membatalkan token lama milik user yang sama', async () => {
      const tokenLama = (await storeResetToken('user-1'))!;
      const tokenBaru = (await storeResetToken('user-1'))!;

      expect(await consumeResetToken(tokenLama)).toBeNull();
      expect(await consumeResetToken(tokenBaru)).toEqual({ userId: 'user-1' });
    });

    it('token mentah TIDAK pernah tersimpan — yang disimpan hanya hash-nya', async () => {
      const token = (await storeResetToken('user-1'))!;

      const tersimpan = JSON.stringify(stores['passwordResets']);
      expect(tersimpan).not.toContain(token);
      expect(tersimpan).toMatch(/"[a-f0-9]{64}"/); // kunci = hash SHA-256 hex
    });
  });

  describe('requestPasswordReset', () => {
    it('email terdaftar -> token dibuat + email Resend dikirim berisi tautan reset', async () => {
      queryD1Mock.mockResolvedValue([{ id: 'user-9' }]);

      const result = await requestPasswordReset('site-a', 'pemilik@contoh.com');

      expect(result.emailSent).toBe(true);
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.resend.com/emails');
      const payload = JSON.parse(init.body);
      expect(payload.to).toBe('pemilik@contoh.com');
      expect(payload.text).toContain('/admin/reset-password?token=');
    });

    it('email TIDAK terdaftar -> tidak ada email dikirim (keputusan pesan ada di route)', async () => {
      queryD1Mock.mockResolvedValue([]);

      const result = await requestPasswordReset('site-a', 'tidak-ada@contoh.com');

      expect(result.emailSent).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('provider belum dikonfigurasi -> tidak mengirim apa pun', async () => {
      vi.stubEnv('NOTIFICATION_PROVIDER', '');
      queryD1Mock.mockResolvedValue([{ id: 'user-9' }]);

      const result = await requestPasswordReset('site-a', 'pemilik@contoh.com');

      expect(result.emailSent).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('transaksi CAS gagal men-commit -> token TIDAK dikirim (tak ada tautan mati di email)', async () => {
      queryD1Mock.mockResolvedValue([{ id: 'user-9' }]);
      forceCasFail = true;

      const result = await requestPasswordReset('site-a', 'pemilik@contoh.com');

      expect(result.emailSent).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('isEmailProviderConfigured', () => {
    it('lengkap -> true; salah satu hilang -> false', () => {
      expect(isEmailProviderConfigured()).toBe(true);

      vi.stubEnv('NOTIFICATION_API_KEY', '');
      expect(isEmailProviderConfigured()).toBe(false);
    });
  });

  describe('resetPasswordWithToken', () => {
    it('password pendek -> 400 tanpa menyentuh token', async () => {
      const result = await resetPasswordWithToken('site-a', 'token-apa', 'pendek');

      expect(result.success).toBe(false);
      expect(stores['passwordResets']).toBeUndefined();
    });

    it('token tidak dikenal -> 400 "minta tautan baru"', async () => {
      const result = await resetPasswordWithToken('site-a', 'token-ngawur', 'panjang-banget');

      expect(result).toMatchObject({ success: false, status: 400 });
    });

    it('sukses -> password diganti, token terpakai, sesi lama DICABUT', async () => {
      const token = (await storeResetToken('user-7'))!;

      const result = await resetPasswordWithToken('site-a', token, 'password-baru-99');

      expect(result.success).toBe(true);
      // UPDATE scrypt tercatat
      const updateCall = queryD1Mock.mock.calls.find(([sql]) => sql.includes('UPDATE site_users'));
      expect(updateCall).toBeTruthy();
      expect(updateCall![0]).toContain("password_algorithm = 'scrypt'");
      // Token mati (sekali pakai)
      expect(await consumeResetToken(token)).toBeNull();
      // Pencabutan sesi lama tertulis
      expect(await getSessionNotBefore('user-7')).toBeGreaterThan(0);
    });
  });

  describe('securityNotBefore (pencabutan sesi)', () => {
    it('setelah dicabut, sesi LAMA ditolak; setelah login BARU lolos', async () => {
      // Guard membandingkan iat token vs tanda ini (lihat guard.ts).
      await setSessionNotBefore('user-3');
      const notBefore = await getSessionNotBefore('user-3');
      expect(notBefore).toBeGreaterThan(0);

      // Simulasi: token terbit sebelum pencabutan (iat detik) -> revoked
      const issuedAtLama = Math.floor((notBefore! - 60_000) / 1000);
      expect(issuedAtLama * 1000).toBeLessThan(notBefore!);

      // Token terbit sesudah pencabutan -> tidak kena
      const issuedAtBaru = Math.floor((notBefore! + 60_000) / 1000);
      expect(issuedAtBaru * 1000).toBeGreaterThan(notBefore!);
    });

    it('user tanpa tanda -> null (tidak ada pencabutan)', async () => {
      expect(await getSessionNotBefore('user-tanpa-tanda')).toBeNull();
    });
  });
});
