# Log: ISR Background Revalidation Tidak Pernah Commit + `/preview/*` Ditambahkan ke `/api/revalidate`

**Tanggal:** 2026-09-28
**Tipe:** Investigasi bug laten + perubahan kode kecil (disetujui owner: "ya kerjakan")
**Ruang lingkup:** `C:\Users\USER\Documents\tamplate-portofolio` (worktree `curious-otter` tidak disentuh)
**Versi:** 1.3.8

---

## 1. Permintaan Owner

1. Tambahkan `/preview/os-desktop`, `/preview/infinite-canvas`, `/preview/spatial-gallery` ke daftar path di `src/app/api/revalidate/route.ts`.
2. Selidiki kenapa ISR background (`revalidate = 60`) tidak pernah meng-commit di produksi.

---

## 2. Perubahan Kode (Selesai)

| File | Perubahan |
|---|---|
| `src/app/api/revalidate/route.ts` | `revalidatePath(...)` untuk 3 slug preview ditambahkan setelah `/`, `/about`, `/contact`. |
| `src/app/api/revalidate/route.test.ts` | Test baru `revalidates every preview demo route` memastikan ketiga path dipanggil. |

**Gate:** `tsc --noEmit` exit 0 · `eslint src` exit 0 · `vitest run` **113 files / 857 tests PASS** (856 sebelumnya + 1 test baru).

**Catatan kejujuran:** efektivitas perubahan ini **belum diverifikasi end-to-end di produksi** — verifikasi diblokir kuota KV (lihat §6). Inferensi dari kode Next (`revalidatePath('/preview/os-desktop')` → tag `_N_T_/preview/os-desktop` = tag implisit halamannya sendiri) menyatakan ia *seharusnya* bekerja, tapi itu belum dibuktikan.

---

## 3. Investigasi: Kenapa ISR Time-Based Tidak Pernah Commit

### 3.1 Bukti empiris (produksi `https://makeitbetter.my.id`)

| # | Observasi | Angka |
|---|---|---|
| 1 | `x-opennext-cache` `/preview/os-desktop` selalu `STALE`, 6x berturut selama 75 dtk (`s-maxage=1`, jadi origin dicek tiap detik) | 6/6 `STALE`, tak pernah `HIT`/`REVALIDATED` |
| 2 | GET saat `STALE` (harusnya meng-*await* HEAD revalidasi) | **135–868 ms** |
| 3 | HEAD manual eksternal dengan `x-prerender-revalidate` (rekonstruksi persis queue) | **6.113–9.489 ms** → `x-nextjs-cache: REVALIDATED` → GET berikutnya **`HIT`** |
| 4 | CDN sebagai tersangka → **dibantah** | `cf-cache-status` selalu `-` (Cloudflare default tak cache HTML) |
| 5 | `NEXT_PREVIEW_MODE_ID` sebagai tersangka → **dibantah** | id `1b039c6b518daa78bbc109bffa07c10c` konsisten di `.next/prerender-manifest.json`, bundle middleware, dan **diterima produksi** (bukti #3) |

Bukti #2 vs #3 adalah kunci: **HEAD otomatis dari dalam Worker selesai ~50× lebih cepat dari revalidasi nyata**, artinya ia tidak pernah melakukan render ulang.

### 3.2 Akar masalah

`open-next.config.ts` memakai `queue: 'direct'`.

- `resolveQueue("direct")` → `@opennextjs/aws/dist/overrides/queue/direct.js`, object bernama literal **`dev-queue`**:
  ```js
  queue = { name: "dev-queue", send: async (message) => {
      const { host, url } = message.MessageBody;
      const protocol = host.includes("localhost") ? "http" : "https";
      const revalidateId = PrerenderManifest.preview.previewModeId;
      await globalThis.internalFetch(`${protocol}://${host}${url}`, {
          method: "HEAD",
          headers: { "x-prerender-revalidate": revalidateId, "x-isr": "1" },
      });
  }};
  ```
  Yaitu: memanggil **URL publiknya sendiri** dari dalam Worker. Tidak ada pemeriksaan hasil (beda dengan DO queue yang memvalidasi `x-nextjs-cache: REVALIDATED` lalu retry) → kegagalan **diam**.
- Build sendiri memperingatkan: `"The direct mode queue is not recommended for use in production."` (`ensure-cf-config.js:30`).
- **Dokumentasi resmi OpenNext Cloudflare (halaman Caching) menegaskan:** *"The `direct` mode for the queue is intended for debugging purposes and is not recommended for use in production. **It only works in preview mode (i.e. `wrangler dev`)**."*

Selaras 100% dengan observasi: `wrangler dev` (lokal) berfungsi, produksi tidak.

### 3.3 Konsekuensi

- ISR time-based 60 dtk **tidak bekerja sama sekali** di produksi → `/projects` dan `/preview/*` `STALE` permanen.
- Ini **mengonfirmasi** insiden entri 119: perubahan D1 tidak pernah menyebar sampai deploy ulang.

---

## 4. Temuan Tambahan: Jalur On-Demand Juga Tidak Menutup `/preview/*`

Diuji langsung dengan webhook resmi `/api/revalidate` (HMAC `REVALIDATION_TOKEN` → `200 {"revalidated":true}`):

- **`REVALIDATION_TOKEN` ADA di produksi** (signature salah → `401 Invalid signature`, bukan `500 Secret not configured`).
- `revalidatePath('/', 'layout')` → tag yang ditulis Next = **`_N_T_/layout`** (`revalidate.js:86-106`, `NEXT_CACHE_IMPLICIT_TAG_ID = '_N_T_'`).
- Tag cache = `kv-next-tag-cache` → `mode = "nextMode"` → interceptor menilai staleness dari **tag entri cache**, bukan path.
- Tag implisit `/preview/os-desktop` tidak memuat `_N_T_/layout` → **tidak ada efek**. Terbukti: 2x percobaan, 30 dtk dan **90 dtk** (di luar jendela propagasi KV ≤60 dtk), `x-opennext-cache` tetap `STALE` dan `bytes` identik `85764`.

Jadi **satu-satunya pemilik refresh `/preview/*` saat ini adalah deploy.**

### Mengapa perubahan §2 kemungkinan besar works

`revalidatePath('/preview/os-desktop')` (tanpa `type`) menulis tag **`_N_T_/preview/os-desktop`** — persis tag implisit halaman itu sendiri → di `mode = "nextMode"` akan cocok dan memaksa render ulang.

**Bedanya dengan kegagalan layout di atas: kunci tag-nya cocok.**
Status: **inferensi dari kode Next + OpenNext, BELUM diverifikasi end-to-end** (butuh deploy).

---

## 5. Keputusan Owner & Eksekusi

Owner memilih: **ganti queue ke memory queue + deploy** (bukan DO queue, agar tanpa `durable_objects` migration).

Perubahan yang dieksekusi:

| File | Perubahan |
|---|---|
| `open-next.config.ts` | `queue: 'direct'` → fungsi async yang mengimpor `@opennextjs/cloudflare/overrides/queue/memory-queue` (pola lazy-import sama dengan `incrementalCache`/`tagCache` yang sudah ada), plus komentar akar masalah. |
| `wrangler.jsonc` | Tambah binding `services: [{ binding: "WORKER_SELF_REFERENCE", service: "portfolio-os-template" }]` — nama service = nama worker. |

Kenapa memory queue, bukan DO queue: memory queue cukup `services` binding saja (tanpa migration schema), dan ia **tetap memvalidasi** hasil revalidasi:

```js
if (response.status !== 200 || response.headers.get("x-nextjs-cache") !== "REVALIDATED") {
    error(`Revalidation failed for ${url} with status ${response.status}`);
}
```

sehingga kegagalan tidak lagi diam seperti `dev-queue`. Bila ternyata masih bermasalah, jalur eskalasi berikutnya adalah DO queue (`do-queue`) + binding `NEXT_CACHE_DO_QUEUE` (class `DOQueueHandler` sudah di-export `worker.js`) yang menambah retry 6× @2 dtk.

---

## 6. Hasil Deploy & Hambatan Verifikasi (Kuota KV)

**Deploy sukses** dengan workaround `TEMP` (entri 119): Version ID **`cd763c10-630d-4dad-aa42-e34b8adfa102`**, 59 entri KV incremental ter-populate, 1 aset ter-upload, binding `env.WORKER_SELF_REFERENCE (portfolio-os-template)` terbaca wrangler.

Konfirmasi bundle pasca-build:

| Pola | File |
|---|---|
| `dev-queue` (queue lama) | **0** ✅ hilang |
| `memory-queue` | 6 |
| `Revalidation failed for` (log validasi) | 7 |
| `durable-queue` | 0 |

### ⚠️ Verifikasi terblokir: kuota baca KV Cloudflare harian habis

Sesaat setelah deploy, `wrangler tail` menangkap error berulang di **setiap** request route ter-cache:

```
(error) Failed to get from cache Error: KV get() limit exceeded for the day.
```

Dampak yang terukur:

- `x-opennext-cache` **tidak ada lagi** di response (interceptor gagal baca → `catch` → jatuh ke render penuh); header yang terlihat kini buatan Next (`x-nextjs-cache: MISS`, `Cache-Control: s-maxage=60`).
- TTFB `/preview/*` naik dari **~150 ms** menjadi **6–17 detik** (`Server-Timing: cfWorker;dur=12005`).
- Konten tetap benar (`200`, `bytes` identik) — hanya lambat, tidak rusak.
- **`Revalidation failed` = 0** → memory queue **belum pernah sempat jalan**, karena `incrementalCache.get()` melempar duluan sebelum `queue.send()` tercapai. Jadi fix queue **belum terbukti** di produksi.

Diagnosis tambahan:

- Entri KV **masih ada** (`incremental-cache/ltycbKgJMd4-EKvuuKT6c/…`, 59 key) — bukan data hilang, murni kuota.
- **Bukan read storm dari perubahan ini:** `wrangler tail` mencatat persis **2 KV get per request** dan trafik nyata hanya **±1,5 request/menit**. Jalur deploy juga tidak membaca KV masal (`worker-compat-audit.js` = audit statis 473 file; populasi = 59 *write*).
- Token API di `.env.local` tidak bisa membaca analitik KV (`No route for /accounts/…/storage/kv/analytics/summary`), jadi **angka pemakaian harian tidak bisa diverifikasi dari CLI** — perlu dashboard Cloudflare.
- Kuota KV diharapkan reset **00:00 UTC**. Rollback ke versi `163a5779-…` **tidak akan menolong**, karena kegagalan ada di akun/kuota, bukan di konfigurasi.

**Tindak lanjut wajib:** ulangi verifikasi setelah kuota reset — (a) GET saat `STALE` kini harus berdurasi render-ulang lalu kembali `HIT`, (b) webhook `/api/revalidate` harus mengubah entry `HIT` → `STALE` dalam hitungan detik.

---

## 7. File yang Dimodifikasi

- `src/app/api/revalidate/route.ts`
- `src/app/api/revalidate/route.test.ts`
- `open-next.config.ts`
- `wrangler.jsonc`
- `CHANGELOG.md` (entri `[1.3.9]`)
- `docs/tracker/logs/isr_revalidation_investigation_2026_09_28.md` (file ini)
- `docs/tracker/INDEX_TRACKER.md` (entri 120)

## 8. Bug yang Diperbaiki / Ditemukan

- ✅ Diperbaiki: `/preview/*` tidak pernah masuk daftar revalidate webhook.
- ✅ Diperbaiki & di-deploy: ISR time-based `queue: 'direct'` = `dev-queue` (debug-only menurut dokumentasi resmi) → diganti memory queue + `WORKER_SELF_REFERENCE`. **Efektivitas menunggu reset kuota KV.**
- ⚠️ Ditemukan: `revalidatePath('/', 'layout')` tidak mencakup `/preview/*` (tag `_N_T_/layout` tidak cocok).
- ⚠️ Ditemukan (baru): kuota baca KV harian Cloudflare ketahuan habis di produksi → seluruh route ter-cache render penuh 6–17 dtk. Perlu pemantauan/keputusan plan.

## 9. Verifikasi

- `npx tsc --noEmit` → 0 error
- `npx eslint src` → 0 error
- `npx vitest run` → **113 files / 857 tests PASS**
- `wrangler deploy --dry-run` → binding `env.WORKER_SELF_REFERENCE` terdaftar
- Probe pra-deploy: webhook `200`, HEAD manual `REVALIDATED`, timing 6 probe STALE + 18 probe pasca-webhook (§3.1, §4)
- Pasca-deploy: bundle queue terkonfirmasi (§6); **verifikasi perilaku ISR tertunda** kuota KV
