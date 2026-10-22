# Tracker Log: Pemeriksaan Kesehatan Worker Harian — Peringatan Dini Error 1102 (v1.3.64)

**Status:** ✅ Completed (kode selesai, gerbang hijau, **belum di-deploy** — menunggu eksekusi deploy)
**Mulai:** 2026-10-23
**Selesai:** 2026-10-23
**Rujukan sebelumnya:** [log diagnosis Error 1102 (v1.3.61)](error_1102_preview_iframe_diagnosis_2026_10_21.md)

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
- [x] Tulis unit test (13 test baru).
- [x] Gerbang: `npm test` + `lint` + `tsc`.

## 🧭 Keputusan Owner (Terekam dari Kuesioner)

| Pertanyaan | Keputusan owner | Alasan |
|---|---|---|
| Berapa request paralel? | **32** | Jauh di bawah ambang patah (±50) → probe normalnya lulus, berubah merah hanya kalau kepala ruang menyusut. Beban paling ringan. |
| Kapan dijalankan? | **Bareng cron 01:00 WIB** | Tidak menambah trigger cron baru, tidak ada perubahan `wrangler.jsonc`. |
| Jalan di site klien? | **Site owner saja** | Site klien tidak membebani Worker-nya sendiri tiap hari demi dashboard milik owner. |
| Ditampilkan di mana? | **Keduanya** | `/api/health` sebagai sumber data, portal sebagai tampilan. |
| Entry config portal? | **Buat folder baru** | `arsip-klien/00_site-owner/config.env`, folder `uji-domain` tidak disentuh. |

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

Jalur retroaktif **sengaja ditinggalkan**: butuh token secret + nama field GraphQL yang belum terverifikasi berhasil, sehingga tidak bisa dijanjikan. Probe sintetis dipilih karena tanpa rahasia, langsung mengukur risiko nyata (concurrency + CPU), dan otomatis berlaku di site klien kelak tanpa setup.

### Mengapa 32

Ambang patah **terukur di produksi** pada 2026-10-22 (log v1.3.61):

| Paralel | Hasil |
|---|---|
| 32 | lulus |
| 48 | **bersih**, 0 kegagalan |
| 64 | **2× Error 1102** |
| 96 | **1× Error 1102** |

Jadi 32 duduk nyaman di bawah ambang — probe normalnya hijau, dan baru merah kalau kepala ruang benar-benar menyusut. Itulah gunanya: **perubahan** yang ingin terlihat, bukan angka absolut.

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

- **Query unik per request** (`?probe=<stamp>-<i>`). Tanpa ini probe hanya mengukur regional cache dan tidak pernah mendekati batas CPU — ujiannya jadi tidak berarti. Biayanya: entri cache sampah yang **kedaluwarsa sendiri** dalam `revalidate` preview (300 detik).
- **Jalur panggilan**: service binding `WORKER_SELF_REFERENCE` lebih dulu (jalur yang sama dipakai handler `scheduled` — panggilan internal, tanpa menyeberangi jaringan publik), jatuh ke fetch publik saat dev/unit test.
- **Deteksi 1102**: hanya respons non-200 yang dibaca isinya (halaman sukses 86 KB tidak perlu diurai; halaman error Cloudflare hanya ±17 byte), dicocokkan ke `/error\s+code:\s*1102/i`.
- **Gagal-closed dua lapis untuk site klien**: selain dibungkus `if (isOwnerMode())`, gate ini juga dibangun pipeline `deployClient()` yang memaksa `OWNER_MODE=false` — lihat `src/lib/ownerMode.ts`.

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

| Berkas | Perubahan |
|---|---|
| `src/lib/workerHealthProbe.ts` | **Baru.** `probeWorkerHealth()` + `recordWorkerHealth()` + konstan (32 paralel, timeout 20 dtk, kunci `app_kv`, riwayat 7). |
| `src/lib/workerHealthProbe.test.ts` | **Baru.** 10 test: 200 semua, query unik, 1102 vs 503 biasa, timeout, preferensi service binding, default 32, plus 3 test `recordWorkerHealth` (tulis, cap riwayat, history rusak tidak melempar). |
| `src/app/api/cron/daily/route.ts` | Blok probe setelah backup, try/catch terpisah + `isOwnerMode()`. Hasil ikut dibalikkan di respons. |
| `src/app/api/cron/daily/route.test.ts` | 3 test baru: owner mode jalankan & tulis D1 / non-owner skip / probe gagal tetap `ok: true`. |
| `src/app/api/health/route.ts` | Field `workerHealth` via dynamic import, `isOwnerMode()`, try/catch **tidak** mengubah `checks.status`. |
| `scripts/onboarding/server.ts` | Parsing + pengembalian `workerHealth` (kedua cabang return). |
| `scripts/onboarding/public/index.html` | Helper `renderProbeBadge()` + kolom "Kepala Ruang Worker" (header + sel). |
| `arsip-klien/00_site-owner/config.env` | **Baru, gitignored.** Entry site owner untuk portal. |
| `CHANGELOG.md` | Entri `## [1.3.64]` di baris paling atas. |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.63 → 1.3.64. |

## 🧪 Hasil Gerbang

| Gerbang | Hasil |
|---|---|
| `npx vitest run` (2 berkas target) | **21 PASS** |
| `npm test` (seluruh suite) | **141 berkas / 1.164 test PASS** (baseline 1.148 → +16, **nol regresi**) |
| `npm run lint` | **bersih**, exit 0 |
| `npx tsc --noEmit` | **exit 0** |

> **Catatan:** pre-commit hook `.husky/pre-commit` repo ini masih bug — ia mengetes `$?` dari `head`, bukan dari `tsc`, sehingga error TypeScript bisa lolos dengan pesan "✅ Pre-commit checks passed!". Karena itu `npx tsc --noEmit` **wajib dijalankan terpisah**, seperti yang dilakukan di sini.

## ⚠️ Batasan yang Tetap Berlaku (Wajib Jujur ke Owner)

1. **Prediktif, bukan retroaktif.** Ia menjawab "kepala ruang berapa hari ini", **bukan** "Error 1102 terjadi kemarin jam berapa". Kalau 1102 terjadi di luar slot probe, tidak akan terdeteksi.
2. **Probe membebani Worker**: 32 render dingin serentak, sekali sehari. Tiap render memakan 200 ms–1,9 s CPU. Wajar untuk sekali sehari, tapi bebannya nyata.
3. **Probe bisa memicu 1102-nya sendiri** kalau kepala ruang sudah menyempit — dan justru itu sinyal yang dicari.
4. **Sampah cache**: query unik menyisakan entri di Cache API yang kedaluwarsa sendiri dalam 300 detik.
5. **Jalur retroaktif tidak tersedia** tanpa pekerjaan tambahan: butuh token API Cloudflare sebagai secret + izin Analytics + verifikasi nama field GraphQL yang sebelumnya gagal.

## 🔭 Tindak Lanjut (Opsional, Tidak Mendesak)

- **Vendor mermaid lokal** untuk tab Peta Bisnis kalau butuh luring — tidak terkait fitur ini, tercatat agar tidak lupa.
- Bila kelak owner ingin deteksi **retroaktif**, pekerjaannya: (1) buat token CF read-only dengan izin Analytics, (2) simpan sebagai secret Worker, (3) **verifikasi dulu** nama field GraphQL yang benar lewat uji terhadap akun produksi — jangan langsung ditulis di kode.
- Riwayat 7 hari (`worker-health/history`) saat ini **belum ditampilkan** di mana pun — tersimpan agar siap dipakai kalau owner ingin grafik tren.
