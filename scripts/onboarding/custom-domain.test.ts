import { describe, expect, it } from 'vitest';
import {
  attachWorkerDomain,
  buildDomainHandoverMessage,
  findWorkerDomain,
  normalizeDomain,
  zoneNameOf,
  type CfApi,
  type CfApiResult,
} from './custom-domain';

/** cfApi palsu: mencatat panggilan & membalas sesuai skenario. */
function makeFakeCfApi(
  respond: (url: string, options: RequestInit | undefined) => CfApiResult
): CfApi & { calls: Array<{ url: string; options?: RequestInit }> } {
  const calls: Array<{ url: string; options?: RequestInit }> = [];
  const fake = (async (url: string, _token: string, options?: RequestInit) => {
    calls.push({ url, options });
    return respond(url, options);
  }) as CfApi & { calls: Array<{ url: string; options?: RequestInit }> };
  fake.calls = calls;
  return fake;
}

describe('normalizeDomain', () => {
  it('menghapus protokol, slash penutup, spasi, dan menyeragamkan huruf kecil', () => {
    expect(normalizeDomain('  HTTPS://BudiPratama.COM/  ')).toBe('budipratama.com');
    expect(normalizeDomain('http://portofolio.budi.com//')).toBe('portofolio.budi.com');
    expect(normalizeDomain('budipratama.com')).toBe('budipratama.com');
  });
});

describe('zoneNameOf', () => {
  it('mengambil 2 label terakhir sebagai zona', () => {
    expect(zoneNameOf('budipratama.com')).toBe('budipratama.com');
    expect(zoneNameOf('portofolio.budipratama.com')).toBe('budipratama.com');
    expect(zoneNameOf('a.b.budipratama.co.id')).toBe('budipratama.co.id');
    expect(zoneNameOf('portofolio.budipratama.co.uk')).toBe('budipratama.co.uk');
  });
});

describe('attachWorkerDomain', () => {
  const target = {
    accountId: 'acc123',
    apiToken: 'token-abc',
    hostname: 'portofolio.budipratama.com',
    service: 'budi-pratama',
  };

  it('mengirim PUT /accounts/{id}/workers/domains dengan body {hostname, service}', async () => {
    const cfApi = makeFakeCfApi(() => ({
      ok: true,
      status: 200,
      data: {
        success: true,
        result: {
          hostname: target.hostname,
          service: target.service,
          zone_name: 'budipratama.com',
        },
      },
    }));

    const attached = await attachWorkerDomain(cfApi, target);

    expect(cfApi.calls).toHaveLength(1);
    expect(cfApi.calls[0].url).toBe('/accounts/acc123/workers/domains');
    expect((cfApi.calls[0].options as RequestInit).method).toBe('PUT');
    expect(JSON.parse(String(cfApi.calls[0].options?.body))).toEqual({
      hostname: target.hostname,
      service: target.service,
    });
    expect(attached).toEqual({
      hostname: target.hostname,
      service: target.service,
      zoneName: 'budipratama.com',
    });
  });

  it('menampilkan pesan API + petunjuk berbahasa Indonesia saat API gagal', async () => {
    const cfApi = makeFakeCfApi(() => ({
      ok: false,
      status: 400,
      data: { success: false, errors: [{ message: 'Could not find zone.' }] },
    }));

    await expect(attachWorkerDomain(cfApi, target)).rejects.toThrow(
      /Could not find zone[\s\S]*nameserver[\s\S]*CNAME/i
    );
  });

  it('jatuh ke zone hasil hitung lokal bila API tidak mengembalikan zona', async () => {
    const cfApi = makeFakeCfApi(() => ({
      ok: true,
      status: 200,
      data: { success: true, result: {} },
    }));

    const attached = await attachWorkerDomain(cfApi, target);
    expect(attached.zoneName).toBe('budipratama.com');
  });
});

describe('findWorkerDomain', () => {
  const base = { accountId: 'acc123', apiToken: 'token-abc' };

  it('mengembalikan domain bila hostname ada di daftar', async () => {
    const cfApi = makeFakeCfApi(() => ({
      ok: true,
      status: 200,
      data: {
        success: true,
        result: [
          { hostname: 'lain.budipratama.com', service: 'x', zone_name: 'budipratama.com' },
          {
            hostname: 'portofolio.budipratama.com',
            service: 'budi-pratama',
            zone_name: 'budipratama.com',
          },
        ],
      },
    }));

    const found = await findWorkerDomain(cfApi, {
      ...base,
      hostname: 'portofolio.budipratama.com',
    });
    expect(found).not.toBeNull();
    expect(found?.service).toBe('budi-pratama');
  });

  it('mengembalikan null bila hostname belum terpasang', async () => {
    const cfApi = makeFakeCfApi(() => ({
      ok: true,
      status: 200,
      data: { success: true, result: [] },
    }));

    await expect(
      findWorkerDomain(cfApi, { ...base, hostname: 'portofolio.budipratama.com' })
    ).resolves.toBeNull();
  });

  it('mengembalikan null bila API list gagal (status tidak boleh melempar)', async () => {
    const cfApi = makeFakeCfApi(() => ({
      ok: false,
      status: 403,
      data: { success: false, errors: [{ message: 'forbidden' }] },
    }));

    await expect(
      findWorkerDomain(cfApi, { ...base, hostname: 'portofolio.budipratama.com' })
    ).resolves.toBeNull();
  });
});

describe('buildDomainHandoverMessage', () => {
  it('berisi domain, alamat https, dan nama klien — tanpa instruksi CNAME', () => {
    const msg = buildDomainHandoverMessage({
      clientName: 'Budi Pratama',
      domain: 'portofolio.budipratama.com',
    });

    expect(msg).toContain('Budi Pratama');
    expect(msg).toContain('https://portofolio.budipratama.com');
    expect(msg).toContain('otomatis');
    expect(msg).not.toMatch(/CNAME/i);
    expect(msg).not.toMatch(/record berikut/i);
  });
});
