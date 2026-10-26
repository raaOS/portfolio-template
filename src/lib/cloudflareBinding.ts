/**
 * Akses binding Cloudflare dari kode aplikasi (D1).
 *
 * Dipakai dua modul D1 yang hidup berdampingan:
 * - `src/lib/cloudflareD1.ts` — jalur `app_kv` + skema runtime.
 * - `src/crud/shared/db/connection.ts` — jalur CRUD bersama (login, settings,
 *   reset password, entitlement).
 *
 * Sebelum modul ini ada, `connection.ts` hanya bisa lewat REST sehingga token
 * D1 harus ikut ditanam di `vars` Worker klien. Binding `env.DB` menghapus
 * kebutuhan itu (audit 2026-10-24).
 */

/**
 * Bentuk minimal binding D1 (`env.DB`) yang dipakai di sini.
 *
 * Sengaja bukan tipe resmi `D1Database` dari `@cloudflare/workers-types`:
 * dependensi itu tidak ikut terpasang di repo ini, dan cukup struktural sesuai
 * panggilan yang dipakai (`prepare().bind().all()`).
 */
export interface D1BindingStatement {
  bind(...params: Array<string | number | boolean | null>): D1BindingStatement;
  all<T>(): Promise<{ results?: T[]; success?: boolean; error?: string }>;
}

export interface D1Binding {
  prepare(sql: string): D1BindingStatement;
}

/**
 * Simbol yang memegang konteks Cloudflare di global scope.
 *
 * Kontrak antar modul milik `@opennextjs/cloudflare`: dipasang oleh entrypoint
 * Worker (`dist/cli/templates/init.js`) dan dibaca oleh
 * `getCloudflareContextFromGlobalScope()`. `Symbol.for` dipakai di kedua sisi,
 * jadi identik walau lewat dua jalur modul berbeda.
 */
export const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__');

/**
 * True bila konteks Cloudflare hidup di global scope, artinya kode sedang
 * berjalan **di dalam Worker** (baik fetch biasa maupun handler cron — yang
 * mencapai aplikasi lewat `env.WORKER_SELF_REFERENCE.fetch()`).
 *
 * Pemeriksaan ini wajib, dan `NODE_ENV` saja tidak cukup. Saat `next build`
 * melakukan prerender, `NODE_ENV` **juga** `'production'`, tapi
 * `getCloudflareContext({ async: true })` tidak melempar — ia jatuh ke
 * `getPlatformProxy()` milik wrangler, yang menyerahkan D1 miniflare lokal yang
 * kosong. Akibatnya prerender membaca database yang salah dan build gagal
 * dengan `no such table: projects` (terbukti 2026-10-23). Prerender harus tetap
 * membaca database produksi remote lewat REST — itulah perilaku lama yang
 * berfungsi.
 *
 * Simbol ini absen saat build karena `next.config.mjs` repo ini tidak memanggil
 * `initOpenNextCloudflareForDev()`.
 */
export function hasLiveCloudflareContext(): boolean {
  return Reflect.get(globalThis, CLOUDFLARE_CONTEXT_SYMBOL) !== undefined;
}

/**
 * Ambil binding D1 `env.DB`, atau `null` bila tidak tersedia.
 *
 * Tiga penjaga berlapis, masing-masing menutup satu lingkungan yang memang
 * tidak boleh memakai binding:
 *
 * 1. `NODE_ENV !== 'production'` — dev lokal, unit test, dan 23 script
 *    pemeliharaan yang dijalankan lewat `tsx` di luar Cloudflare. Untuk yang
 *    terakhir, import **dinamis** di dalam `try/catch` juga diperlukan: import
 *    statis `@opennextjs/cloudflare` akan dimuat saat modul dibuka, dan kalau
 *    paket itu gagal dimuat di luar runtime, semua alat operasional ikut mati.
 * 2. `hasLiveCloudflareContext()` — menyingkirkan prerender `next build`, yang
 *    `NODE_ENV`-nya ikut `'production'` tapi D1-nya proxy lokal yang kosong.
 * 3. `try/catch` — kalau konteks tetap tidak bisa diambil, diam-diam kembali ke
 *    REST, yang selalu berfungsi di semua lingkungan.
 *
 * Hasilnya sengaja **tidak** di-memoisasi: kalau konteks belum siap pada
 * panggilan pertama, cache `null` akan menahan isolate itu pada REST selamanya
 * — dan kegagalan semacam itu justru yang paling sulit didiagnosis.
 */
export async function getD1Binding(): Promise<D1Binding | null> {
  if (process.env.NODE_ENV !== 'production') return null;
  if (!hasLiveCloudflareContext()) return null;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const context = await getCloudflareContext({ async: true });
    // Cast lewat `unknown`: `CloudflareEnv` (di-generate `npm run cf:typegen`)
    // adalah interface tanpa index signature, jadi cast langsung ke
    // `Record<string, unknown>` ditolak TypeScript. Pola yang sama sudah dipakai
    // `r2Storage.ts` untuk membaca binding dengan nama.
    const env = context?.env as unknown as Record<string, unknown> | undefined;
    return (env?.DB as D1Binding | undefined) ?? null;
  } catch {
    return null;
  }
}
