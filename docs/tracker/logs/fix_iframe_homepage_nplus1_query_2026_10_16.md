# Perbaikan Kecepatan Homepage: Query Project Batch (N+1 → 3 Query) + Cache Demo 5 Menit (v1.3.43)

**Tanggal:** 2026-10-16
**Status:** ✅ Selesai & LIVE (`/api/health` = **1.3.43**, Version ID `b3fcdeb6-b8eb-47a2-92fb-838342446b01`).
**Pemicu:** Keluhan owner: *"cari kan aku penyebab kenapa proses iframe live web di halaman utama pas pertama kali masuk halaman itu lama sekali?"*

## Gejala (semua terukur langsung di produksi, bukan perkiraan)

| Kondisi | TTFB per halaman demo | Catatan |
|---|---|---|
| Cache masih berlaku (`x-opennext-cache: HIT`) | **0,28–0,52 dtk** | pengunjung biasa |
| Cache habis (ISR `revalidate=60` terlewat) | **6,7–11,7 dtk** | pengunjung sial pertama tiap menit |
| 3 iframe paralel saat cache habis (persis seperti browser) | **8,31 dtk wall clock** | sebelum aset apa pun turun |

Homepage `/` sendiri ringan (TTFB 0,41 dtk, 23 KB) — yang berat hanya ketiga halaman demo di dalam iframe.

## Akar masalah (2 lapis + 1 konteks)

### Lapis 1 — pola N+1 query di `projectSqlService.getProjectsSql()`

`src/lib/services/project/projectSqlService.ts:145-158` (kode lama):

```typescript
const projectRows = await queryD1(...);          // 1 query: semua project
for (const pRow of projectRows) {                // LOOP berurutan
  await queryD1(`SELECT * FROM project_narratives WHERE project_id = ?`);
  await queryD1(`SELECT * FROM media_assets WHERE project_id = ? ...`);
}
```

`queryD1` = **REST per permintaan HTTP ke `api.cloudflare.com`** (worker tanpa D1 binding; lihat `cloudflareD1.ts:78-93`), terukur ±150–450 ms per panggilan. Untuk **20 project** di produksi:

```
1 (daftar) + 20 × 2 (narrative + media) = ±41 query × ±200 ms ≈ ±8 detik
```

Cocok persis dengan TTFB terukur 6,7–11,7 dtk. Fungsi ini dipakai homepage `/`, `/preview/[template]`, `/projects`, dan 3 endpoint API projects — jadi semua menderita sama.

### Lapis 2 — cache terlalu pendek

`src/app/preview/[template]/page.tsx:10`: `export const revalidate = 60;` → **tiap 60 detik pengunjung pertama menanggung seluruh biaya render ulang** di atas.

### Lapis 3 (konteks, TIDAK diubah — di luar persetujuan)

- Tiap iframe memuat **aplikasi Next.js penuh**: 24 file JS/CSS = **1,54 MB per iframe (±4,7 MB untuk tiga)** serentak pada kunjungan pertama (belum ada di cache browser) — itulah mengapa keluhan menempel pada "pertama kali".
- HTML tiap halaman ikut mem--inline **seluruh data situs** (21 project + narrative, 8 testimoni + percakapan penuh, 5 notifikasi chat) → 87–106 KB per halaman.

## Perbaikan yang disetujui owner (keputusan: "Perbaiki N+1 + cache")

1. **`src/lib/services/project/projectSqlService.ts`** — `getProjectsSql()` kini **3 query**: 1 daftar project + 2 batch `WHERE project_id IN (subquery)` paralel (`Promise.all`), lalu pemetaan di memori (`Map` narrative & media per `project_id`). Subquery dipakai agar jumlah parameter tidak tumbuh seiring jumlah project (aman untuk portofolio besar). **Kontrak hasil identik**: urutan project, narrative pertama per project, media terurut `sort_order`.
2. **`src/app/preview/[template]/page.tsx`** — `revalidate` 60 → **300** detik (demo hanya berubah saat owner mengedit konten; header `Cache-Control` terverifikasi menghitung turun dari 300 — terbaca `s-maxage=75` saat sisa usia 225 dtk).
3. **`src/lib/services/project/projectSqlService.test.ts`** — **2 test regresi** mengunci pola batch: (a) 2 project = *tepat* 3 query + pemetaan narrative/media benar (comment eksplisit menyebut angka ±41 query / ±8 detik pola lama); (b) tanpa project = berhenti di 1 query.
4. **`src/lib/constants.ts`** — `APP_VERSION` → **1.3.43**; entri CHANGELOG 1.3.43 ditulis (penjaga `constants.test.ts` memaksa keduanya selalu cocok — sempat merah sekali saat versi naik duluan, persis seperti yang dirancang).

## Verifikasi

- `tsc --noEmit` 0 error; `npm run lint` bersih; `npm test` **133 file / 1.071 test PASS** (baseline 1.069 + 2 regresi baru; nol test patah).
- Pre-commit lint + pre-push audit lolos. Commit `ef63417` → `origin/main`.
- **Deploy** `npm run deploy` sukses, Version ID `b3fcdeb6-b8eb-47a2-92fb-838342446b01`.

**Hasil terukur SETELAH deploy (kondisi terberat: cache dingin tepat setelah deploy = render ulang penuh dengan kode baru):**

| Metrik | Sebelum (v1.3.42) | Sesudah (v1.3.43) |
|---|---|---|
| 3 iframe paralel, cache habis | **8,31 dtk** | **2,26 dtk** |
| TTFB render ulang | 6,7–11,7 dtk | ±2,0 dtk (isolate masih dingin) |
| Permintaan cache berikutnya | 0,28–0,52 dtk | 0,59–0,81 dtk (normal) |
| Jumlah query project per render | ±41 | **3** |

- **Integritas data terverifikasi** di payload produksi: **21 project, 21 narrative, 21 galleryItems** — tidak ada yang hilang atau tertukar oleh pemetaan batch.

> Catatan jujur: sisa ±2 dtk pada render ulang sebagian berasal dari **isolate dingin tepat setelah deploy** (bootstrap modul + skema). Regenerasi pada isolate hangat diperkirakan lebih rendah lagi; yang pasti terukur, beban query turun dari ±41 ke 3.

## Sisa kandidat (belum dikerjakan — butuh izin owner, jangan disentuh diam-diam)

1. **N+1 serupa di `getOtherProjectMediaKeys()`** (`projectSqlService.ts:105-126`) — loop per-project di jalur **mutasi admin** (hapus/salin project). Dampak ke kecepatan simpan/hapus, bukan halaman publik. Pola perbaikannya sama dengan di atas.
2. **Berat unduhan ±4,7 MB JS ketiga iframe** — butuh strategi lazy-load on-demand (iframe hanya dimuat saat kartu demo aktif/terlihat). Keputusan desain, bukan sekadar kode.
3. **D1 binding langsung** (mengganti REST per query, ±200 ms → <10 ms) — perbaikan struktural paling besar, tapi menyentuh pipeline deploy managed-service (`wrangler.client.<slug>.jsonc`, dokumen §6 AGENTS.md). Perlu rencana & izin terpisah.
4. Payload data situs ter-inline penuh di tiap HTML halaman demo (87–106 KB) — kandidat pemisahan data ringan vs penuh.
