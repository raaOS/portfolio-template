# Log: Tab "Peta Bisnis" di Portal Owner (v1.3.24)

**Tanggal:** 2026-10-05
**Status:** 🟢 Selesai — gerbang hijau (tsc 0, eslint 0, **118 file / 914 test PASS**, `release:audit` **59/59**, `release:sale-readiness` **12/12**) + **uji browser nyata LULUS**
**Trigger:** Pertanyaan owner: _"apa bisa dibuat diagram di admin dashboard untuk aku sendiri aja bukan customer? tapi diagram apa yang cocok biar AI tau dan aku paham yang tidak paham IT?"_ → pilihan owner via kuesioner: **"Alur + peta aset"**, taruh di **"Portal PENGELOLA_KLIEN"**.

---

## Keputusan Desain

| Pertanyaan                             | Jawaban                                                                                                                       | Alasan                                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Taruh di admin dashboard `/admin`?     | **TIDAK** — panel admin dipakai semua klien; butuh mekanisme kunci env baru, kode lebih banyak, ikut ter-deploy ke tiap klien | Prinsip Ponytail (AGENTS.md §0)                                                                                                                |
| Taruh di portal `PENGELOLA_KLIEN.bat`? | **YA** — portal hanya jalan di komputer owner, tidak pernah dikirim ke klien; nol risiko bocor, nol kode kunci                | Sudah ada preseden: Client Status Board (Sprint 88) juga owner-side tools di portal                                                            |
| Format diagram                         | **Mermaid** (teks) di `docs/diagrams/*.mmd`                                                                                   | Satu sumber untuk dua pembaca: owner melihat **gambar** di portal, AI membaca **teks** dari repo; ubah .mmd saja → portal tampil versi terbaru |
| Diagram apa                            | (1) **Alur Bisnis** 3 jalur Pembeli/Sistem/Owner, (2) **Peta Aset** siapa punya apa di mana                                   | Bahasa non-IT per kotak, lengkap dengan alur bayar→aktivasi→bengkel→serah terima + cron 01:00 WIB                                              |

## Perubahan (4 file)

| File                                   | Isi                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/diagrams/alur-bisnis.mmd` (BARU) | flowchart TB 3 subgraph: PEMBELI (6 langkah), SISTEM (order→kedaluwarsa/bukti→aktivasi + kotak cron 01:00 WIB), OWNER (notifikasi→verifikasi→bengkel 6 langkah→WhatsApp→dampingi); 17 node, 20 edge                                                                                                                                                  |
| `docs/diagrams/peta-aset.mmd` (BARU)   | 4 subgraph: DIMILIKI PEMBELI / DIMILIKI ANDA / AKUN CLOUDFLARE MILIK KLIEN (D1, R2, Worker, domain) / DIJALANKAN SISTEM OTOMATIS; 14 node, 10 edge                                                                                                                                                                                                   |
| `scripts/onboarding/server.ts`         | `GET /api/diagrams` — baca kedua .mmd dari `docs/diagrams/` (aman kalau file belum ada → string kosong), balas JSON. Anchor: setelah blok static file, sebelum `// API: Verify Token`                                                                                                                                                                |
| `scripts/onboarding/public/index.html` | Tab ke-5 **"Peta Bisnis"** + view `view-map` (2 kartu + `<pre class="mermaid">`), CSS `.mermaid`, JS `loadBizMap()` (fetch → `import()` mermaid@11 dari CDN jsdelivr → `mermaid.run`), fallback: kalau CDN gagal tapi sumber terbaca → teks mentah tetap terbaca; kalau fetch gagal → pesan jelas. Tab & view didaftarkan di kedua array `switchTab` |

## Verifikasi Nyata (bukan hanya unit test)

1. Portal dijalankan detached (PID 7084, port 4567): `GET /api/diagrams` → JSON valid, `alurBisnis` 1793 karakter, `petaAset` 1386 karakter; `GET /` → 200 + semua penanda (`tab-btn-map`, `view-map`, `diagram-alur/aset`, `loadBizMap`) ada.
2. **Browser nyata** (Chromium via browser tool): klik tab "Peta Bisnis" → `view-map` display `block` → **kedua `<pre class="mermaid">` punya `data-processed="true"` dan tepat satu anak `<svg>`** — bukti render sukses, bukan teks mentah:
   - Alur: **17 node, 20 edge**, viewBox 1666×1837, label terverifikasi di dalam SVG: "PEMBELI", "Bengkel 6 langkah", "01:00 WIB", "Rp199.000".
   - Aset: **14 node, 10 edge**, viewBox 2244×771, label: "AKUN CLOUDFLARE MILIK KLIEN", "Rp199.000".
   - (Satu "teks error" yang terdeteksi ternyata berasal dari kode `<script>`-nya sendiri, bukan error nyata — diverifikasi dengan menyisir elemen daun.)
3. Screenshot desktop tidak tersedia di lingkungan kerja ini — bukti render memakai inspeksi DOM SVG di atas; tab portal dibiarkan terbuka di panel Review untuk dilihat owner.
4. Gerbang penuh: `tsc --noEmit` 0 · `eslint src` 0 · `npm test` **118 file / 914 test PASS** · `release:audit` **59/59** · `release:sale-readiness` **12/12** · prettier: `index.html` PASS, `server.ts` gagal **pra-ada** (versi HEAD juga gagal → tidak direformat, aturan baseline).

## Dampak Produksi

**TIDAK perlu deploy.** Perubahan hanya di `scripts/` (alat lokal owner) + `docs/` — tidak masuk bundle Worker, tidak memengaruhi situs klien.

## Sisa / Lanjutan

- Rendering ambil pustaka Mermaid dari **CDN** (jsdelivr) — portal memang butuh internet untuk semua langkah CF, jadi ini konsisten; kalau suatu saat butuh luring, vendor `mermaid.min.js` ke `scripts/onboarding/public/`.
- Kalau alur bisnis berubah (harga, langkah bengkel, dst): **ubah `docs/diagrams/*.mmd` saja** — portal menampilkan versi terbaru otomatis (dibaca ulang tiap request, tidak perlu restart).
- Belum ada preview diagram di README/dokumen GitHub (GitHub merender mermaid otomatis kalau dibungkus blok ```mermaid di .md) — belum diminta.

## Perbaikan 2026-10-06 (v1.3.25) — 3 putaran feedback owner

### Putaran 1 — _"kerjaan Opus banyak dikurangin… desain kamu kecil"_

**Diagnosis (semua perubahan Opus saat itu belum di-commit, HEAD masih `26b49bb`):**

| #   | Masalah                                      | Bukti                                                                                                                                                                                             |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Kedua file `.mmd` dipangkas jadi jalur datar | `alur-bisnis.mmd` 44→26 baris (3 subgraph → 0, node 11 vs 17), `peta-aset.mmd` 39→16 baris (4 subgraph → 0, node 4 vs 14); kotak cron 01:00 WIB, anti-spam, tiket kerja 6 langkah, RAHASIA hilang |
| 2   | Teks diagram dikecilkan                      | tema Mermaid `fontSize: '13px'` (default 16px)                                                                                                                                                    |
| 3   | Gambar dipaksa menyusut                      | `svg { max-width: 100% !important }` + `useMaxWidth: true` → diagram 1666–2244px dipaksa masuk kotak ±900px → teks efektif hanya ±7px. **Penyebab utama "kecil"**                                 |

**Fix:** kedua `.mmd` **direstore persis versi `26b49bb`** (`git diff 26b49bb -- …` = **kosong 0 baris**; API `/api/diagrams` kembali 1793 & 1386 byte); `index.html` font & judul diperbesar, `.container.is-wide` 1080 → **1400px**; hal yang bagus dari Opus dipertahankan (render ulang tiap tab dibuka, cache pustaka, `align-items: flex-start`).

### Putaran 2 — _"terlalu besar diagramnya"_

Solusi putaran 1 (gambar sebesar asli + geser samping, teks 20px) ditolak — jadi raksasa & harus digeser. Kembali ke **pas selebar kotak**:

- `useMaxWidth: true` + `.mermaid svg { max-width: 100% }` → **semua bagian terlihat sekaligus, tanpa scroll horizontal** (terukur `scrollable: false`).
- Font dasar 16px + **label `.mmd` dipecah jadi baris-baris pendek** (tambahan `<br/>` saja — kata 100% sama) → lebar alami akhir **alur 1713px / aset 2160px**, skala pas-otomatis lebih ringan → huruf lebih terbaca.
- Judul halaman **28px**, judul kartu **17px**, keterangan **15px**, kartu padding 1.5rem; keterangan kartu ditulis ulang jadi "otomatis pas selebar kotak — tanpa digeser".

### Putaran 3 — _"suka desainnya, tapi garisnya bengkok — mau rapi seperti gambar ke 2"_

Keluhan kini **garis penghubung**: miring diagonal antar-kotak. Diagnosa: `flowchart.curve: 'linear'` → segmen lurus miring.

**Uji 5 opsi langsung di browser** (render per contoh via CDN mermaid@11, lalu baca atribut `d` tiap `path.flowchart-link`):

| Opsi                      | Hasil                                                          |
| ------------------------- | -------------------------------------------------------------- |
| `linear` (lama)           | **diagonal** — inilah garis bengkoknya                         |
| `basis` (default mermaid) | melengkung/bergelombang — malah lebih tidak rapi               |
| `step`                    | 100% siku — titik singgung kotak terbanyak (7)                 |
| `stepAfter`               | 100% siku — live 3 titik singgung (2 menembus kotak keputusan) |
| **`stepBefore`** ✅       | **100% siku & paling bersih** — dipakai akhir                  |

**Hasil akhir (`stepBefore`), diukur di browser:**

| Diagram     | Segmen garis | Segmen miring | Titik singgung kotak | Kotak / Panah |
| ----------- | ------------ | ------------- | -------------------- | ------------- |
| Alur Bisnis | 81           | **0**         | 1                    | 17 / 20       |
| Peta Aset   | 41           | **0**         | 1                    | 14 / 10       |
| **Total**   | **122**      | **0**         | 2                    | **31 / 30**   |

_Titik singgung = ujung garis siku sesekali menyinggur tepi kotak (2 dari 122 segmen) — varian lain lebih buruk: `stepAfter` 3, `step` 7. Garis tetap menembus ruang antar-kotak (wajar untuk garis antar-jalur), tidak ada satupun garis miring._

### Verifikasi akhir + gerbang

- Detail terverifikasi ada di dalam SVG: "Bengkel 6 langkah", "01:00 WIB", "anti-spam", "AKUN CLOUDFLARE MILIK KLIEN", "RAHASIA" — semua `true`.
- 7 cluster, tanpa scroll horizontal, font dasar 16px (judul 28/17/15px, kontainer 1400px).
- Gerbang: tsc 0, eslint 0, **118 file / 914 test PASS**, `release:audit` **59/59**, `release:sale-readiness` **12/12**, prettier PASS untuk file yang disentuh.

**Dampak produksi:** tidak perlu deploy — hanya `scripts/onboarding/public/index.html` + `docs/diagrams/*.mmd` (alat portal owner), di luar bundle Worker.
