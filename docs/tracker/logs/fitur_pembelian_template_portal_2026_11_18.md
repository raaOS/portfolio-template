# Tracker Log: Pembelian & Aktivasi Template via Portal Owner (v1.3.92)

**Status:** 🟢 Completed (2026-11-18) — kode + dokumentasi selesai, teruji nyata di D1 gladi, **belum di-deploy** (tidak perlu: portal & CLI owner-side; angka `1.3.92` baru terlihat di produksi pada deploy berikutnya).
**Mulai:** 2026-11-18
**Selesai:** 2026-11-18

## 📌 STATUS TERAKHIR — WAJIB DIBACA & DIUPDATE AI BERIKUTNYA

- **Tanggal update:** 2026-11-18
- **Progress:** Selesai penuh. Aturan bisnis: setiap template dijual terpisah Rp199.000,
  satu pembelian = satu order di D1 owner, pindah ke template yang sudah dibeli = gratis,
  aktivasi **hanya** lewat portal lokal (klien tidak punya tombol ganti template).
- **Deploy:** ❌ tidak perlu untuk fitur ini. `APP_VERSION` dinaikkan ke `1.3.92` semata
  untuk menjaga `src/lib/constants.test.ts` (wajib sama dengan entri CHANGELOG teratas).
- **Dokumen acuan:** `docs/operations/template-purchase-flow.md` (alur bisnis lengkap +
  daftar larangan) dan AGENTS.md §12 subseksi "Pembelian & Aktivasi Template (v1.3.92)".
- **Langkah berikutnya bila ada klien baru/klien minta beli template:**
  1. Klien lama → `npx tsx scripts/cloudflare/backfill-template-entitlements.ts` (dry-run,
     lalu `--apply`) supaya kepemilikan historis + order tercatat.
  2. Pembelian baru → portal `PENGELOLA_KLIEN.bat` → Detail Klien → **Template & Pembelian**.
  3. Pindah template yang sudah dibeli → tombol **Aktifkan (gratis)** (atau CLI
     `npm run client:template -- <folder> <key>`).
- **Jangan:** menambah pemilih template di panel admin klien; menghapus order saat
  `PARTIAL_OWNERSHIP_WRITTEN`; memberi entitlement "semua template" saat onboarding;
  memakai SQL manual untuk `active_template_key`.

## 🎯 Keputusan owner yang mengunci desain

1. Setiap template = produk terpisah Rp199.000 (harga default dari panel Harga Jual, boleh
   diubah saat mencatat pembelian, batas Rp50.000–Rp50.000.000).
2. Pembelian harus **tercatat lengkap** di panel owner (satu order per pembelian template).
3. Re-aktivasi template yang sudah dimiliki = **gratis**.
4. Membeli template B **bukan** onboarding baru (tanpa provisioning/deploy/hapus konten).
5. Klien **tidak** boleh mengganti template sendiri; aktivasi hanya lewat portal lokal.
6. Backfill klien lama = **entitlement + order historis** (bukan entitlement saja).
7. CLI `set-client-template` wajib punya guard entitlement; `--force` darurat tanpa order.

## 🧩 Perubahan per file

### Baru

- `scripts/onboarding/template-purchase.ts` — inti logika: validasi harga, gate versi
  (`1.3.88` konten, `1.3.90` filter admin), keputusan aksi (`noop`/`activate`/`purchase`/`error`),
  `readTemplateState` (invarian tepat 1 baris `sites` + `CUSTOMER_SITE_ID` cocok),
  `ensureTemplateCatalog` (upsert dari registry), `applyTemplateChange` (katalog → entitlement →
  `active_template_key` → audit → verifikasi baca balik) + `TemplateChangeError.partial`.
- `scripts/onboarding/template-purchase.test.ts` — **22 test**.
- `scripts/cloudflare/backfill-template-entitlements.ts` — backfill klien lama:
  katalog + entitlement template aktif + order historis (`ORD-MIG-<YYYYMMDD>-<hex>`,
  `payment_method='migrasi_historis'`). Dry-run default, `--apply`, `--no-orders`, `--folder`.
  Kredensial per-D1 eksplisit (tidak mencampur `process.env`), verifikasi baca balik, idempoten.
- `docs/operations/template-purchase-flow.md` — dokumen alur bisnis kanonik.

### Diubah

- `scripts/onboarding/server.ts`
  - Helper owner billing: `readOwnerBillingContext` (baca `.env.local` per request, **tidak**
    menulis `process.env` karena proses yang sama memegang kredensial klien),
    `readOwnerBasePrice`, `createOwnerTemplateOrder`, `deleteOwnerOrder`,
    `readClientEnvForFolder`.
  - Endpoint baru `GET /api/client-template` (state + `owned` + `suggestedPrice` + `billingReady`
    + `priceRange` + `versionGate`) dan `POST /api/client-template` (activate/purchase).
  - Lock per folder (409 saat dobel klik), probe `/api/health` 8 detik sebelum menulis,
    rollback order hanya bila entitlement **belum** tertulis, sinkron `ACTIVE_TEMPLATE_KEY`
    arsip via `upsertEnvFile`.
  - Onboarding STEP 4: entitlement hanya untuk situs **baru**; `active_template_key` tidak
    lagi ditimpa (`COALESCE(active_template_key, excluded.active_template_key)`); tabel wajib
    verifikasi ditambah `portfolio_templates` + `site_template_entitlements`; entitlement situs
    baru diverifikasi baca balik.
- `scripts/onboarding/public/index.html` — seksi **Template & Pembelian** di modal Detail Klien
  (badge AKTIF/DIMILIKI/BELUM DIBELI, tombol "Aktifkan (gratis)", form pembelian, gate versi,
  konfirmasi ganda) + CSS `.template-row`/`.template-badge`/`.template-input`.
- `scripts/cloudflare/set-client-template.ts` — guard entitlement (baca
  `site_template_entitlements`), flag `--force` (tanpa order), mode baca menampilkan template
  yang dimiliki, pesan usage mengarahkan pembelian ke portal.
- `CHANGELOG.md` — entri `[1.3.92]`.
- `src/lib/constants.ts` — `APP_VERSION = '1.3.92'`.
- `AGENTS.md` — subseksi aturan bisnis terkunci + pointer ke dokumen alur.
- `docs/operations/support-playbook.md` — §11 ditulis ulang (11a beli, 11b gratis, 11c backfill,
  11d CLI, 11e larangan).

## ✅ Bukti verifikasi (nyata, bukan klaim)

**Invarian "klien tidak bisa ganti sendiri" (diperiksa di `src/`, 2026-11-18):** tidak ada route
`src/app/api/**` yang menulis `sites.active_template_key` (hanya baca di `api/admin/site-template`);
semua penulis entitlement di app (`api/admin/sites/[siteId]/entitlements`, `api/admin/sites`)
digerbangi `requireOwnerMode()` → 404 di deployment klien; `seed.ts` hanya memberi `os-desktop`
lewat jalur `/setup` lama yang mati.

### Unit test

```
npx vitest run scripts/onboarding/template-purchase.test.ts scripts/onboarding/portal-clients.test.ts
Test Files  2 passed (2)
     Tests  41 passed (41)   ← 22 baru + 19 lama
```

### Typecheck

`npx tsc -p .tsconfig.scripts-check.json` (tsconfig sementara untuk 4 skrip: `server.ts`,
`template-purchase.ts`, `backfill-template-entitlements.ts`, `set-client-template.ts`) →
**0 error**. File tsconfig sementara dihapus setelahnya.

### Backfill `--apply` pada D1 gladi (nyata)

```
[gladi-2026-10-24] 01_gladi-2026-10-24 (Gladi Resik)
  template aktif : os-desktop
  entitlement    : BARU (Rp199.000, oleh migrasi-1.3.92)
  order historis : BARU ORD-MIG-20261024-52490A (Rp199.000)
  purchased_at   : 2026-10-24 16:50:35
  hasil          : OK (terverifikasi baca balik)
```

Baca independen lewat D1 HTTP API (bukan lewat kode baru):

- client `sites`: `active_template_key = os-desktop` (tidak berubah)
- client `site_template_entitlements`: `os-desktop | 199000 | migrasi-1.3.92 | 2026-10-24 16:50:35`
- client `portfolio_templates`: 3 template, harga 199000, `is_active=1`
- owner `orders`: `ORD-MIG-20261024-52490A | gladi-2026-10-24 | os-desktop | 199000 | migrasi_historis | activated`

Dry-run ulang → `entitlement: sudah ada — dilewati`, `order historis: sudah ada — dilewati`
(idempoten terbukti). `00_site-owner` → `[SKIP]` (bukan klien portal, tanpa kredensial D1 klien).

### Portal endpoint (server lokal `PORT=4599`, env owner dari `.env.local` utama)

| Uji | Hasil |
|---|---|
| `GET /api/client-template?folder=01_gladi-2026-10-24` (sebelum backfill) | 200, `owned: []`, `catalogReady: false`, `billingReady: true`, `suggestedPrice: 199000` |
| `POST` mode `activate` `infinite-canvas` (belum dibeli) | **409** "Template Infinite Canvas belum dibeli. Catat pembelian dulu (Rp199.000)…" |
| `GET` setelah backfill | 200, `owned: [os-desktop …grantedBy migrasi-1.3.92]`, `catalogReady: true` |
| `POST` mode `purchase` `infinite-canvas` Rp199.000 | 200, order `ORD-20261118-027F30`, `entitlementCreated: true`, `archiveSynced: true`, `deployedVersion: 1.3.90`, tanpa peringatan versi |
| Verifikasi setelah pembelian | entitlement `infinite-canvas | 199000 | portal:ORD-20261118-027F30`; `sites.active_template_key=infinite-canvas`; audit `template_purchased` (metadata memuat orderId + catatan); owner order `template_tambahan | activated | 6281234567890 | https://makeitbatter.my.id`; arsip `ACTIVE_TEMPLATE_KEY=infinite-canvas` |
| `POST` mode `activate` `os-desktop` | 200, `changed: true`, `orderId: null`, `entitlementCreated: false` (gratis, tanpa order baru) |
| `POST` mode `activate` `os-desktop` lagi | 200, `changed: false`, "sudah aktif — tidak ada perubahan" (noop, tanpa tulis) |
| Rollback total | order uji dihapus, entitlement `infinite-canvas` dihapus, audit `owner-portal` dihapus, `active_template_key=os-desktop`, arsip `os-desktop` → state identik dengan sebelum uji (orders gladi 1 = order migrasi, entitlements 1, audit 0) |

Gate versi: gladi ter-deploy **v1.3.90** sehingga `infinite-canvas` lolos tanpa peringatan
(aturan blokir <1.3.88, peringatan 1.3.88–1.3.89).

### CLI owner

```
npx tsx scripts/cloudflare/set-client-template.ts 01_gladi-2026-10-24
→ template aktif: os-desktop (OS Desktop); Dimiliki: os-desktop          exit=0

npx tsx scripts/cloudflare/set-client-template.ts 01_gladi-2026-10-24 infinite-canvas
→ ✗ belum memiliki template "infinite-canvas" (tidak ada baris entitlement)   exit=1
   + arahan ke portal & backfill & --force darurat
```

## 🐞 Bug / jebakan yang ditemukan & ditutup

1. **Re-provision menimpa template.** Seed lama memakai
   `active_template_key = excluded.active_template_key` → template yang sudah diaktifkan owner
   bisa diam-diam kembali saat provisioning ulang. Diganti `COALESCE(active_template_key, …)`.
2. **Onboarding bisa membagikan template gratis.** Entitlement dulu tidak ada; sekarang hanya
   ditulis untuk situs baru dan diverifikasi baca balik.
3. **Order palsu saat aktivasi gagal.** Kalau order dibuat lebih dulu lalu `UPDATE sites` gagal,
   panel owner akan mencatat pendapatan yang tidak jadi. Sekarang order hanya dihapus bila
   entitlement **belum** tertulis; setelah entitlement tertulis order dipertahankan +
   `PARTIAL_OWNERSHIP_WRITTEN`.
4. **Kredensial owner bocor ke proses klien.** `process.env` dipakai bersama oleh provisioning
   klien; helper owner membaca `.env.local` per request dan tidak menulis env global.
5. **Backfill menghitung klien non-portal sebagai gagal.** `00_site-owner` tidak punya kredensial
   D1 klien → dulu `[FAIL]`; sekarang `[SKIP]` dengan alasan jelas (bukan error).
6. **Dedupe order historis.** Order lama tanpa `template_id` dianggap pembelian pertama klien →
   tidak dibuatkan order kedua.

## ⚠️ Catatan operasional

- Portal hanya bind `127.0.0.1`; endpoint template ikut aturan itu (tanpa CORS wildcard).
- Pembelian **butuh** `.env.local` owner lengkap (`CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_D1_API_TOKEN`, `CLOUDFLARE_D1_DATABASE_ID`). Tanpa itu UI menampilkan
  "pembelian tidak bisa dicatat" dan POST menolak (`OWNER_BILLING_UNAVAILABLE`) — sengaja,
  supaya tidak ada pembelian tanpa bukti.
- Entitlement memakai `INSERT OR IGNORE` + verifikasi; UNIQUE `(site_id, template_id)` adalah
  pertahanan terakhir terhadap dobel-klik (selain lock per folder).
- Harga yang dibayar klien **boleh** berbeda dari Harga Jual (diskon); yang dicatat adalah
  nominal yang diisi owner, dan itulah yang tersimpan di order + entitlement.
