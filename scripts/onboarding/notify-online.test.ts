/**
 * Test email "🎉 Website Sudah Online" (PK2, rencana v1.3.27).
 *
 * Dua hal yang dijaga:
 * 1. Jujur — email hanya berisi URL live yang diberikan portal SETELAH
 *    deploy sukses, tidak pernah mengarang alamat.
 * 2. Fail-safe — tanpa konfigurasi Resend / tanpa order / D1 mati / Resend
 *    menolak → `{ sent: false, reason }`, TIDAK pernah melempar (kegagalan
 *    email tidak boleh mengubah status deploy yang sudah sukses).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../cloudflare/backup-common', () => ({
  getCurrentD1DatabaseId: vi.fn(),
  queryD1ForDatabase: vi.fn(),
}));

import { getCurrentD1DatabaseId, queryD1ForDatabase } from '../cloudflare/backup-common';
import { listOrderSlugs, recordProvisionedSite, sendWebsiteOnlineEmail } from './notify-online';

const dbIdMock = vi.mocked(getCurrentD1DatabaseId);
const queryMock = vi.mocked(queryD1ForDatabase);

const ENV_KEYS = [
  'NOTIFICATION_PROVIDER',
  'NOTIFICATION_API_KEY',
  'NOTIFICATION_DEFAULT_FROM',
] as const;

const savedEnv: Record<string, string | undefined> = {};

function setResendEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
  process.env.NOTIFICATION_PROVIDER = overrides.NOTIFICATION_PROVIDER ?? 'resend';
  process.env.NOTIFICATION_API_KEY = overrides.NOTIFICATION_API_KEY ?? 're_test_key';
  process.env.NOTIFICATION_DEFAULT_FROM =
    overrides.NOTIFICATION_DEFAULT_FROM ?? 'Studio <halo@test.dev>';
}

beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  vi.clearAllMocks();
  dbIdMock.mockReturnValue('db_test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('sendWebsiteOnlineEmail', () => {
  it('tetap mencatat site_url ke D1 walau email tidak dikonfigurasi (tanpa fetch)', async () => {
    setResendEnv({ NOTIFICATION_API_KEY: '' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    queryMock.mockResolvedValueOnce([]); // UPDATE pencatatan bukti serah terima

    const result = await sendWebsiteOnlineEmail({
      slug: 'budi-site',
      websiteUrl: 'https://budi-site.sub-akun.workers.dev',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toContain('belum dikonfigurasi');
    expect(fetchMock).not.toHaveBeenCalled();
    // Pencatatan tetap jalan — inilah bukti serah terima untuk OrdersPanel.
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [, sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain('UPDATE orders');
    expect(sql).toContain('site_url');
    expect(sql).toContain('provisioned_at');
    expect(params?.[0]).toBe('https://budi-site.sub-akun.workers.dev');
  });

  it('melewati email bila slug tidak punya order di D1 owner', async () => {
    setResendEnv();
    queryMock.mockResolvedValueOnce([]); // UPDATE pencatatan
    queryMock.mockResolvedValueOnce([]); // SELECT order
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWebsiteOnlineEmail({
      slug: 'tidak-ada-order',
      websiteUrl: 'https://tidak-ada-order.sub-akun.workers.dev',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toContain('tidak ada order');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mengirim email "Sudah Online" berisi URL live yang benar ke pembeli order', async () => {
    setResendEnv();
    queryMock.mockResolvedValueOnce([]); // UPDATE pencatatan
    queryMock.mockResolvedValueOnce([
      { id: 'ORD-9', buyer_email: 'beli@test.com', buyer_name: 'Budi Santoso' },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const url = 'https://budi-site.sub-akun.workers.dev';
    const result = await sendWebsiteOnlineEmail({ slug: 'budi-site', websiteUrl: url });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [requestUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(requestUrl).toBe('https://api.resend.com/emails');

    const payload = JSON.parse(String(init.body));
    expect(payload.to).toBe('beli@test.com');
    expect(payload.subject).toContain('Sudah Online');
    // Subject TIDAK menebak alamat `<slug>.workers.dev` palsu.
    expect(payload.subject).not.toContain('budi-site');
    // Isi jujur: hanya URL live yang diberikan portal, tanpa alamat lain.
    expect(payload.text).toContain(url);
    expect(payload.text).toContain('ORD-9');
    expect(payload.text).toContain('WhatsApp');
    expect(payload.html).toContain(`href="${url}"`);
    expect(payload.text).not.toMatch(/makeitbetter\.my\.id/);
  });

  it('tidak melempar saat Resend menolak (HTTP 500)', async () => {
    setResendEnv();
    queryMock.mockResolvedValueOnce([]); // UPDATE pencatatan
    queryMock.mockResolvedValueOnce([
      { id: 'ORD-9', buyer_email: 'beli@test.com', buyer_name: 'Budi' },
    ]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWebsiteOnlineEmail({
      slug: 'budi-site',
      websiteUrl: 'https://budi-site.sub-akun.workers.dev',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toContain('500');
  });

  it('tidak melempar saat query D1 owner gagal', async () => {
    setResendEnv();
    queryMock.mockRejectedValue(new Error('D1 down'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWebsiteOnlineEmail({
      slug: 'budi-site',
      websiteUrl: 'https://budi-site.sub-akun.workers.dev',
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toContain('D1 down');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('recordProvisionedSite', () => {
  it('menulis site_url + provisioned_at ke order activated milik slug', async () => {
    queryMock.mockResolvedValueOnce([]);

    const result = await recordProvisionedSite(
      'budi-site',
      'https://budi-site.sub-akun.workers.dev'
    );

    expect(result.sent).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [, sql, params] = queryMock.mock.calls[0];
    expect(sql).toContain("status = 'activated'");
    expect(params?.[0]).toBe('https://budi-site.sub-akun.workers.dev');
    expect(params?.[1]).toBeTruthy(); // provisioned_at ISO timestamp
    expect(params?.[3]).toBe('budi-site');
  });

  it('melewati pencatatan bila D1 owner tidak dikonfigurasi', async () => {
    dbIdMock.mockReturnValue('');

    const result = await recordProvisionedSite('budi-site', 'https://b.workers.dev');

    expect(result.sent).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('tidak melempar saat UPDATE gagal', async () => {
    queryMock.mockRejectedValueOnce(new Error('D1 down'));

    const result = await recordProvisionedSite('budi-site', 'https://b.workers.dev');

    expect(result.sent).toBe(false);
    expect(result.reason).toContain('D1 down');
  });
});

describe('listOrderSlugs', () => {
  it('mengembalikan slug dari orders hidup', async () => {
    queryMock.mockResolvedValueOnce([
      { desired_slug: 'budi-site' },
      { desired_slug: 'citra-lab' },
    ]);

    await expect(listOrderSlugs()).resolves.toEqual(['budi-site', 'citra-lab']);
  });

  it('mengembalikan [] saat D1 owner belum terkonfigurasi', async () => {
    dbIdMock.mockReturnValue('');

    await expect(listOrderSlugs()).resolves.toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('mengembalikan [] saat query gagal (dropdown = best-effort)', async () => {
    queryMock.mockRejectedValueOnce(new Error('D1 down'));

    await expect(listOrderSlugs()).resolves.toEqual([]);
  });
});
