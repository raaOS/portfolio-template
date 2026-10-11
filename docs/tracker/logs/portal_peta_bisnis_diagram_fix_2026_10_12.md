# Portal "Peta Bisnis": Diagram Kembali Tampil — Kutip Liar Mermaid Diperbaiki (v1.3.39)

- **Status:** 🟢 Completed
- **Tanggal:** 2026-10-12
- **Versi:** 1.3.39

## Laporan Owner

> "BUG BARU Diagram gagal dimuat. Pastikan internet aktif, lalu muat ulang halaman. PADAHAL INTERNET BISA"

Tab **Peta Bisnis** di portal `PENGELOLA_KLIEN.bat` menampilkan dua kotak merah "Diagram gagal dimuat. Pastikan internet aktif…" meski internet normal.

## Diagnosis (reproduksi di browser harness, bukan tebakan)

1. Endpoint `GET /api/diagrams` (server portal yang sedang berjalan di :4567) → **200**, `alurBisnis` 1942 char, `petaAset` 1535 char — sisi server sehat.
2. Impor `mermaid@11` dari CDN → **sukses** — internet/CDN bukan masalah.
3. `mermaid.run()` → **melempar parse error**: `Parse error on line 18 ... got 'STR'` — merujuk `docs/diagrams/alur-bisnis.mmd` baris 21 (label S5).

**Akar masalah:** baris 21 `alur-bisnis.mmd` memuat `email \"pembayaran<br/>terverifikasi\"` — kutip lurus ber-`backslash` gaya JavaScript di dalam label `["..."]` Mermaid. Mermaid tidak mengenali escape `\"`; parser berhenti di kutip itu. Masuk sejak commit `ab27f5b` (penyuntingan teks email aktivasi "Opsi A") — file .mmd tidak ikut teruji di commit itu.

**Kenapa DUA-DUANYA gagal:** `loadBizMap` memanggil `mermaidLib.run({ nodes: [alurEl, asetEl] })` sekali untuk dua elemen; error parse elemen pertama menggugurkan keduanya, lalu satu blok `catch` menampilkan pesan "internet aktif" untuk keduanya — pesan yang menyesatkan (sengaja dilaporkan owner sebagai bug terpisah).

## Perbaikan

| File | Perubahan |
|---|---|
| `docs/diagrams/alur-bisnis.mmd` | Kutip liar `\"…\"` di label S5 dihapus (teks "pembayaran terverifikasi" tanpa kutip — arti sama). |
| `scripts/onboarding/public/index.html` | Render **terpisah per diagram** (`try/catch` per elemen) — file rusak tak mematikan diagram sebelahnya. |
| `scripts/onboarding/public/index.html` | Blok `catch` utama kini bertahap (`stage`): "mengambil data diagram dari portal" / "memuat pustaka diagram (CDN)" — pesan sesuai kegagalan nyata, bukan otomatis "internet aktif". Error mermaid tampil sebagai baris pertama pesan (`err.str`), bukan objek `Object` di konsol. |

## Verifikasi (browser harness di localhost:4567, portal berjalan)

- Klik tab Peta Bisnis → **kedua diagram render**: alur bisnis **17 node / 20 garis**, peta aset **14 node / 10 garis** (persis angka validasi awal v1.3.32/v1.3.24).
- Konsol browser: **0 error**.
- Uji jalur error: meniru panggilan run dengan teks rusak → pesan kini "Teks diagram tidak valid di docs/diagrams/*.mmd (Parse error on line …)".
- `npx vitest run src/lib/constants.test.ts`: lolos (APP_VERSION 1.3.39 = entri teratas CHANGELOG).
- Sama seperti catatan v1.3.24: perubahan hanya file portal owner (`docs/diagrams/*.mmd` + `index.html`) — **tidak memengaruhi situs klien**; versi tetap dinaikkan agar catatan tampil di tab Update portal.

## Pelajaran / Pencegahan

- File `.mmd` adalah teks yang di-edit AI/owner manual — **tanda kutip lurus di dalam label adalah jebakan Mermaid yang tidak diberi peringatan**. Jangan pakai `\"`; hapus kutip atau pakai tanda lain.
- Pesan error yang menunjuk penyebab paling "terasa" (internet) padahal gagal di tahap lain membuat bug sulit dilaporkan — sejak perbaikan ini setiap tahap punya pesan sendiri.

## Putaran 2 — Visual garis tebal (permintaan owner 2026-10-12)

> Laporan: _"perbaiki visual diagram, garis hitam tebal sudut 90°-nya banyak yang berkelok-kelok, seharusnya cukup 1; segitiga petunjuknya tidak simetris"_

**Diagnosis (inspeksi DOM SVG live):** garis tebal `edge-thickness-thick` (3.5px) lolos dari perbaikan `straightenEdges` karena fungsi itu hanya merapikan EKOR jalur — badan staircase mermaid dibiarkan. Segitiga panah sebenarnya simetris (marker `orient=auto`) tetapi tampak miring karena segmen terakhir mendekati kotak tidak lurus sumbu / masuk off-center.

**Perbaikan (`straightenEdges`, `scripts/onboarding/public/index.html`):**
- Jalur tebal dirangkum jadi **1 belokan**: kandidat A (mendatar lalu tegak, masuk **tengah atas** kotak) dan kandidat B (tegak lalu mendatar, masuk samping menghadap sumber); kandidat C (2 belokan lewat koridor bebas) untuk jalur padat; semua kandidat diuji **bebas tabrak** terhadap seluruh kotak (kecuali sumber/tujuan) — bila semua tabrak, jalur mermaid dipertahankan.
- Toleransi deteksi tepi samping 6px → 10px (pangkasan mermaid untuk garis tebal ~8px).
- Jangkar keluar/masuk mermaid dipertahankan sebagai basis perhitungan → rute baru tetap melewati ruang aman yang sudah dipilih layout.

**Verifikasi (browser harness, kedua diagram):**
- Alur bisnis: **6/6 garis tebal = 1 belokan**, Peta Aset: 3 garis = 1 belokan + CF3→PB2 = 2 belokan (koridor padat AU1/AU2/CF1).
- **10/10 nol tabrakan kotak** (pemeriksa numerik per segmen), 10/10 segmen penutup lurus sumbu → panah simetris.
- Konsol browser: 0 error. Screenshot visual: kedua diagram bersih.

## File yang Dimodifikasi

- `docs/diagrams/alur-bisnis.mmd`
- `scripts/onboarding/public/index.html`
- `src/lib/constants.ts` (1.3.39)
- `CHANGELOG.md`
- `docs/tracker/logs/portal_peta_bisnis_diagram_fix_2026_10_12.md` (baru)
- `docs/tracker/INDEX_TRACKER.md`
