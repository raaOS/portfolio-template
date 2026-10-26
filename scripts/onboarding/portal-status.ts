/**
 * Health-check Status Board portal owner.
 *
 * Kenapa ada cadangan workers.dev: `WEBSITE_URL` boleh berisi custom domain yang
 * DNS-nya belum menyebar atau masih menyimpan cache negatif di jaringan owner.
 * Dulu satu kegagalan DNS langsung ditandai "Offline" padahal Worker hidup
 * (kejadian 2026-10-26: `makeitbatter.my.id` belum resolve di laptop owner,
 * sementara `/api/health` lewat workers.dev menjawab 200).
 *
 * Sekarang alamat pertama dicoba, lalu alamat cadangan. Hasilnya menandai jalur
 * mana yang benar-benar menjawab supaya UI bisa menulis "via workers.dev".
 */

export interface HealthProbeResult {
  online: boolean;
  httpStatus: number | null;
  latencyMs: number | null;
  deployedVersion: string | null;
  database: string | null;
  workerHealth: Record<string, unknown> | null;
  /** Host yang benar-benar menjawab, tanpa protokol. */
  answeredBy: string | null;
  /** true bila yang menjawab adalah alamat cadangan (bukan alamat pertama). */
  viaFallback: boolean;
}

/** Situs klien bisa butuh 4–5 detik; 8 detik terlalu ketat dan sempat salah "Offline". */
export const HEALTH_PROBE_TIMEOUT_MS = 12_000;

const OFFLINE: HealthProbeResult = {
  online: false,
  httpStatus: null,
  latencyMs: null,
  deployedVersion: null,
  database: null,
  workerHealth: null,
  answeredBy: null,
  viaFallback: false,
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

interface HealthBody {
  version?: string;
  database?: string;
  workerHealth?: Record<string, unknown> | null;
}

/**
 * Coba `baseUrls` berurutan sampai ada yang menjawab. Kegagalan jaringan
 * (DNS, timeout, koneksi ditolak) membuat percobaan lanjut ke alamat berikutnya.
 * Respons non-2xx tetap dianggap jawaban sah — Worker-nya hidup, statusnya memang
 * tidak sehat, dan mencoba alamat lain tidak akan mengubah apa pun.
 */
export async function probeClientHealth(
  baseUrls: string[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<HealthProbeResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? HEALTH_PROBE_TIMEOUT_MS;
  const urls = baseUrls.filter((u, i, arr) => Boolean(u) && arr.indexOf(u) === i);

  for (let i = 0; i < urls.length; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
      const res = await doFetch(`${urls[i].replace(/\/+$/, '')}/api/health`, {
        signal: controller.signal,
      });
      const latencyMs = Date.now() - start;
      let body: HealthBody | null = null;
      try {
        body = (await res.json()) as HealthBody;
      } catch {
        // health endpoint membalas non-JSON — tetap dianggap hidup tanpa detail.
      }
      return {
        online: res.ok,
        httpStatus: res.status,
        latencyMs,
        deployedVersion: body?.version || null,
        database: body?.database || null,
        workerHealth: body?.workerHealth || null,
        answeredBy: hostOf(urls[i]),
        viaFallback: i > 0,
      };
    } catch {
      // DNS gagal / timeout / ditolak → lanjut ke alamat cadangan.
    } finally {
      clearTimeout(timer);
    }
  }

  return { ...OFFLINE };
}
