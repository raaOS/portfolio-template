/**
 * Uji nyata fitur custom domain (v1.3.21) terhadap akun Cloudflare sungguhan.
 *
 * Tujuan: membuktikan `attachWorkerDomain()` (API PUT /accounts/{id}/workers/domains)
 * benar-benar menyambungkan hostname ke Worker, situs terbuka lewat HTTPS, dan
 * record bisa dilepas lagi sehingga akun kembali bersih.
 *
 * Skenario (flag --scenario):
 *   attach  → sambungkan HOSTNAME ke Worker, poll sampai situs terbuka, lalu
 *             LEPAS lagi (default, balik ke kondisi semula).
 *   keep    → seperti attach tapi record DIPERTAHANKAN (untuk inspeksi manual).
 *
 * Pemakaian:
 *   npx tsx scripts/onboarding/uji-custom-domain.ts --account-id <ID> [--scenario keep]
 *
 * Rahasia: API Token dibaca dari `arsip-klien/uji-domain/token.txt` (gitignored)
 * dan TIDAK PERNAH dicetak ke layar/log.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { attachWorkerDomain, normalizeDomain } from './custom-domain';
import type { CfApi, CfApiResult } from './custom-domain';

const HOSTNAME = 'uji.makeitbetter.my.id';
const SERVICE = 'portfolio-os-template';
const ARCHIVE_DIR = path.join(__dirname, '..', '..', 'arsip-klien', 'uji-domain');
const TOKEN_PATH = path.join(ARCHIVE_DIR, 'token.txt');
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 10_000;
const FETCH_TIMEOUT_MS = 15_000;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function cfApi(url: string, token: string, options: RequestInit = {}): Promise<CfApiResult> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${url}`, {
    ...options,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  // DELETE sering membalas 204 tanpa body → jangan dipaksa lewat res.json().
  const raw = await res.text();
  let data = {} as CfApiResult['data'];
  if (raw) {
    try {
      data = JSON.parse(raw) as CfApiResult['data'];
    } catch {
      /* body bukan JSON (mis. HTML error) → data kosong → success=false → ok=false */
    }
  }
  const success = raw === '' ? true : Boolean(data.success);
  return { ok: res.ok && success, status: res.status, data };
}

/** Cari record terpasang untuk HOSTNAME (untuk tahu id saat detach). */
async function findRecord(cF: CfApi, accountId: string, token: string) {
  const res = await cF(`/accounts/${accountId}/workers/domains`, token);
  if (!res.ok || !Array.isArray(res.data?.result)) return null;
  const list = res.data.result as Array<{ id?: string; hostname?: string }>;
  return list.find((d) => d.hostname === HOSTNAME) || null;
}

/** Ambil IP publik lewat DoH (dns.google) — tidak terpengaruh cache DNS lokal/router. */
async function resolveViaDoH(name: string, type: 'A' | 'AAAA'): Promise<string[]> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      }
    );
    const json = (await res.json()) as { Answer?: Array<{ type: number; data: string }> };
    const want = type === 'A' ? 1 : 28;
    return (json.Answer || []).filter((a) => a.type === want).map((a) => a.data);
  } catch {
    return [];
  }
}

/**
 * Coba buka situsnya lewat HTTPS. Sengaja TIDAK memakai resolver sistem:
 * DNS di belakang router bisa masih menyimpan cache NXDOMAIN (negatif, ~30 menit).
 * Sebagai gantinya: IP diambil dari DoH publik, lalu `curl --resolve` memaksa
 * koneksi ke IP itu dengan SNI/Host nama domain — verifikasi TLS sertifikat
 * tetap berjalan penuh (curl memvalidasi cert untuk HOSTNAME).
 */
async function tryOpenSite(): Promise<{ ok: boolean; detail: string }> {
  const ips = [...(await resolveViaDoH(HOSTNAME, 'A')), ...(await resolveViaDoH(HOSTNAME, 'AAAA'))];
  if (ips.length === 0) return { ok: false, detail: 'IP belum muncul di resolver publik (DoH)' };

  let last = '';
  for (const ip of ips.slice(0, 2)) {
    const hostPort = ip.includes(':') ? `[${ip}]` : ip;
    try {
      const code = execFileSync(
        'curl.exe',
        [
          '--resolve',
          `${HOSTNAME}:443:${hostPort}`,
          '-sS',
          '-L',
          '-o',
          'NUL',
          '-w',
          '%{http_code}',
          '--max-time',
          '15',
          `https://${HOSTNAME}/`,
        ],
        { encoding: 'utf-8' }
      ).trim();
      last = `HTTP ${code} via ${ip}`;
      if (code.startsWith('2') || code.startsWith('3')) return { ok: true, detail: last };
    } catch (err) {
      const stderr = String((err as { stderr?: string }).stderr || (err as Error).message).split(
        '\n'
      )[0];
      last = `${stderr} (via ${ip})`;
    }
  }
  return { ok: false, detail: last };
}

async function main() {
  const accountId = arg('account-id') || process.env.CLOUDFLARE_ACCOUNT_ID;
  const keep = process.argv.includes('--scenario') && arg('scenario') === 'keep';
  const hostname = normalizeDomain(HOSTNAME);

  if (!accountId)
    throw new Error('Pakai flag --account-id <id> (atau set env CLOUDFLARE_ACCOUNT_ID).');
  if (!fs.existsSync(TOKEN_PATH)) {
    throw new Error(`Token tidak ditemukan di ${TOKEN_PATH}. Simpan API Token ke berkas itu dulu.`);
  }
  const token = fs.readFileSync(TOKEN_PATH, 'utf-8').trim();
  if (!token) throw new Error('Berkas token kosong.');

  const log = (msg: string) => console.log(`[uji] ${msg}`);
  let attached = false;

  try {
    // 0. Preflight: bersihkan sisa attach sebelumnya (idempoten).
    const stale = await findRecord(cfApi, accountId, token);
    if (stale?.id) {
      log(`Ada sisa record lama (${stale.hostname}) → dilepas dulu.`);
      const del = await cfApi(`/accounts/${accountId}/workers/domains/${stale.id}`, token, {
        method: 'DELETE',
      });
      if (!del.ok)
        throw new Error(`Gagal melepas record lama: ${JSON.stringify(del.data?.errors)}`);
    }

    // 1. Token valid? (list juga dipakai preflight izin)
    const listCheck = await cfApi(`/accounts/${accountId}/workers/domains`, token);
    if (!listCheck.ok) {
      throw new Error(
        `Token ditolak API (HTTP ${listCheck.status}): ${JSON.stringify(listCheck.data?.errors)} ` +
          `→ cek izin token (Workers Scripts Write) atau Account ID.`
      );
    }
    log('Token diterima API Cloudflare. ✅');

    // 2. Attach
    const t0 = Date.now();
    const attachedResult = await attachWorkerDomain(cfApi, {
      accountId,
      apiToken: token,
      hostname,
      service: SERVICE,
    });
    attached = true;
    log(
      `Attach sukses: ${attachedResult.hostname} → Worker "${attachedResult.service}" (zone ${attachedResult.zoneName}) [${Date.now() - t0}ms]`
    );

    // 3. Poll sampai situs terbuka via HTTPS
    log(`Polling https://${hostname}/ (maks ${POLL_ATTEMPTS}×${POLL_INTERVAL_MS / 1000}s)...`);
    let siteOk = false;
    let lastDetail = '';
    for (let i = 1; i <= POLL_ATTEMPTS; i++) {
      const r = await tryOpenSite();
      lastDetail = r.detail;
      if (r.ok) {
        siteOk = true;
        log(
          `SITUS TERBUKA ✅ (${r.detail}) pada percobaan ke-${i} — total ${Math.round((Date.now() - t0) / 1000)}s`
        );
        break;
      }
      log(`percobaan ${i}/${POLL_ATTEMPTS} → ${r.detail}`);
      if (i < POLL_ATTEMPTS) await new Promise((r2) => setTimeout(r2, POLL_INTERVAL_MS));
    }
    if (!siteOk)
      throw new Error(
        `Situs tidak terbuka dalam ${POLL_ATTEMPTS} percobaan terakhir: ${lastDetail}`
      );

    if (keep) {
      log('Scenario keep → record DIPERTAHANKAN untuk inspeksi manual.');
      return;
    }

    // 4. Detach (kembali ke kondisi semula)
    const rec = await findRecord(cfApi, accountId, token);
    if (rec?.id) {
      const del = await cfApi(`/accounts/${accountId}/workers/domains/${rec.id}`, token, {
        method: 'DELETE',
      });
      if (!del.ok) throw new Error(`Gagal melepas record: ${JSON.stringify(del.data?.errors)}`);
      const after = await findRecord(cfApi, accountId, token);
      if (after) throw new Error('Record masih ada setelah DELETE.');
      log('Record DILEPAS, akun kembali bersih ✅');
    } else {
      log('Record tidak ditemukan saat detach (mungkin sudah dilepas otomatis).');
    }

    log('KESIMPULAN: attach → situs terbuka → detach, SEMUA SUKSES ✅');
  } catch (err) {
    // Selalu berusaha bersihkan meski gagal di tengah jalan.
    if (attached && !keep) {
      try {
        const rec = await findRecord(cfApi, accountId, token);
        if (rec?.id) {
          await cfApi(`/accounts/${accountId}/workers/domains/${rec.id}`, token, {
            method: 'DELETE',
          });
          log('Pembersihan darurat: record dilepas.');
        }
      } catch {
        log('Pembersihan darurat gagal — cek dashboard Cloudflare.');
      }
    }
    throw err;
  }
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(`[uji] GAGAL: ${err.message}`);
    process.exit(1);
  }
);
