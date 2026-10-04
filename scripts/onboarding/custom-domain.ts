/**
 * Penyambungan Custom Domain klien ke WORKER (migrasi dari Cloudflare Pages).
 *
 * Kenapa berpindah (v1.3.21): sejak perbaikan env D1/R2 per klien (v1.3.20),
 * situs klien dideploy sebagai Worker (`wrangler deploy --config
 * .open-next/wrangler.client.<slug>.jsonc`), bukan Cloudflare Pages. Pendaftaran
 * domain lama memakai API Pages (`/accounts/{id}/pages/projects/{slug}/domains`)
 * + instruksi CNAME ke `<slug>.pages.dev` → tidak berlaku lagi.
 *
 * API resmi yang dipakai sekarang (dokumen Cloudflare, dicek 2026-10-04):
 *   PUT /accounts/{account_id}/workers/domains   "Attach Worker Domain"
 *   body : { hostname, service }                 (zone_id/zone_name opsional)
 *   izin : Workers Scripts Write
 *   docs : https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/update/
 *
 * Prasyarat (dari dokumentasi Cloudflare):
 *   - zona/domain harus berada di akun Cloudflare yang sama dengan Worker;
 *   - hostname belum boleh punya record CNAME lama;
 *   - Cloudflare membuat DNS record + sertifikat HTTPS secara otomatis,
 *     jadi TIDAK ada instruksi CNAME manual untuk klien lagi.
 *
 * Pola pemakaian: modul ini murni — fungsi menerima `cfApi` (helper fetch yang
 * sudah ada di server.ts / cloud-manager.ts) sebagai argumen, sehingga bisa
 * diuji tanpa jaringan.
 */

export interface CfApiResult {
  ok: boolean;
  status: number;
  data: {
    success?: boolean;
    errors?: Array<{ message: string; code?: number }>;
    result?: unknown;
  };
}

export type CfApi = (url: string, token: string, options?: RequestInit) => Promise<CfApiResult>;

export interface WorkerDomainTarget {
  accountId: string;
  apiToken: string;
  hostname: string;
  /** Nama Worker = slug klien (sama dengan `name` di wrangler.client.<slug>.jsonc). */
  service: string;
}

export interface AttachedDomain {
  hostname: string;
  service: string;
  zoneName: string;
}

/** Normalisasi input pengguna: hapus protokol & slash penutup, jadi huruf kecil. */
export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

/** Label tingkat-2 yang lazim dipakai bersama ccTLD (co.id, co.uk, com.au). */
const SECOND_LEVEL_TLD = new Set([
  'co',
  'com',
  'net',
  'org',
  'gov',
  'ac',
  'or',
  'ne',
  'web',
  'gen',
]);

/**
 * Ambil nama zona (apex) dari hostname secara lokal.
 * Hanya cadangan tampilan bila API tidak mengembalikan zona:
 * `portofolio.budipratama.com` → `budipratama.com`,
 * `www.budipratama.co.id` → `budipratama.co.id`.
 */
export function zoneNameOf(hostname: string): string {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const ccTld = parts[parts.length - 1];
  const secondLevel = parts[parts.length - 2];
  if (ccTld.length === 2 && SECOND_LEVEL_TLD.has(secondLevel)) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}

/**
 * Sambungkan hostname ke Worker. Cloudflare membuat DNS record + HTTPS otomatis.
 * Melempar Error berbahasa Indonesia kalau gagal (pesan API Cloudflare ikut
 * disertakan agar mudah ditelusuri).
 */
export async function attachWorkerDomain(
  cfApi: CfApi,
  target: WorkerDomainTarget
): Promise<AttachedDomain> {
  const res = await cfApi(`/accounts/${target.accountId}/workers/domains`, target.apiToken, {
    method: 'PUT',
    body: JSON.stringify({ hostname: target.hostname, service: target.service }),
  });

  if (!res.ok) {
    const apiMsg =
      res.data?.errors?.[0]?.message || `kesalahan API Cloudflare (HTTP ${res.status})`;
    throw new Error(
      `Gagal menyambungkan domain "${target.hostname}" ke Worker "${target.service}": ${apiMsg}. ` +
        `Pastikan: (1) klien sudah pernah di-deploy, (2) nameserver domain sudah mengarah ke ` +
        `akun Cloudflare klien ini, dan (3) belum ada record CNAME lama untuk hostname tersebut.`
    );
  }

  const result = (res.data?.result || {}) as Partial<AttachedDomain> & { zone_name?: string };
  return {
    hostname: result.hostname || target.hostname,
    service: result.service || target.service,
    zoneName: result.zoneName || result.zone_name || zoneNameOf(target.hostname),
  };
}

/** Cari tahu apakah hostname sudah terpasang di Worker (untuk cek status). */
export async function findWorkerDomain(
  cfApi: CfApi,
  target: Pick<WorkerDomainTarget, 'accountId' | 'apiToken' | 'hostname'>
): Promise<AttachedDomain | null> {
  const res = await cfApi(`/accounts/${target.accountId}/workers/domains`, target.apiToken);
  if (!res.ok || !Array.isArray(res.data?.result)) return null;

  const list = res.data.result as Array<{
    hostname?: string;
    service?: string;
    zone_name?: string;
  }>;
  const found = list.find((d) => d.hostname === target.hostname);
  if (!found) return null;

  return {
    hostname: found.hostname || target.hostname,
    service: found.service || '',
    zoneName: found.zone_name || zoneNameOf(target.hostname),
  };
}

/**
 * Pesan WhatsApp serah terima domain (dipakai portal + CLI cloud-manager).
 * Sengaja TIDAK memuat instruksi CNAME — DNS diurus otomatis Cloudflare.
 */
export function buildDomainHandoverMessage(opts: { clientName: string; domain: string }): string {
  return [
    `Halo ${opts.clientName},`,
    ``,
    `Domain ${opts.domain} sudah terhubung ke website portofolio kamu. ✅`,
    ``,
    `Cloudflare sudah mengatur DNS dan sertifikat keamanan (HTTPS) secara otomatis, `,
    `jadi tidak perlu menambahkan record apa pun di tempat kamu membeli domain.`,
    ``,
    `Website kamu bisa dibuka di https://${opts.domain} (biasanya aktif dalam 5-15 menit). 🚀`,
  ].join('\n');
}
