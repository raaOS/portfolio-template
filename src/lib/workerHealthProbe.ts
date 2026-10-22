import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getPublicBaseUrl } from '@/lib/constants';
import { getD1Value, setD1Value } from '@/lib/cloudflareD1';

/**
 * Probe kesehatan Worker harian — peringatan dini Error 1102 (Cloudflare:
 * "Worker exceeded CPU time limit").
 *
 * Latar belakang (lihat `docs/tracker/logs/error_1102_preview_iframe_diagnosis_2026_10_21.md`):
 * Error 1102 membunuh isolate, jadi TIDAK bisa ditangkap `try/catch` di dalam
 * aplikasi maupun oleh error tracker. Satu-satunya cara mengetahuinya dari dalam
 * tanpa memantau `wrangler tail` adalah memantau kondisi yang MELEMPARKAN-nya.
 *
 * YANG DIUKUR: **kesehatan cache**, bukan paksaan render. Keputusan ini lahir dari
 * percobaan di produksi 2026-10-23 yang membuktikan paksaan render TIDAK mungkin
 * dilakukan dari dalam aplikasi:
 *
 *   1. Query unik `?probe=` TIDAK mem-bust cache — halaman preview adalah ISR
 *      statis (`revalidate = 300`) sehingga cache key-nya pathname saja. Tiga URL
 *      unik terbukti semuanya `x-opennext-cache: HIT`.
 *   2. `/api/revalidate` (HMAC) melapor `{"revalidated":true}` tapi tetap `HIT` —
 *      `shouldLazilyUpdateOnCacheHit: false` membuat regional cache otoritatif
 *      sampai `max-age` 300 detiknya habis sendiri.
 *   3. Setelah TTL habis pun responsnya `STALE` (baca KV, sajikan basi, revalidasi
 *      SEKALI di latar), lalu `HIT` — tidak pernah ada render serentak.
 *   4. Burst 32 serentak tepat setelah purge: `{"HIT":32}` — nol miss.
 *
 * Jadi probe berhenti berpura-pura memaksa render dingin, dan mengukur hal yang
 * justru menjadi AKAR MASALAH: apakah cache masih melindungi.
 *
 * Logikanya: selama cache sehat, 32 request serentak lewat service binding selesai
 * ±34 ms dan semuanya tersaji dari cache tanpa render. Begitu cache berhenti
 * melindungi (kuota KV habis — pemicu persis Error 1102 pada 2026-10-21), request
 * yang sama ikut render semua: rasio cache runtuh di bawah ambang, latensi melonjak
 * ke ratusan milidetik, dan risiko 1102 ikut naik. Ketiganya terekam dalam satu run.
 *
 * Batas yang disadari: 32 jauh di bawah ambang patah terukur (48 bersih, 64 → 1102),
 * sehingga probe ini TIDAK akan mendeteksi 1102 lewat jumlah kegagalan semata.
 * Itulah sebabnya `passed` ditentukan oleh rasio cache, bukan oleh `failed`.
 *
 * Sifatnya tetap **prediktif, bukan retroaktif** — ia menjawab "perlindungan cache
 * masih utuh hari ini?", bukan "1102 terjadi kapan pada pengunjung nyata".
 */

/** Jumlah request serentak. Sengaja di bawah ambang patah (±50). */
export const PROBE_DEFAULT_CONCURRENCY = 32;

/**
 * Ambang rasio cache untuk dianggap sehat. Rasio = respons yang disaji dari cache
 * (HIT/STALE, tanpa render) dibagi total respons.
 *
 * 0.90 memberi ruang untuk beberapa miss yang wajar (mis. entri baru pertama kali
 * sehari). Di bawah ini berarti request ikut render — persis kondisi yang pada
 * 2026-10-21 menimbulkan Error 1102.
 */
export const PROBE_MIN_CACHE_HIT_RATIO = 0.9;

/** Batas tunggu per request; lewat ini dihitung gagal. */
export const PROBE_DEFAULT_TIMEOUT_MS = 20_000;

/**
 * Halaman demo dipakai sebagai sasaran. Sengaja tidak diganti-ganti: sejak ditemukan
 * bahwa query tidak mem-bust cache, URL-nya memang selalu sama — nilainya ada pada
 * pengukuran rasio cache dan latensi, bukan pada variasi URL.
 */
export const PROBE_DEFAULT_SLUG = 'spatial-gallery';

export const WORKER_HEALTH_KEY = 'worker-health/latest';
export const WORKER_HEALTH_HISTORY_KEY = 'worker-health/history';
export const WORKER_HEALTH_HISTORY_LIMIT = 7;

/**
 * Batas usia bacaan probe sebelum dianggap **kunO**.
 *
 * Cron berjalan sehari sekali (01:00 WIB), jadi 25 jam memberi ruang satu run
 * yang terlewat tanpa langsung berbunyi. Di luar batas ini portal menampilkan
 * peringatan.
 *
 * Alasan batas ini ada: bacaan yang gagal disimpan membuat angka LAMA terpajang
 * seolah angka segar — persis lampu hijau palsu. Angka yang usianya tidak
 * disebut sama sekali tidak bisa dipercaya, jadi usianya wajib ikut dihitung.
 */
export const WORKER_HEALTH_STALE_AFTER_MS = 25 * 60 * 60 * 1000;

/**
 * Apakah bacaan ini masih layak dipajang sebagai kondisi terkini?
 *
 * Mengembalikan `true` kalau tidak ada stempel waktu sama sekali atau stempel
 * waktunya tidak terbaca — dua-duanya berarti angka tersebut tidak bisa
 * dipertanggungjawabkan, bukan berarti sehat.
 */
export function isWorkerHealthStale(
  result: Pick<WorkerHealthResult, 'probedAt'> | null | undefined,
  now: number = Date.now()
): boolean {
  if (!result?.probedAt) return true;
  const at = Date.parse(result.probedAt);
  if (!Number.isFinite(at)) return true;
  return now - at > WORKER_HEALTH_STALE_AFTER_MS;
}

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
  /** Gagal karena Error 1102 — tetap dicatat walau bukan penentu `passed`. */
  failed1102: number;
  timedOut: number;
  /**
   * Respons yang disaji dari cache TANPA memicu render (`HIT` atau `STALE`).
   * Inilah angka penentu: turun = pengunjung ikut render = risiko 1102 naik.
   */
  cacheHit: number;
  /** Respons yang berakhir render (MISS / tanpa header cache). */
  cacheRendered: number;
  /** `cacheHit / concurrency`, dibulatkan 4 desimal. */
  cacheHitRatio: number;
  /** Rata-rata TTFB request yang berhasil, dalam ms. */
  avgTtfbMs: number | null;
  /** TTFB persentil 95 dalam ms — lonjakannya menandai render yang tertahan. */
  p95TtfbMs: number | null;
  durationMs: number;
  /**
   * Lulus hanya kalau tidak ada kegagalan DAN cache masih melindungi
   * (`cacheHitRatio >= PROBE_MIN_CACHE_HIT_RATIO`).
   */
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
  /** Nilai header `x-opennext-cache` (`HIT`/`STALE`/`MISS`), atau null bila tidak ada. */
  cacheStatus: string | null;
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
 * Tembakkan `concurrency` request serentak ke `/preview/<slug>` dan ukur dua hal:
 * apakah ada yang gagal, dan apakah cache masih menanganinya tanpa render.
 *
 * Catatan: request sengaja memakai query unik (`?probe=<stamp>-<i>`) **bukan** untuk
 * mem-bust cache — ternyata tidak bisa (lihat catatan di atas modul). Query itu
 * dipertahankan hanya agar tiap run tidak berbagi entri dengan run sebelumnya;
 * tetap tidak berbahaya karena seluruhnya kedaluwarsa dalam `revalidate` (300 detik).
 *
 * Header `x-opennext-cache` dibaca dari setiap respons. Membaca header gratis —
 * tidak perlu membuka body. Hanya respons non-200 yang body-nya dibuka, untuk
 * membedakan `error code: 1102` dari kegagalan lain.
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
        const cacheStatus = response.headers.get('x-opennext-cache');

        if (response.ok) {
          return {
            ok: true,
            ttfbMs,
            status: response.status,
            is1102: false,
            timedOut: false,
            cacheStatus,
          };
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
          cacheStatus,
        };
      } catch (error) {
        return {
          ok: false,
          ttfbMs: performance.now() - attemptStart,
          status: null,
          is1102: false,
          timedOut: error instanceof Error && error.name === 'AbortError',
          cacheStatus: null,
        };
      } finally {
        clearTimeout(timer);
      }
    })
  );

  const okCount = outcomes.filter((outcome) => outcome.ok).length;
  const ttfbs = outcomes.filter((outcome) => outcome.ok).map((outcome) => outcome.ttfbMs);

  // `HIT` dan `STALE` sama-sama dilindungi: keduanya menyaji dari cache TANPA
  // memicu render (STALE berarti menyajikan yang basi sambil revalidate di latar).
  // `MISS` atau header yang tidak ada = request benar-benar render — itulah yang
  // berjumlah banyak ketika kuota KV habis, dan itulah yang menimbulkan Error 1102.
  const cacheHit = outcomes.filter(
    (outcome) => outcome.cacheStatus === 'HIT' || outcome.cacheStatus === 'STALE'
  ).length;
  const cacheRendered = outcomes.length - cacheHit;
  const cacheHitRatio = outcomes.length
    ? Number((cacheHit / outcomes.length).toFixed(4))
    : 0;

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
    cacheHit,
    cacheRendered,
    cacheHitRatio,
    avgTtfbMs: ttfbs.length
      ? Math.round(ttfbs.reduce((sum, value) => sum + value, 0) / ttfbs.length)
      : null,
    p95TtfbMs: percentile(ttfbs, 95),
    durationMs: Math.round(performance.now() - startedAt),
    // Dua syarat: tidak ada yang jatuh, dan cache masih menahan beban. Gagal di
    // salah satu saja sudah cukup untuk ditandai merah.
    passed: okCount === outcomes.length && cacheHitRatio >= PROBE_MIN_CACHE_HIT_RATIO,
  };
}

/** Persentil sederhana (metode terdekat) dari daftar yang sudah tidak terurut. */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, index)]);
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
