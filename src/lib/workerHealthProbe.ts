import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getPublicBaseUrl } from '@/lib/constants';
import { getD1Value, setD1Value } from '@/lib/cloudflareD1';

/**
 * Probe kesehatan Worker harian — deteksi dini Error 1102 (Cloudflare:
 * "Worker exceeded CPU time limit").
 *
 * Latar belakang (lihat `docs/tracker/logs/error_1102_preview_iframe_diagnosis_2026_10_21.md`):
 * Error 1102 membunuh isolate, jadi TIDAK bisa ditangkap `try/catch` di dalam
 * aplikasi maupun oleh error tracker. Satu-satunya cara mengetahuinya dari dalam
 * tanpa memantau `wrangler tail` adalah mengukur **kepala ruang** — menembakkan
 * render dingin serentak dan menghitung berapa yang tumbang.
 *
 * Kepala ruang terukur pada 2026-10-22: 48 paralel bersih, 64 mulai ada 1102,
 * 96 tetap ada. Karena itu default 32 berada jauh di bawah ambang: probe normalnya
 * lulus, dan baru berubah merah kalau kepala ruang benar-benar menyusut.
 *
 * Sifatnya **prediktif, bukan retroaktif** — ia menjawab "kepala ruang berapa
 * hari ini", bukan "1102 terjadi kapan pada pengunjung nyata".
 */

/** Jumlah request serentak. Sengaja di bawah ambang patah (±50). */
export const PROBE_DEFAULT_CONCURRENCY = 32;

/** Batas tunggu per request; lewat ini dihitung gagal. */
export const PROBE_DEFAULT_TIMEOUT_MS = 20_000;

/** Halaman demo dipakai sebagai sasaran — satu-satunya route ISR berat di site. */
export const PROBE_DEFAULT_SLUG = 'spatial-gallery';

export const WORKER_HEALTH_KEY = 'worker-health/latest';
export const WORKER_HEALTH_HISTORY_KEY = 'worker-health/history';
export const WORKER_HEALTH_HISTORY_LIMIT = 7;

/** Halaman error Cloudflare memuat baris `error code: 1102`. */
const ERROR_1102_PATTERN = /error\s+code:\s*1102/i;

export interface WorkerHealthResult {
  /** Waktu probe dijalankan (ISO-8601, UTC). */
  probedAt: string;
  slug: string;
  target: string;
  /** Jalur yang dipakai: binding internal (gratis, tanpa jaringan) atau fetch publik. */
  transport: 'service-binding' | 'public-url';
  concurrency: number;
  ok: number;
  failed: number;
  /** Gagal karena Error 1102 — ini yang dicari pemilik site. */
  failed1102: number;
  timedOut: number;
  /** Rata-rata TTFB request yang berhasil, dalam ms. */
  avgTtfbMs: number | null;
  durationMs: number;
  passed: boolean;
}

export interface ProbeOptions {
  concurrency: number;
  timeoutMs: number;
  slug: string;
}

interface AttemptOutcome {
  ok: boolean;
  ttfbMs: number;
  status: number | null;
  is1102: boolean;
  timedOut: boolean;
}

interface SelfFetcher {
  fetchPage: (url: string, init: RequestInit) => Promise<Response>;
  transport: WorkerHealthResult['transport'];
}

/**
 * Pilih jalur panggilan.
 *
 * Utama: service binding `WORKER_SELF_REFERENCE` (binding yang sama yang dipakai
 * handler `scheduled`) — panggilan internal, tidak menyeberangi jaringan publik
 * sehingga hasilnya murni mencerminkan beban Worker, bukan latensi internet.
 *
 * Cadangan: fetch publik. Dipakai saat dev/unit test (bukan runtime Cloudflare)
 * atau bila binding tidak ada — `getCloudflareContext` melempar di luar runtime.
 */
async function resolveSelfFetcher(): Promise<SelfFetcher> {
  try {
    const context = await getCloudflareContext({ async: true });
    const env = context.env as unknown as Record<string, unknown>;
    const binding = env.WORKER_SELF_REFERENCE as
      | { fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> }
      | undefined;

    if (binding && typeof binding.fetch === 'function') {
      const bound = binding.fetch.bind(binding);
      return {
        transport: 'service-binding',
        fetchPage: (url, init) => bound(url, init),
      };
    }
  } catch {
    // Bukan runtime Cloudflare atau binding tidak tersedia — jatuh ke fetch publik.
  }

  return {
    transport: 'public-url',
    fetchPage: (url, init) => fetch(url, init),
  };
}

/**
 * Tembakkan `concurrency` request render-dingin serentak ke `/preview/<slug>`.
 *
 * Tiap request memakai query unik (`?probe=<stamp>-<i>`) supaya benar-benar
 * memaksa render ulang, bukan tersaji dari regional cache — tanpa itu probe hanya
 * mengukur cache dan tidak pernah mendekati batas CPU.
 *
 * Query unik menyisakan entri cache di Cache API; semua kedaluwarsa sendiri
 * dalam `revalidate` halaman preview (300 detik), jadi tidak menetap.
 */
export async function probeWorkerHealth(
  options: Partial<ProbeOptions> = {}
): Promise<WorkerHealthResult> {
  const concurrency = Math.max(1, options.concurrency ?? PROBE_DEFAULT_CONCURRENCY);
  const timeoutMs = options.timeoutMs ?? PROBE_DEFAULT_TIMEOUT_MS;
  const slug = options.slug ?? PROBE_DEFAULT_SLUG;

  const { fetchPage, transport } = await resolveSelfFetcher();
  const target = `${getPublicBaseUrl()}/preview/${slug}`;
  const stamp = Date.now();
  const startedAt = performance.now();

  const outcomes = await Promise.all(
    Array.from({ length: concurrency }, async (_, index): Promise<AttemptOutcome> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const attemptStart = performance.now();

      try {
        const response = await fetchPage(`${target}?probe=${stamp}-${index}`, {
          signal: controller.signal,
          headers: { accept: 'text/html' },
        });
        const ttfbMs = performance.now() - attemptStart;

        if (response.ok) {
          return { ok: true, ttfbMs, status: response.status, is1102: false, timedOut: false };
        }

        // Hanya respons non-200 yang dibaca isinya: halaman sukses 86 KB tidak
        // perlu diurai, sedangkan halaman error Cloudflare hanya puluhan byte.
        let body = '';
        try {
          body = await response.text();
        } catch {
          body = '';
        }

        return {
          ok: false,
          ttfbMs,
          status: response.status,
          is1102: ERROR_1102_PATTERN.test(body),
          timedOut: false,
        };
      } catch (error) {
        return {
          ok: false,
          ttfbMs: performance.now() - attemptStart,
          status: null,
          is1102: false,
          timedOut: error instanceof Error && error.name === 'AbortError',
        };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const okCount = outcomes.filter((outcome) => outcome.ok).length;
  const ttfbs = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.ttfbMs);

  return {
    probedAt: new Date().toISOString(),
    slug,
    target,
    transport,
    concurrency: outcomes.length,
    ok: okCount,
    failed: outcomes.length - okCount,
    failed1102: outcomes.filter((outcome) => !outcome.ok && outcome.is1102).length,
    timedOut: outcomes.filter((outcome) => outcome.timedOut).length,
    avgTtfbMs: ttfbs.length
      ? Math.round(ttfbs.reduce((sum, value) => sum + value, 0) / ttfbs.length)
      : null,
    durationMs: Math.round(performance.now() - startedAt),
    passed: okCount === outcomes.length,
  };
}

/**
 * Simpan hasil probe ke `app_kv`: entri terakhir untuk ditampilkan, plus riwayat
 * 7 hari untuk melihat tren.
 *
 * Dua tulis per hari — dijalankan hanya dari cron site owner.
 */
export async function recordWorkerHealth(result: WorkerHealthResult): Promise<void> {
  await setD1Value(WORKER_HEALTH_KEY, result);

  const existing = await getD1Value<WorkerHealthResult[]>(WORKER_HEALTH_HISTORY_KEY);
  const history = Array.isArray(existing) ? existing : [];
  await setD1Value(WORKER_HEALTH_HISTORY_KEY, [...history, result].slice(-WORKER_HEALTH_HISTORY_LIMIT));
}
