# Hardening Keamanan & Stabilitas — Audit Eksternal 2026-09-25 (v1.3.6)

- **Status:** 🟢 Completed
- **Tanggal:** 2026-09-25
- **Pemicu:** Permintaan user: audit skor nyata (performa, bug, keamanan) tanpa halusinasi → semua temuan terverifikasi lalu diperbaiki.

## Ringkasan Temuan & Perbaikan

### 1. Keamanan (CRITICAL → bersih)

| Temuan | Bukti awal | Aksi |
|---|---|---|
| Next.js 16.2.12 — Unauthenticated RCE (GHSA-p293-qw3h-jr36 + GHSA-2xp9-vwfh-vxw4 AVIF image-opt) | `npm audit --omit=dev` severity critical | Upgrade `next@16.3.6` |
| postcss <=8.5.22 path traversal sourceMappingURL | audit `node_modules/next/node_modules/postcss@8.5.14` | Override global `postcss@^8.5.28`; hapus nested 8.5.14 (lock regenerasi, dedup) |
| sharp libvips CVE-2026-333xx + libheif GHSA | audit | `sharp@0.35.4` (hanya dipakai script maintenance CLI — nol risiko runtime) |
| undici/ws/js-yaml/nanoid/brace-expansion high-moderate | audit | `npm audit fix` |
| vitest/@vitest/coverage-v8 moderate | audit | `vitest@4.1.11`, `@vitest/coverage-v8@4.1.11` |
| CSP tanpa `worker-src` (CSP middleware `src/middleware/utils.ts` sudah ada, tapi blob: worker FFmpeg bisa mati) | inspeksi | Tambah `worker-src 'self' blob:` |
| `JWT_SECRET || REVALIDATION_TOKEN` fallback di `src/lib/r2Storage.ts:387` = secret reuse signing/upload vs bearer revalidate | inspeksi | Wajib `JWT_SECRET`, fallback dihapus |
| Header `X-DNS-Prefetch-Control`, `Permissions-Policy`, COOP/COEP hanya ada di `next.config.mjs` headers (terduplikat/ditimpa) | inspeksi | Dipindah ke `addSecurityHeaders()` middleware (satu sumber, semua response tercover) |

**Hasil akhir:** `npm audit` = **0 vulnerability** (prod + dev).

### 2. Bug

| Bug | Lokasi | Perbaikan |
|---|---|---|
| Redirect mati: dua `async redirects()` di object literal yang sama → JS pakai definisi terakhir; `/works`, `/project`, `/home`, `/index`, `/indeks`, `/admin/templates` tidak aktif | `next.config.mjs` | Blok duplikat (kedua) dihapus. Verifikasi runtime `next start`: `/home` & `/works` → **308** |
| 2 type error `never` (ReactCompiler/infer) | `src/components/os/ui/DockProjectModes.tsx:143-144` | `icon: React.ElementType` → `icon: LucideIcon` |
| Test basi: UI grid switcher berubah jadi dropdown (commit `2aade7c`) tapi test masih cek toggle lama | `InfiniteCanvasRenderer.test.tsx` | Test ditulis ulang mengikuti pola dropdown |
| 20 file test gagal: peer dep `@testing-library/dom` hilang | devDeps | `npm i -D @testing-library/dom` |
| `.kilo/worktrees/**` (worktree agen lain) ter-scan vitest → duplikat gagal | `vitest.config.ts` | exclude `.kilo,.next,.open-next,.wrangler,.playwright-cli,.tmp` |
| Lint warning unused `isLoading` | `SpatialModelManager.tsx:22` | Param dihapus |

### 3. Performa (tidak diubah — rekomendasi lanjut)

- Client static asset 6.36MB; `images.unoptimized: true` (konsekuensi target Workers). Transform via Worker/R2 = pekerjaan terpisah (Sprint mendatang bila diminta).
- `performance-test-results.json` = self-check ambang sendiri, BUKAN Lighthouse/CWV — jangan dikutip sebagai skor performa.

## File Dimodifikasi

- `package.json`, `package-lock.json` (next 16.3.6, sharp 0.35.4, vitest 4.1.11, @testing-library/dom, postcss override)
- `next.config.mjs` (hapus `redirects()` duplikat)
- `src/components/os/ui/DockProjectModes.tsx`
- `src/components/templates/infinite-canvas/__tests__/InfiniteCanvasRenderer.test.tsx`
- `vitest.config.ts`
- `src/middleware/utils.ts` (CSP worker-src + header consolidation)
- `src/lib/r2Storage.ts` (pemisahan secret)
- `src/app/admin/system/components/SpatialModelManager.tsx`
- `CHANGELOG.md`, `docs/tracker/INDEX_TRACKER.md`, log ini

## Verifikasi

- `npx tsc --noEmit` → 0 error
- `npm run lint` → 0 error 0 warning
- `npm test` → 112 files / **851 tests PASS**
- `npm run build` → PASS
- `next start` smoke: header CSP/COOP/Permissions terpasang; `/home` & `/works` → 308 redirect
- `npm audit` → **0** vulnerabilities

## Catatan untuk AI Berikutnya

- Middleware `src/middleware/utils.ts::addSecurityHeaders` = satu-satunya sumber security header. Jangan tambah header keamanan baru di `next.config.mjs` (rawan tertimpa / tidak kena response redirect middleware).
- `redirects()` di next config object literal: **satu fungsi per key** — duplikat silent-overwrite.
- Deploy produksi perlu `opennextjs-cloudflare deploy` ulang (Next 16.3.6) — belum di-deploy pada sesi ini.
