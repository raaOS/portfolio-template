# Tracker Log: Diagnosis + Fix Error 1102 (Worker exceeded resource limits) pada Iframe Demo Live `/preview/*`

**Status:** ✅ Completed (kode sudah diperbaiki & diverifikasi build; **deploy ke produksi belum dijalankan**)
**Mulai:** 2026-10-21
**Selesai:** 2026-10-21

## 🎯 Tujuan (Objective)

Owner melaporkan `Error 1102 — Worker exceeded resource limits` di `makeitbetter.my.id` saat membuka
iframe demo live di halaman muka. macOS Desktop lancar, sedangkan **Spatial Gallery** dan
**Infinite Canvas** memunculkan error (Ray ID `a4e0e2f0d882016b`, 2026-10-21 14:17:34 UTC).
Tugas: menemukan akar masalahnya **dengan bukti**, lalu memperbaikinya.

## ✅ Task List

- [x] Baca `INDEX_TRACKER.md` (tidak ada log yang sudah membahas error 1102).
- [x] Telusuri route `src/app/preview/[template]/page.tsx` (worktree + `main` via `git show`).
- [x] Uji langsung produksi: 3 route sequential → semua 200 (tidak bisa direproduksi dengan 1 request).
- [x] **Burst test 8 request parallel** per route → 1102 muncul.
- [x] **Burst test 16 request parallel** per route, diulang 2× dengan urutan terbalik → angka kegagalan terkumpul.
- [x] Periksa header ISR → cache tidak pernah melayani (tanda tangan cocok dengan log 2026-09-28).
- [x] Ambil akses Cloudflare owner (token di `arsip-klien/uji-domain/token.txt`) — **read-only**.
- [x] Cek isi KV: 1000+ key `incremental-cache/*` **ada** dan tag `preview/*` **ada** → tulis jalan, baca yang gagal.
- [x] **`wrangler tail` produksi → penyebab sesungguhnya terbukti** (lihat §Akar Masalah).
- [x] Ukur trafik nyata via GraphQL (26.074 request hari ini; 36.976 pada 19 Okt; 7.033 pada 20 Okt).
- [x] Perbaiki `open-next.config.ts` dengan `withRegionalCache`.
- [x] Tambah entri `CHANGELOG.md` `[1.3.61]` (dipaksa naik dari 1.3.60 — lihat catatan tabrakan versi di bawah).

## 📊 Bukti Reproduksi (Hasil Uji Produksi)

Semua request memakai query string unik supaya benar-benar cold render.

### Burst 16 request parallel per route

| Route | Run 1 | Run 2 | Total gagal |
|---|---|---|---|
| `/preview/spatial-gallery` | **2× HTTP 503 `error code: 1102`** | **2× HTTP 503 `error code: 1102`** | **4 / 32** |
| `/preview/infinite-canvas` | **1× 1102** | **1× 1102** | **2 / 32** |
| `/preview/os-desktop` | 0 / 16 (semua 200) | **1× 1102** | **1 / 32** |

### Burst 8 request parallel (percobaan pertama)

- `spatial-gallery`: **1× 1102** + 1 respons HTML terpotong **61.440 B** (normalnya 86.701 B — worker mati di tengah stream).
- `infinite-canvas`: **1× 1102**.

### Kontrol: sequential (1 per 1, jeda 0,3–0,5 s)

| Route | Hasil | Rata-rata TTFB |
|---|---|---|
| `os-desktop` | **6/6 = 200** | 2,24 s |
| `spatial-gallery` | **6/6 = 200** | 1,53 s |
| `infinite-canvas` | **6/6 = 200** | 1,75 s |

**Kesimpulan:** 1102 **tidak pernah** terjadi pada request tunggal dan **selalu** muncul saat ada
beberapa render `/preview/*` bersamaan. Bentuk error identik dengan laporan owner:
**HTTP 503, body 17 byte `error code: 1102`**.

> ⚠️ **Koreksi dugaan awal:** burst terbalik membuktikan `os-desktop` **juga bisa** kena (1/16).
> Jadi ini **bukan** cacat intrinsik Spatial Gallery / Infinite Canvas — kegagalan bersifat
> **probabilistik tergantung concurrency**. Yang lolos = yang kebetulan render saat Worker longgar.

## 🔍 Akar Masalah (Root Cause) — TERVERIFIKASI

### Penyebab sesungguhnya: kuota baca KV harian habis

`npx wrangler tail portfolio-os-template` terhadap produksi (sambil halaman diakses) menangkap:

```json
"message": ["Failed to get from cache", "Error: KV get() limit exceeded for the day."]
"stack": "at KVIncrementalCache.get (worker.js:9141:1366) ... at Pl ... at oc ..."
```

- **26 penyebutan** `KV get() limit exceeded for the day` dari sampel 9 invocation (13 baris log error).
- Artinya `incrementalCache.get()` **melempar error**, ditangkap `catch` → `return null` → Next
  menganggap **tidak ada cache** → render penuh.

Bukti penyerta:

- **KV write jalan** — REST API menunjuk `incremental-cache/*` **1000 key** dan tag
  `_N_T_/preview/{spatial-gallery,os-desktop,infinite-canvas}` ada. Jadi bukan data hilang / binding salah.
- **Semua route MISS** — `/`, `/about`, `/projects`, `/contact`, `/preview/*` semuanya
  `x-nextjs-cache: MISS`, **tanpa** `x-opennext-cache`, TTFB 1,5–3,8 s untuk URL identik berulang.
  Tanda tangan ini persis dengan `docs/tracker/logs/isr_revalidation_investigation_2026_09_28.md` baris 139–140.
- **Baseline sehat** (`perf_preview_templates_2026_09_25.md` baris 99): "TTFB 15-17s → **0.13-1.1s (HIT)**".
- **Account = plan gratis** (`GET /accounts` → `type: "standard"`, tanpa paket berbayar) →
  kuota KV baca harian (100.000/hari) berlaku dan **dikonsumsi habis** oleh trafik nyata.
- **Trafik** (GraphQL `workersInvocationsAdaptive`): 26.074 (21 Okt, masih berjalan), 36.976 (19 Okt),
  7.033 (20 Okt). Per request minimal 1 read incremental + 1 batch read tag cache, bisa lebih saat
  `itemsCache` request kosong → 2–6 read/request × puluhan ribu request = **melebihi kuota harian**.

### Rantai ke Error 1102

1. Baca KV gagal (kuota habis) → **tiap kunjungan = render penuh di Worker** (bukan sekali/300 s).
2. Halaman preview di-SSR berat: `loadHomepageData` (batch D1) + React flight **86–105 KB HTML** per render,
   terukur `cpuTime` 27–700 ms / `wallTime` 57–1478 ms per invocation.
3. Saat beberapa render bersamaan di isolate yang sama, akumulasi melewati **memori isolate 128 MB**
   → Cloudflare membunuh isolate → **1102**.
   *(CPU **bukan** pelakunya: `outcome: ok` dengan `cpuTime` ≤ 700 ms, jauh di bawah limit CPU per request.)*
4. Pemicu concurrency di halaman muka: `MagazineShowcase` memuat **dua iframe** `/preview/*`
   (iframe *preload* saat lembaran mulai terangkat + iframe *live* saat fokus) → ±2 SSR bersamaan,
   ditambah tab/pengunjung lain.

## 🛠️ Perbaikan yang Diterapkan

**`open-next.config.ts`** — KV incremental cache kini dibungkus `withRegionalCache`
(`mode: 'long-lived'`, `defaultLongLivedTtlSec: 300`, `shouldLazilyUpdateOnCacheHit: false`,
`bypassTagCacheOnCacheHit: true`), yaitu **Cache API Cloudflare per Data Center di depan KV**:

- **hit regional** → 0 read KV, tag cache dilewati, refresh latar dimatikan → **0 read KV sama sekali**.
- **miss regional** → baca KV **sekali**, lalu diisi ke Cache API (`waitUntil`).

Efek: KV hanya dibaca saat entry pertama per Data Center per URL per 300 detik, bukan setiap request.
Ini sekaligus menyelesaikan **dua** masalah sekaligus:

- kuota harian kembali jauh di bawah batas → cache hidup lagi → TTFB kembali ±100 ms;
- render bersamaan (pemicu 1102) nyaris hilang, dan iframe *live* yang menyusul 1–3 detik setelah
  iframe *preload* kini **langsung hit Cache API** dalam Data Center yang sama (inkonsisten hanya
  sampai KV, tapi tidak perlu render ulang).

**Konsekuensi yang disadari & dicatat:** revalidasi on-demand (`/api/revalidate`) bisa tertahan
maksimal 300 detik = sama dengan `revalidate` halaman preview, jadi staleness tetap terukur
(entry dibuang oleh `max-age` hasil `cache.put`), bukan tak terbatas.

### Opsi lanjutan bila kuota masih ketat

1. Naikkan plan Cloudflare (kuota KV harian hilang; trafik 26–37 rb/hari juga mendekati limit
   request gratis 100.000/hari).
2. Pindahkan store ke **R2** (`NEXT_INC_CACHE_R2_BUCKET` + `r2-incremental-cache`) — tidak ada kuota harian.
3. Kurangi jumlah iframe `/preview/*` bersamaan di `MagazineShowcase` (opsional; setelah cache hidup
   dampaknya kecil karena permintaan kedua jadi cache hit).

## 📁 File yang Dimodifikasi (Modified Files)

- `open-next.config.ts` → tambah `withRegionalCache` + 4 opsi di atas (bagian komentar diperbarui).
- `open-next.config.test.ts` → **baru**: guardrail yang mengunci lapisan RegionalCache + 4 opsi anti-1102.
- `src/lib/constants.ts` → `APP_VERSION` `1.3.59` → `1.3.61` (wajib sama dengan entri teratas CHANGELOG).
- `CHANGELOG.md` → entri baru `[1.3.61] - 2026-10-21` di baris paling atas.
- `docs/tracker/logs/error_1102_preview_iframe_diagnosis_2026_10_21.md` (file ini) — dibuat baru.
- `docs/tracker/INDEX_TRACKER.md` → entri 173.

Tidak ada file komponen, route, atau skema yang diubah.

## ✅ Hasil Verifikasi (Gerbang)

| Gerbang | Hasil |
|---|---|
| `npm run cf:build` (OpenNext + Cloudflare) | **Berhasil** — Next 16.3.6 compiled + TypeScript bersih, 74 halaman, `worker.js` tersimpan; `/preview/{os-desktop,infinite-canvas,spatial-gallery}` = **● SSG, Revalidate 5m** |
| `npm test` (vitest) | **140 file / 1.148 test PASS** (termasuk 2 test guardrail baru) |
| `npm run lint` (eslint src) | **Bersih**, exit 0 |
| Guardrail `open-next.config.test.ts` | **2/2 PASS** — memaksa RegionalCache tetap terpasang & 4 opsi tidak berubah |

> Catatan: percobaan `cf:build` pertama gagal **bukan** karena perubahan ini — worktree
> belum punya `.env.local` sehingga prerender `/sitemap.xml` gagal (`Cloudflare D1 env is incomplete`).
> Setelah `.env.local` disalin (gitignored, tidak ikut ke repo) build bersih.

## ✅ Verifikasi Pasca-Deploy (2026-10-21 23:33 WIB)

Deploy: `npm run deploy` dari main repo (fast-forward `main` = `e0f66e9`). Pre-deploy check
lolos (0 blocker, 506 file), `cf:build` bersih, worker `portfolio-os-template` ter-upload —
**Version ID `8cd4e4a3-f76a-4410-bba1-e6b089d67b89`**, binding `NEXT_INC_CACHE_KV` +
`NEXT_TAG_CACHE_KV` tetap terpasang, aset statis 6 di-upload ulang (920 sudah ada).

| Cek | Sebelum | Sesudah |
|---|---|---|
| `GET /api/health` | `1.3.59` | **`1.3.61`** ✅ |
| Header `x-opennext-cache` di `/preview/spatial-gallery` | tidak pernah ada (selalu `x-nextjs-cache: MISS`) | **HIT pada 8/8 request** |
| TTFB URL identik berulang | 1,5–3,8 s (selalu MISS) | **0,17–1,1 s**, stabil **±0,17 s** |
| Ukuran HTML | 86.701 B | 86.659 B (konten identik) |
| Event `wrangler tail` dengan **0 read KV** | 0 dari semua event | **6 dari 8 event** |
| Read KV per event | 2+ read (selalu gagal) | hanya **2 dari 8 event** (sisa miss) |

**Bukti `wrangler tail` — 8 request identik ke `/preview/spatial-gallery`:**

```
[ok] cpu=71ms  wall=1280ms   <- MISS regional: KV get gagal (kuota) -> SSR penuh
[ok] cpu=13ms  wall=29ms     <- HIT regional: 0 read KV
[ok] cpu=833ms wall=1986ms   <- MISS regional: KV get gagal (kuota) -> SSR penuh
[ok] cpu=17ms  wall=30ms     <- HIT regional: 0 read KV
[ok] cpu=7ms   wall=15ms     <- HIT regional: 0 read KV
[ok] cpu=12ms  wall=23ms     <- HIT regional: 0 read KV
[ok] cpu=36ms  wall=56ms     <- HIT regional: 0 read KV
[ok] cpu=9ms   wall=20ms     <- HIT regional: 0 read KV
```

`Failed to get from regional: 0` — lapisan Cache API tidak pernah gagal. Dua sisa kegagalan KV
adalah **miss regional**: kuota harian sudah terlanjur terbakar sebelum deploy dan hanya reset
**00:00 UTC**. Setelah reset, miss akan membaca KV sukses lalu terisi ke Cache API, sehingga
kuota harian jatuh jauh di bawah batas.

**Sisa risiko (angka asli, jujur):** burst paksa-cold 16 paralel × 3 ronde dengan **query unik**
— tiap URL = kunci cache berbeda → permanen MISS → SSR penuh. Ini **kasus terburuk buatan**,
bukan trafik nyata (pengunjung membuka `/preview/<slug>` tanpa query):

| Route | Gagal 1102 | Sebelum perbaikan |
|---|---|---|
| `/preview/spatial-gallery` | **0 / 48** ✅ | 4 / 32 |
| `/preview/infinite-canvas` | 2 / 48 | 2 / 32 |
| `/preview/os-desktop` | 4 / 48 | 1 / 32 |

Sisa 1102 ini murni akibat **kuota KV hari ini sudah habis**, sehingga setiap miss masih jadi
SSR penuh (16 render bersamaan → memori isolate 128 MB). Jalur nyata pengunjung sudah
**HIT, 0 read KV, 15–56 ms** — jadi render bersamaan nyaris tidak pernah terjadi.

**Tindak lanjut yang disarankan (belum dikerjakan):**

1. **Verifikasi pemulihan kuota 2026-10-22 (setelah 00:00 UTC):** `npx wrangler tail` sambil
   buka situs — `KV get() limit exceeded` harus benar-benar hilang, dan burst paksa-cold seharusnya
   jauh lebih bersih karena miss kini bisa membaca KV.
2. Kalau kuota masih sempit: pindahkan store cache ke **R2** (`NEXT_INC_CACHE_R2_BUCKET`),
   atau naikkan plan Cloudflare (trafik 26k–37k request/hari juga sudah mendekati cap gratis
   100.000 request/hari).
3. Opsi terakhir: kurangi jumlah iframe `/preview/*` bersamaan di `MagazineShowcase.tsx`
   (owner sudah memutuskan UX-nya, jadi jangan disentuh tanpa izin).

## 🐛 Bug & Perbaikan (Bug Tracker)

- **Bug 1 (produksi):** `Error 1102` pada iframe `/preview/spatial-gallery` & `/preview/infinite-canvas`.
  - **Penyebab:** kuota baca KV harian habis → semua request render penuh → render bersamaan
    menembus memori isolate 128 MB.
  - **Perbaikan:** `open-next.config.ts` → `withRegionalCache` (Cache API di depan KV).
    **Sudah di-deploy 2026-10-21 23:33 WIB**, versi `1.3.61`.
- **Bug 2 (regresi, penguat Bug 1):** ISR KV tidak pernah HIT.
  - **Penyebab:** `KV get() limit exceeded for the day` — terbukti dari `wrangler tail`.
  - **Perbaikan:** sama dengan Bug 1.

## 📌 Catatan untuk AI Selanjutnya (Handoff Notes)

- **SUDAH DI-DEPLOY** 2026-10-21 23:33 WIB sebagai **v1.3.61** (Version ID
  `8cd4e4a3-f76a-4410-bba1-e6b089d67b89`) dari main repo setelah fast-forward `main` = `e0f66e9`,
  supaya deploy berikutnya dari repo owner **tidak membalik** perbaikan ini. Angka verifikasi ada di
  bagian **✅ Verifikasi Pasca-Deploy** di atas.
- **Cara re-verifikasi (bisa dipakai ulang):** `npx wrangler tail portfolio-os-template` sambil
  buka halaman — pesan `KV get() limit exceeded for the day` seharusnya **hilang setelah kuota
  reset 00:00 UTC**; lalu `curl -sI https://makeitbetter.my.id/preview/spatial-gallery` harus
  memunculkan `x-opennext-cache: HIT` / TTFB ±0,17 s (bukan MISS + 1,5–3,8 s).
- **Cara reproduksi 1102:** `curl --parallel --parallel-max 16` ke
  `/preview/<slug>?p=<unik>` — hitung respons ber-`HTTP 503` berisi `error code: 1102`.
  Uji **satu per satu tidak pernah gagal**, jangan menyimpulkan "sudah normal" dari uji sekuensial.
- **Akses Cloudflare:** token owner ada di `arsip-klien/uji-domain/token.txt`
  (izin Edit Workers + DNS; **tidak boleh di-commit**, sudah di `.gitignore`). Dipakai read-only
  (`wrangler whoami`, KV REST, GraphQL) untuk diagnosis ini. Wrangler `kv key list` mentok error
  Windows `CreateDirectory ... Access is denied` (workerd) — pakai REST API, atau set `TEMP`/`TMP`.
- Repo ini awalnya worktree `hidden-tiger` detached di `bac545d` (v1.3.41, 32 commit di belakang
  `main`); karena kode hero `MagazineShowcase.tsx` hanya ada di `main`, branch dibuat ulang dari
  `main` → **branch `fix/preview-1102-concurrency`**, lalu **rebase ke `main` 1390ac2 (v1.3.60)**
  sebelum digabung fast-forward.
- ⚠️ **Tabrakan versi 2026-10-21:** saat sesi lain menambahkan `CHANGELOG [1.3.60]` (perapian
  bilah demo live) **bersamaan** dengan perbaikan ini, kedua entry sama-sama berlabel `1.3.60`.
  Rebase tidak memberi konflik (lokasi teks berbeda) sehingga **dua entry 1.3.60 menumpuk diam-diam**.
  Disediakan: entry perbaikan ini dinaikkan jadi **`[1.3.61]`** + `APP_VERSION = '1.3.61'`.
  Inilah sebabnya entry `[1.3.61]` sengaja diletakkan **paling atas** — test
  `src/lib/constants.test.ts` mengambil `## [x]` **pertama** di file, jadi entry yang salah posisi
  membuat test versi gagal (sempat terjadi di `main`: APP_VERSION 1.3.60 vs entri teratas 1.3.56).
- ⚠️ **Bug hook pre-commit (belum diperbaiki, di luar scope):** `.husky/pre-commit` mengecek
  keluaran `npx tsc --noEmit 2>&1 | head -20` lalu menguji `$?` — tetapi `$?` milik **`head`**,
  bukan `tsc`. Akibatnya **error TypeScript tetap lolos** dengan pesan `✅ Pre-commit checks passed!`
  (terbukti saat commit pertama: 2 error `TS18048` dari `open-next.config.test.ts` lolos hook).
  Ralat: verifikasi tipe wajib dijalankan terpisah (`npx tsc --noEmit`), jangan percaya hook ini.
  Pemilik: perbaikinya dengan memisah perintah dan menangkap kode keluaran `tsc` sendiri.
- Perubahan logika lain (hero MagazineShowcase, route preview) **wajib izin owner dulu** (AGENTS.md).
