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
| 7 | **Fire cron — handler sudah terbaca, trigger belum terbukti menembak** | Deploy `942ee8a2-af4b-4bc2-92ea-313d0fb82f03` (2026-10-03T19:04:54Z) → `wrangler versions view` = **`Handlers: fetch, scheduled`**. Tapi uji fire dengan jadwal uji `* * * * *` selama 40 menit (tail hidup, 3 probe `/api/health` terekam) = **0 invocation `scheduled`**; guard `platform_settings.billing_expire_sweep_at` tidak bergeser (perubahan 19:36:22Z berasal dari POST manual). Detail di bagian *Status perbaikan*. |

## Hasil Uji yang TIDAK bisa dipakai (dicatat agar tidak diulang)

- `wrangler dev --test-scheduled` (lokal): `/__scheduled` pernah menjawab 200 lalu **`The Workers runtime crashed unexpectedly`**, percobaan kedua **menggantung 120 detik**.
- `wrangler dev --remote --test-scheduled`: menjawab 200 `Ran scheduled event`, tetapi **guard database tidak bergerak** dan tidak ada log `[cron]` yang terlihat di stdout.
- **Kesimpulan yang benar (setelah run pertama gagal):** ketiadaan efek samping pada kedua uji itu **bukan** karena self-binding, melainkan karena handler `scheduled` memang belum terbaca (lihat bagian Run Pertama GAGAL di bawah) — `wrangler dev` tidak menemukan handler lalu tidak pernah memanggil endpoint. Kegagalan/`crash` pada uji lokal tetap diduga keterbatasan dev server wrangler dan tidak terulang di produksi.

## 🚨 Run Pertama Cron GAGAL (2026-10-04 01:00 WIB) — Akar Masalah & Perbaikan

**Gejala.** Pemantauan `wrangler tail` merekam invocation `scheduledTime = 2026-10-03T18:00:20Z` dengan `outcome: "exception"`:

```
"message": "Handler does not export a scheduled() function",
"Received a ScheduledEvent but we lack a handler for ScheduledEvents
 (a.k.a. Cron Triggers). Did you remember to export a scheduled() function?"
```

Guard `platform_settings.billing_expire_sweep_at` **tidak bergerak** (tetap `2026-10-03T17:07:47Z`, sisa uji manual) → sweeper tidak pernah berjalan. Cron terpasang, tetapi handler-nya tak pernah dipanggil.

**Diagnosis (dikerjakan subagent, semua read-only).**

| Cek | Hasil |
|---|---|
| `.open-next/worker.js` lokal | `export async function scheduled(` **ADA** (baris 51); `export default {` ada (baris 15) |
| `npx wrangler deploy --dry-run` | exit **0**; bundel berisi `export{...,$ce as default,Hce as scheduled}` → ekspor **tidak hilang** saat bundling |
| `npx wrangler versions view 6f2bd3ae…` | **`Handlers: fetch`** — Cloudflare sendiri hanya mencatat `fetch` |
| Sumber workerd (`node_modules/@cloudflare/workerd-…/bin/workerd.exe` + skemanya) | `worker.c++`: `getExportedHandler(entrypointName)` dengan `entrypointName` **default `"default"`** → handler dibaca dari **objek `export default`**; skema: *"`export default {` specifies the default entrypoint, whereas `export let foo = {` defines an entrypoint named `foo`"* |

**Akar masalah: bentuk ekspor, bukan mekanisme build/deploy.** `export async function scheduled()` adalah *named export* berupa fungsi top-level — workerd tidak pernah membacanya; yang dibaca hanya properti objek `export default` yang isinya cuma `fetch`. Jadi build, bundling, dan deploy semuanya sukses, tetapi handler-nya "tidak ada" bagi runtime.

**Perbaikan.** `appendScheduledCronHandler()` di `scripts/cloudflare/prepare-opennext-worker-output.js` kini **menyisipkan `async scheduled(...)` ke dalam objek `export default { … }`** (mencari penutup `\n};` pertama setelah `export default {`; kalau bentuk objek berubah, skrip gagal keras dengan pesan jelas — bukan diam-diam sukses). Guard patch: marker `// [cron-patch] scheduled = properti objek export default`.

> [!WARNING]
> **Untuk AI berikutnya:** jangan pernah menambahkan handler `fetch`/`scheduled`/`queue`/`alarm` ke `.open-next/worker.js` sebagai named export. Harus berupa **properti objek `export default`**.

**Status perbaikan (update 2026-10-04):**

| Langkah | Hasil |
|---|---|
| Build ulang dengan patch bentuk objek | ✅ log `[cloudflare-build] Inserted scheduled cron handler into Worker default export.`; esbuild syntax check exit 0 |
| Deploy | ✅ Version ID `942ee8a2-af4b-4bc2-92ea-313d0fb82f03` |
| `wrangler versions view` | ✅ **`Handlers: fetch, scheduled`** — bug "Handler does not export a scheduled() function" sudah teratasi di level registrasi |
| Uji fire (jadwal `* * * * *`, tail ±40 menit) | ❌ **BELUM TERBUKTI** — nol invocation `scheduled`; guard tidak bergerak |
| `POST /api/cron/daily` manual (bukti pipeline hulu) | ✅ 200 + guard tertulis → `CRON_SECRET` ter-set, endpoint → sweeper → tulis D1 semuanya jalan |

**Sisa masalah:** tautan **scheduler Cloudflare → invocation `scheduled`** belum terbukti. Kandidat penyebab berikutnya (belum dieksekusi): (1) cek halaman *Workers → Past Cron Events* di dashboard dengan token ber-skop Analytics; (2) `npx wrangler triggers deploy` untuk memaksa pendaftaran ulang pemicu; (3) ulangi tail 5–10 menit. Jadwal uji `* * * * *` sudah **dilepas dari `wrangler.jsonc`** (kembali `["0 18 * * *"]`) agar tidak tertinggal di commit.

## Bug & Insiden Selama Pengerjaan

1. **`wrangler.jsonc` `crons` top-level ditolak schema wrangler 4.140** (`Unexpected fields found in top-level field: "crons"`) → dipindah ke `triggers.crons`.
2. **Test `wrangler dev --test-scheduled` lokal menggantung / runtime crash** (`The Workers runtime crashed unexpectedly`). Dugaan: keterbatangan arsitektur dev server wrangler untuk self-referencing service binding (dua instance miniflare; lihat issue `cloudflare/workers-sdk#5548`), bukan masalah produksi — await tidak bisa deadlock di runtime produksi.
3. **`.env.local` sempat salah ditulis oleh skrip PowerShell** karena API .NET (`[IO.File]`) memakai CWD proses, bukan lokasi `Set-Location` → baris `CRON_SECRET` tercatat di worktree `cosmic-rocket`. Dibersihkan (file berisi hanya baris itu dihapus) dan ditulis ulang dengan path absolut ke repo utama.
4. **Build `.open-next` gagal `EPERM`** karena sisa proses `wrangler dev` (node/cmd/workerd) masih memegang direktori → semua proses itu dimatikan, build ulang sukses.

## Koreksi & Penyelesaian (update 2026-10-05)

Diverifikasi ulang via `GET /accounts/{id}/workers/scripts/portfolio-os-template/schedules` (OAuth wrangler):

1. **Klaim baris 95 ("Jadwal uji `* * * * *` sudah dilepas") keliru.** Yang dilepas hanya isi `wrangler.jsonc` lokal — **pendaftaran jadwal di server tidak pernah dikembalikan**: API menunjukkan `* * * * *` masih terpasang sejak `2026-10-03T19:04:59Z` (modified `2026-10-04T12:03:04Z`) sampai 2026-10-05T02:42Z. Artinya sejak deploy 3 Okt worker menembak tiap menit (geraknya guard tiap 10 menit konsisten dengan itu), dan "uji fire 40 menit = 0 invocation" (baris 92) **bertentangan dengan data API** — dugaan: artefak pengukuran `wrangler tail` (format keluaran bergantung TTY; tanpa `--format pretty` hasilnya JSON tanpa kata "scheduled").
2. **Mekanisme TERBUKTI (2026-10-05, 09:38–09:41 WIB):** `npx wrangler triggers deploy` memasang `* * * * *` (`Deployed portfolio-os-template triggers` + `schedule: * * * * *`), lalu `wrangler tail --format pretty` selama 215 detik merekam **3 event `"* * * * *" @ … - Ok` + 3 log `[cron] POST /api/cron/daily -> 200`**; guard D1 bergeser 02:23:00Z → 02:33:00Z (selisih tepat 10 menit = interval guard).
3. **Jadwal harian dikembalikan & terverifikasi:** output `schedule: 0 18 * * *` + GET schedules → `0 18 * * *` (created `2026-10-05T02:42:36Z`); `git diff -- wrangler.jsonc` kosong.

Lanjutan (fitur backup + bukti fire harian): lihat log `backup_d1_cron_proof_2026_10_05.md`.
