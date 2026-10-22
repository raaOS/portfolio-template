# Tracker Log: Pemeriksaan Kesehatan Worker Harian — Peringatan Dini Error 1102 (v1.3.64)

**Status:** ✅ Completed (kode selesai, gerbang hijau; **v1.3.64 di-deploy lalu terbukti tidak mengukur apa pun — dikoreksi penuh di v1.3.65**, lihat §Koreksi Pasca-Deploy)
**Mulai:** 2026-10-23
**Selesai:** 2026-10-23
**Rujukan sebelumnya:** [log diagnosis Error 1102 (v1.3.61)](error_1102_preview_iframe_diagnosis_2026_10_21.md)

> ⚠️ **Baca §Koreksi Pasca-Deploy dulu.** Rancangan awal di bawah ini mengklaim query unik memaksa render dingin. Klaim itu **terbukti salah** setelah deploy, dan desainnya diganti total di v1.3.65. Bagian lama dipertahankan apa adanya sebagai catatan keputusan, tapi penanda sudah ditandai.

## 🎯 Tujuan (Objective)

Setelah fix v1.3.61 (regional cache), owner bertanya: **"gimana saya bisa tahu kode 1102 di saat saya gak mantau?"**

Masalah sebenarnya bukan lagi bug-nya, tapi **deteksi**. Error 1102 mematikan isolate Worker, sehingga:

- Tidak bisa ditangkap `try/catch` di aplikasi mana pun — isolate-nya sudah mati sebelum sempat melapor.
- Tidak bisa ditangkap error tracker (Sentry dll) — alasan yang sama.
- Satu-satunya cara selama ini: memantau `wrangler tail` secara manual, yang mustahil dilakukan owner setiap saat.

Tugas: membangun cara agar owner **tahu sendiri** tanpa perlu memantau, dan menampilkannya di tempat yang memang sudah ia buka.

## ✅ Task List

- [x] Baca `INDEX_TRACKER.md` + log 1102 (v1.3.61).
- [x] Kumpulkan keputusan owner lewat kuesioner (4 pertanyaan + 1 persetujuan).
- [x] Buat `src/lib/workerHealthProbe.ts`.
- [x] Sambungkan ke cron harian `/api/cron/daily`.
- [x] Tambah field `workerHealth` ke `/api/health`.
- [x] Tampilkan di portal (server + tabel).
- [x] Perbaiki celah: site owner ternyata tidak muncul di portal sama sekali.
- [x] Tulis unit test (16 test baru: 13 modul probe + 3 route cron).
- [x] Gerbang: `npm test` + `lint` + `tsc`.
- [x] **Verifikasi pasca-deploy di produksi** (cron manual + tail + uji cache).
- [x] **Koreksi rancangan** setelah terbukti tidak mengukur apa pun (v1.3.65).
- [x] Ulangi gerbang setelah koreksi.

## 🧭 Keputusan Owner (Terekam dari Kuesioner)

| Pertanyaan | Keputusan owner | Alasan |
|---|---|---|
| Berapa request paralel? | **32** | Jauh di bawah ambang patah (±50) → probe normalnya lulus, berubah merah hanya kalau kepala ruang menyusut. Beban paling ringan. |
| Kapan dijalankan? | **Bareng cron 01:00 WIB** | Tidak menambah trigger cron baru, tidak ada perubahan `wrangler.jsonc`. |
| Jalan di site klien? | **Site owner saja** | Site klien tidak membebani Worker-nya sendiri tiap hari demi dashboard milik owner. |
| Ditampilkan di mana? | **Keduanya** | `/api/health` sebagai sumber data, portal sebagai tampilan. |
| Entry config portal? | **Buat folder baru** | `arsip-klien/00_site-owner/config.env`, folder `uji-domain` tidak disentuh. |

Keputusan lanjutan setelah v1.3.64 terbukti cacat rancangan (kuesioner kedua, 2026-10-23):

| Pertanyaan | Keputusan owner | Alasan |
|---|---|---|
| Lewat jalur mana perbaikannya? | **Ukur kesehatan cache + latensi** | Paling langsung menyentuh akar masalah asli (cache berhenti melindungi), tanpa endpoint baru dan tanpa beban render. Ditolak: endpoint benchmark CPU khusus, gabungan keduanya, cabut fitur. |

## 🧠 Rancangan

### Mengapa "probe sintetis", bukan "baca metrik Cloudflare"

Dua jalur dipertimbangkan dan dibandingkan jujur:

| | Probe sintetis (dipilih) | Baca metrik CF via API |
|---|---|---|
| Menjawab | "Kepala ruang saya berapa **hari ini**?" | "1102 terjadi **kapan**?" |
| Sifat | **Prediktif** (pencegahan) | **Retroaktif** (deteksi) |
| Butuh rahasia | **Tidak** | Ya — token API CF sebagai secret Worker |
| Izin tambahan | Tidak | Analytics Read (GraphQL) |
| Bisa dipastikan berhasil | Ya | **Tidak** — dataset `workersInvocationsAdaptive` ada, tapi nama field gagal ditebak & introspeksi diblokir |
| Berlaku di site klien | Bisa, tanpa biaya setup | Tidak (token owner tidak berlaku di akun klien) |

Jalur retroaktif **sengaja ditinggalkan**: butuh token secret + nama field GraphQL yang belum terverifikasi berhasil, sehingga tidak bisa dijanjikan. Probe sintetis dipilih karena tanpa rahasia, langsung mengukur risiko nyata, dan otomatis berlaku di site klien kelak tanpa setup.

> ⚠️ Yang dimaksud "mengukur risiko nyata" saat itu: *concurrency + CPU*. Setelah v1.3.65 ternyata yang benar-benar bisa diukur dari dalam adalah **kesehatan cache** — yang justru merupakan akar masalah 1102. Pilihan jalur tetap sama (sintetis, tanpa rahasia); hanya objek ukurnya yang diperbaiki.

### Mengapa 32

Ambang patah **terukur di produksi** pada 2026-10-22 (log v1.3.61):

| Paralel | Hasil |
|---|---|
| 32 | lulus |
| 48 | **bersih**, 0 kegagalan |
| 64 | **2× Error 1102** |
| 96 | **1× Error 1102** |

Jadi 32 duduk nyaman di bawah ambang — probe normalnya hijau, dan baru merah kalau kepala ruang benar-benar menyusut. Itulah gunanya: **perubahan** yang ingin terlihat, bukan angka absolut.

> ⚠️ Penalaran ini **tidak pernah teruji** karena ternyata probe tidak pernah memaksa render (lihat §Koreksi Pasca-Deploy). Jumlah 32 tetap dipertahankan, tapi kini sebagai jumlah *sample* pengukuran rasio cache, bukan sebagai "beban yang mendekati ambang". Konsekuensinya: ambang patah di atas tetap fakta yang benar, tapi bukan lagi landasan keputusan apa pun.

### Alur data

```
cron 01:00 WIB
  └─ POST /api/cron/daily  (auth: header x-cron-secret, timing-safe)
       └─ if (isOwnerMode())                    ← site klien dilewati total
            ├─ probeWorkerHealth()              ← 32 fetch serentak
            └─ recordWorkerHealth()
                 ├─ app_kv: worker-health/latest
                 └─ app_kv: worker-health/history (riwayat 7 hari)

GET /api/health
  └─ if (isOwnerMode()) → getD1Value('worker-health/latest') → checks.workerHealth

portal PENGELOLA_KLIEN (Status Klien)
  └─ fetch <site>/api/health → baris "Kepala Ruang Worker"
```

### Titik teknis yang menentukan

- **Query unik per request (`?probe=<stamp>-<i>`) — klaim ini terbukti SALAH.** Rancangan awal mengira query unik akan memaksa render ulang. Setelah deploy ternyata tidak: halaman preview adalah ISR statis sehingga cache key-nya pathname saja. Lihat §Koreksi Pasca-Deploy. Query tetap dipertahankan hanya agar tiap run tidak berbagi entri; tidak berbahaya karena kedaluwarsa 300 detik, tapi juga tidak berfungsi sebagai cache buster.
- **Jalur panggilan**: service binding `WORKER_SELF_REFERENCE` lebih dulu (jalur yang sama dipakai handler `scheduled` — panggilan internal, tanpa menyeberangi jaringan publik), jatuh ke fetch publik saat dev/unit test.
- **Deteksi 1102**: hanya respons non-200 yang dibaca isinya (halaman sukses 86 KB tidak perlu diurai; halaman error Cloudflare hanya ±17 byte), dicocokkan ke `/error\s+code:\s*1102/i`.
- **Gagal-closed dua lapis untuk site klien**: selain dibungkus `if (isOwnerMode())`, gate ini juga dibangun pipeline `deployClient()` yang memaksa `OWNER_MODE=false` — lihat `src/lib/ownerMode.ts`.

## 🛑 Koreksi Pasca-Deploy (v1.3.64 → v1.3.65)

v1.3.64 di-deploy (Version ID `a6ce0004-5ad0-458b-8878-3bf7f05de4f9`) dan diaudit. **Hasilnya: fiturnya tidak mengukur apa pun.** Ini dicatat terbuka karena kesalahannya ada pada rancangan, bukan pada pengetesan.

### Empat bukti yang diukur langsung di produksi

| # | Pengukuran | Hasil | Artinya |
|---|---|---|---|
| 1 | Tiga URL `?probe=` berbeda berurutan | `HIT`, `HIT`, `HIT` | Query **tidak** mem-bust cache. Halaman preview ISR (`revalidate = 300`) → cache key = pathname saja. 32 request probe membaca **entri yang sama**, selesai ±34 ms. |
| 2 | `POST /api/revalidate` (HMAC valid) lalu cek ulang | `{"revalidated":true}` tapi tetap `HIT` | `shouldLazilyUpdateOnCacheHit: false` membuat regional cache **otoritatif** sampai `max-age` 300 s habis. Purge tidak menembus. |
| 3 | Purge, tunggu **315 detik**, cek lagi | `STALE` lalu `HIT` | Setelah TTL habis pun bukan MISS: baca KV → sajikan basi → revalidasi **sekali** di latar. **Tidak pernah ada 32 render serentak.** |
| 4 | Burst **32 serentak** tepat setelah purge | `{"HIT":32}` — nol miss | Purge tidak menghasilkan satu pun miss pun dalam kondisi serentak. |

### Mengapa versi lama tidak akan pernah mendeteksi apa pun

Dua kegagalan bertumpuk:

1. **Tidak memaksa render** → semua request dihitung dari cache.
2. **32 jauh di bawah ambang patah** (terukur: 48 bersih, 64 → 1102) → bahkan kalau 32 render sungguhan, semuanya tetap lulus.

Jadi `passed` akan selalu `true` dalam **kedua** kondisi, sehat maupun sakit. Lampu hijau palsu.

### Keputusan perbaikan (disetujui owner)

**Berhenti memaksa render; ukur kesehatan cache** — karena itu justru akar masalah aslinya (kuota KV habis → cache berhenti melindungi → semua pengunjung render → Error 1102).

- Baca header `x-opennext-cache` dari **setiap** respons (membaca header gratis, tidak perlu buka body).
- `HIT` **dan** `STALE` = terlindungi (keduanya menyaji dari cache tanpa render). `MISS`/tanpa header = berrender.
- `passed` kini **dua syarat**: tidak ada request gagal **DAN** `cacheHitRatio >= 0.9` (`PROBE_MIN_CACHE_HIT_RATIO`).
- **Rasio runtuh di bawah ambang → gagal, walau nol request error.** Inilah perilaku yang dikunci oleh test inti.
- Menyimpan `p95TtfbMs` sebagai indikator kuantitatif kedua: sehat ±34 ms; mulai render → ratusan milidetik.
- Portal: kolom → **"Kesehatan Cache Worker"**, badge `HIT 100%` / `HIT 87% · 2× 1102`, p95 di tooltip. Entri lama tanpa field baru tetap tampil (fallback ke `ok/concurrency`).

### Alternatif yang ditolak / ditinggalkan

| Alternatif | Alasan ditinggalkan |
|---|---|
| Hard purge lalu burst | `revalidatePath` hanya set `revalidate=0`, tidak menghapus entri (bukti 2 & 4). |
| Pakai `/api/admin/clear-cache` | Sama-sama `revalidatePath`, butuh auth admin + CSRF, tidak mencakup path preview. |
| Slug preview tak dikenal | `page.tsx:83` → `notFound()` — murah, tidak ada render. |
| Tambah endpoint benchmark CPU | Bisa, tapi sintetis dan butuh kalibrasi ambang sendiri. Ditahan; dicatat sebagai opsi lanjutan. |
| Ubah konfigurasi cache agar query mem-bust | Menyentuh perilaku cache produksi — di luar izin yang diberikan. |

### Pelajaran yang dicatat

> **Verifikasi pasca-deploy wajib memeriksa *apa yang benar-benar terukur*, bukan hanya apakah kode berjalan tanpa error.** v1.3.64 lolos semua gerbang (21 test, tsc 0, lint 0, cron sukses, 32/32) tapi tetap cacat rancangan — karena tidak ada satu pun test yang memeriksa apakah `x-opennext-cache` benar-benar `MISS`. Test hanya memverifikasi apa yang dirancang untuk dipercaya, bukan apa yang penting.

## 🔍 Temuan Sampingan: Site Owner Tidak Pernah Muncul di Portal

Saat menyiapkan tampilan portal, ditemukan **celah yang sudah lama ada** dan tidak pernah terlihat:

- Menu Status Klien membangun daftarnya dari `arsip-klien/*/config.env` (`scripts/onboarding/server.ts`).
- Satu-satunya folder di sana adalah `uji-domain/`, yang **tidak punya `config.env`** (isinya hanya `token.txt`, `README.md`, `catatan-akun.txt`).
- Akibatnya `clientUrls()` memakai fallback `https://uji-domain.workers.dev`.

**Diverifikasi langsung di produksi:**

| URL | Hasil |
|---|---|
| `https://uji-domain.workers.dev/api/health` | **HTTP 000** (mati — subdomain tidak ada) |
| `https://makeitbetter.my.id/api/health` | **HTTP 200** |

Artinya portal owner **tidak pernah bisa memantau site produksinya sendiri** — hanya klien yang terpantau, site owner sendiri tidak. Perbaikannya: membuat `arsip-klien/00_site-owner/config.env` dengan `WEBSITE_URL=https://makeitbetter.my.id`, sehingga ikut terpantau bersama klien lain.

Catatan keamanan: folder `arsip-klien/` masuk `.gitignore` baris 96, jadi `config.env` ini **tidak ikut ter-commit**. Berkasnya sengaja **tanpa** `ADMIN_EMAIL`/`ADMIN_PASSWORD` karena hanya dipakai health check. Folder `uji-domain` tidak disentuh.

## 📁 Berkas Berubah

Kondisi akhir setelah v1.3.65 (perbaikan rancangan):

| Berkas | Perubahan |
|---|---|
| `src/lib/workerHealthProbe.ts` | **Baru.** `probeWorkerHealth()` + `recordWorkerHealth()`. Konstan: 32 paralel, timeout 20 dtk, kunci `app_kv`, riwayat 7, **`PROBE_MIN_CACHE_HIT_RATIO = 0.9`**. Hasil kini memuat `cacheHit`/`cacheRendered`/`cacheHitRatio`/`p95TtfbMs`; `passed` = dua syarat (nol gagal **dan** rasio ≥ ambang). Helper `percentile()` untuk p95. |
| `src/lib/workerHealthProbe.test.ts` | **Baru.** 13 test: 200 semua, query unik, 1102 vs 503 biasa, timeout, preferensi service binding, default 32, **3 test inti rasio cache** (runtuh walau nol error → gagal; `STALE` = terlindungi; ambang 0,90 dua sisi), plus 3 test `recordWorkerHealth`. |
| `src/app/api/cron/daily/route.ts` | Blok probe setelah backup, try/catch terpisah + `isOwnerMode()`. Log kini menyebut rasio HIT, p95, dan `SEHAT`/`TANDA MERAH`. Hasil ikut dibalikkan di respons. |
| `src/app/api/cron/daily/route.test.ts` | 3 test baru: owner mode jalankan & tulis D1 / non-owner skip / probe gagal tetap `ok: true`. |
| `src/app/api/health/route.ts` | Field `workerHealth` via dynamic import, `isOwnerMode()`, try/catch **tidak** mengubah `checks.status`. |
| `scripts/onboarding/server.ts` | Parsing + pengembalian `workerHealth` (kedua cabang return). |
| `scripts/onboarding/public/index.html` | `renderProbeBadge()` (badge `HIT 100%`, fallback format lama untuk entri pra-v1.3.65) + kolom **"Kesehatan Cache Worker"** (header + sel). |
| `arsip-klien/00_site-owner/config.env` | **Baru, gitignored.** Entry site owner untuk portal. |
| `CHANGELOG.md` | Entri `## [1.3.65]` + penanda koreksi ⚠️ di badan `## [1.3.64]`. |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.63 → 1.3.64 → **1.3.65**. |

## 🧪 Hasil Gerbang (v1.3.65, final)

| Gerbang | Hasil |
|---|---|
| `npx vitest run` (2 berkas target) | **24 PASS** |
| `npm test` (seluruh suite) | **141 berkas / 1.167 test PASS** (**nol regresi**) |
| `npm run lint` | **bersih**, exit 0 |
| `npx tsc --noEmit` | **exit 0** |

> **Catatan:** pre-commit hook `.husky/pre-commit` repo ini masih bug — ia mengetes `$?` dari `head`, bukan dari `tsc`, sehingga error TypeScript bisa lolos dengan pesan "✅ Pre-commit checks passed!". Karena itu `npx tsc --noEmit` **wajib dijalankan terpisah**, seperti yang dilakukan di sini.

## ⚠️ Batasan yang Tetap Berlaku (Wajib Jujur ke Owner)

1. **Prediktif, bukan retroaktif.** Ia menjawab "perlindungan cache masih utuh hari ini?", **bukan** "Error 1102 terjadi kemarin jam berapa". Kalau 1102 terjadi di luar slot probe, tidak akan terdeteksi.
2. **Tidak mendeteksi 1102 lewat jumlah kegagalan.** Sinyalnya ada pada **rasio cache** dan **latensi**: selama cache menahan beban, 32 request serentak selesai ±34 ms tanpa render; kalau cache berhenti melindungi, rasio runtuh dan p95 melonjak ke ratusan milidetik.
3. **Beban probe kini ringan** — 32 request ringan yang tersaji dari cache, **bukan** 32 render dingin seperti rancangan awal. Perubahan ini konsekuensi langsung dari tidak adanya cache buster.
4. **Sampah cache berkurang**: query unik tetap menyisakan entri di Cache API, tapi semuanya kedaluwarsa sendiri dalam 300 detik dan tidak pernah memicu render.
5. **Ambang 0,90 adalah pilihan terukur, bukan kebenaran mutlak.** Ia memberi ruang untuk beberapa miss wajar (mis. entri baru pertama kali sehari). Kalau kelak terbukti terlalu longgar/ketat, angkanya ada di `PROBE_MIN_CACHE_HIT_RATIO` — satu baris.
6. **Jalur retroaktif tidak tersedia** tanpa pekerjaan tambahan: butuh token API Cloudflare sebagai secret + izin Analytics + verifikasi nama field GraphQL yang sebelumnya gagal.

## 🔭 Tindak Lanjut (Opsional, Tidak Mendesak)

- **Vendor mermaid lokal** untuk tab Peta Bisnis kalau butuh luring — tidak terkait fitur ini, tercatat agar tidak lupa.
- Bila kelak owner ingin deteksi **retroaktif**, pekerjaannya: (1) buat token CF read-only dengan izin Analytics, (2) simpan sebagai secret Worker, (3) **verifikasi dulu** nama field GraphQL yang benar lewat uji terhadap akun produksi — jangan langsung ditulis di kode.
- Riwayat 7 hari (`worker-health/history`) saat ini **belum ditampilkan** di mana pun — tersimpan agar siap dipakai kalau owner ingin grafik tren.
