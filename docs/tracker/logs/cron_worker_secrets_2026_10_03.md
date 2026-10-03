# Cron Harian Cloudflare + Pemindahan Rahasia ke Worker Secrets (v1.3.19)

**Tanggal:** 2026-10-03 → 2026-10-04  
**Pemicu:** Pilihan owner atas dua opsi kerja berikutnya — *"Push sekarang"* (selesai, entri 129) dan *"Cron harian + rahasia Worker"*.  
**Status log ini:** dikerjakan, bagian verifikasi akhir diisi setelah deploy.

## Konteks / Masalah

1. **`sweepExpiredOrders()` hanya jalan saat admin membuka panel Order.** Kalau panel tidak dibuka, order yang lewat masa berlakunya tetap berstatus "pending" tanpa batas waktu. Dokumen kode sudah menulis harapan *"dapat dijadwalkan via cron"* (`orderService.ts:193-196`) tetapi tidak ada penjadwalnya sama sekali.
2. **Seluruh rahasia produksi hidup sebagai nilai yang di-inline saat `next build`**, bukan sebagai konfigurasi platform. `wrangler secret list` = `[]`. Konsekuensinya: mengganti rahasia = wajib build + deploy ulang, dan nilai lama di `.env.local` tetap menentukan perilaku produksi.

## Keputusan Desain

| Keputusan | Pilihan | Alasan |
|---|---|---|
| Tempat schedule | `wrangler.jsonc` → `triggers.crons: ["0 18 * * *"]` (01:00 WIB) | Schema wrangler memakai `triggers.crons`, **bukan** top-level `crons` (top-level memunculkan warning `Unexpected fields found in top-level field: "crons"`). |
| Handler `scheduled` | Diekspor oleh `scripts/cloudflare/prepare-opennext-worker-output.js` ke `.open-next/worker.js` | `@opennextjs/cloudflare` tidak mengekspor `scheduled` (0 match di `dist`), sedangkan `pre-deploy-check.js:103` mewajibkan `wrangler.jsonc` `main` tetap `.open-next/worker.js` → pendekatan post-build patch konsisten dengan 6 patch lain di skrip itu. |
| Cara memanggil aplikasi | Service binding `WORKER_SELF_REFERENCE` → `POST /api/cron/daily` | Binding itu **sudah dipakai** aplikasi untuk ISR revalidation (komentar `wrangler.jsonc:28-29`), jadi bukan pola baru; request sepenuhnya internal (tidak melewati DNS/publik). |
| `await` vs `ctx.waitUntil` | **`await`** | Versi pertama (`waitUntil`) membuat kegagalan sunyi — promise yang reject tidak menggagalkan invocation cron. Dengan `await`, endpoint yang gagal = run cron gagal = terlihat di log/observability Cloudflare. |
| Pengaman endpoint | Header `x-cron-secret` vs `CRON_SECRET`, `crypto.timingSafeEqual` + penjaga panjang | Endpoint bisa diakses publik; pola sama dengan webhook Telegram (audit 2026-09-29). |
| Method endpoint | `POST` + `/api/cron` masuk allowlist CSRF (`src/middleware/csrf.ts`) | Konsisten dengan `/api/revalidate` (webhook token-protected). `/api/cron` sengaja **tidak** masuk `protectedRoutes`/`publicRoutes` — dicatat di komentar `src/middleware/constants.ts`. |
| Jika `CRON_SECRET` kosong | Run dilewati dengan `console.warn` (bukan error) | Fitur cron bersifat opsional; deploy baru tanpa secret tidak boleh membanjiri log dengan error. |
| Key yang dipindah ke Worker secret | 12 key rahasia (auth, notifikasi, kredensial D1/R2, cron) | `NEXT_PUBLIC_*` sengaja tidak: nilainya memang harus tertanam di bundle klien. |

## Perubahan Berkas

- `src/app/api/cron/daily/route.ts` (**baru**) — `POST`, verifikasi timing-safe, panggil `sweepExpiredOrders()`.
- `src/app/api/cron/daily/route.test.ts` (**baru**) — 6 test (500 tanpa secret, 401 tanpa/salah/beda-panjang, 200 sukses, 500 saat sweep gagal).
- `src/middleware/csrf.ts` — allowlist `/api/cron`.
- `src/middleware/constants.ts` — komentar penjelas kenapa `/api/cron` tidak didaftarkan.
- `wrangler.jsonc` — `triggers.crons`.
- `scripts/cloudflare/prepare-opennext-worker-output.js` — fungsi `appendScheduledCronHandler()`.
- `scripts/cloudflare/put-worker-secrets.ts` (**baru**) — kelasik pemindahan rahasia (dry-run default, `--apply`, `--keys=`).
- `package.json` — script `cf:secrets`.
- `.env.example`, `.dev.vars.example` — key `CRON_SECRET`.
- `docs/operations/monitoring-runbook.md` — dua bagian baru (*Daily Cron Trigger*, *Rotasi Rahasia*) + item checklist harian.
- `docs/product-boundary/env-inventory.md` — `CRON_SECRET` di Product Optional.

## Fakta Terverifikasi

| # | Klaim | Bukti |
|---|---|---|
| 1 | Gate kualitas hijau | `npx tsc --noEmit` **0 error**; `npx eslint src` **0 error**; `npm test` = **115 file / 887 test PASS** (881 sebelumnya + 6 baru); `npm run release:audit` **62/62**; `npm run release:sale-readiness` **13/13**; `npm run pre-deploy` **EXIT 0** + compat-audit **0 blocker**. |
| 2 | Build menciptakan handler cron | Log build: `[cloudflare-build] Appended cron scheduled handler to Worker entry.` dan `.open-next/worker.js` berakhir dengan `export async function scheduled(_event, env)`. |
| 3 | Jadwal terpasang di produksi | Keluaran deploy: `Deployed portfolio-os-template triggers` + **`schedule: 0 18 * * *`**, **Version ID `6f2bd3ae-1b2d-4ebe-9bef-19fbd7f3002e`** (versi sebelumnya `7b22330a` untuk iterasi pertama). |
| 4 | Endpoint cron bekerja di produksi | `POST https://makeitbetter.my.id/api/cron/daily` + header token → **200** `{"ok":true,"ranAt":"2026-10-03T17:07:49.508Z"}`; token salah → **401**; tanpa header → **401** (diuji pada build sebelumnya dan setelah build `await`). |
| 5 | Pemindahan rahasia berhasil | `wrangler secret list` **`[]` → 12 key**; smoke produksi **6/6 PASS sebelum dan sesudah** pemindahan (bukti runtime tidak berubah). |
| 6 | Endpoint teruji otomatis | `npx vitest run src/app/api/cron/daily/route.test.ts` = **6 test PASS**. |
| 7 | **Fire cron pertama (01:00 WIB)** | **BELUM — menunggu jadwal.** Rencana verifikasi: baca `platform_settings.billing_expire_sweep_at` (nilai epoch ms) via REST D1 sebelum dan sesudah 18:00 UTC; nilai harus bergeser ke sekitar waktu fire, yang membuktikan `scheduled` → service binding → endpoint → sweeper berjalan penuh di produksi. |

## Hasil Uji yang TIDAK bisa dipakai (dicatat agar tidak diulang)

- `wrangler dev --test-scheduled` (lokal): `/__scheduled` pernah menjawab 200 lalu **`The Workers runtime crashed unexpectedly`**, percobaan kedua **menggantung 120 detik**.
- `wrangler dev --remote --test-scheduled`: menjawab 200 `Ran scheduled event`, tetapi **guard database tidak bergerak** dan tidak ada log `[cron]` yang terlihat di stdout.
- Kesimpulan sementara: keterbatasan arsitektur dev server wrangler untuk *self-referencing service binding* (dua instance miniflare; lihat issue `cloudflare/workers-sdk#5548`) — **bukan** bukti kegagalan di produksi, sebab pemanggilan `await` async tidak mungkin deadlock di runtime produksi.

## Bug & Insiden Selama Pengerjaan

1. **`wrangler.jsonc` `crons` top-level ditolak schema wrangler 4.140** (`Unexpected fields found in top-level field: "crons"`) → dipindah ke `triggers.crons`.
2. **Test `wrangler dev --test-scheduled` lokal menggantung / runtime crash** (`The Workers runtime crashed unexpectedly`). Dugaan: keterbatangan arsitektur dev server wrangler untuk self-referencing service binding (dua instance miniflare; lihat issue `cloudflare/workers-sdk#5548`), bukan masalah produksi — await tidak bisa deadlock di runtime produksi.
3. **`.env.local` sempat salah ditulis oleh skrip PowerShell** karena API .NET (`[IO.File]`) memakai CWD proses, bukan lokasi `Set-Location` → baris `CRON_SECRET` tercatat di worktree `cosmic-rocket`. Dibersihkan (file berisi hanya baris itu dihapus) dan ditulis ulang dengan path absolut ke repo utama.
4. **Build `.open-next` gagal `EPERM`** karena sisa proses `wrangler dev` (node/cmd/workerd) masih memegang direktori → semua proses itu dimatikan, build ulang sukses.
