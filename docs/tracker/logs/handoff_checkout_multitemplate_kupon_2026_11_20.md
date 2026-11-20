# HANDOFF — Checkout Multi-Template + Kupon Diskon (v1.3.93)

**Tanggal handoff:** 2026-11-20
**Untuk:** AI / operator berikutnya (Hermes) — tidak perlu membaca seluruh repo.
**Versi kode:** `1.3.93` (`src/lib/constants.ts:139`)
**Status:** ✅ kode selesai & semua gate hijau · ❌ **belum di-commit, belum di-deploy, belum diuji ke D1 produksi**

Log detail fitur: [`fitur_checkout_multitemplate_kupon_2026_11_19.md`](./fitur_checkout_multitemplate_kupon_2026_11_19.md)
Aturan bisnis kanonik: [`../../operations/template-purchase-flow.md`](../../operations/template-purchase-flow.md) §11
Ringkasan untuk pembaca non-teknis: `CHANGELOG.md` entri `[1.3.93]`.

---

## 1. Apa yang dikerjakan (satu paragraf)

Dulu checkout hanya bisa membeli **satu** template per order. Sekarang **satu checkout = satu order = satu pembayaran QRIS** yang boleh berisi 1..N template, dengan **kupon opsional** dan **diskon bundel otomatis**. Rincian per template disimpan di tabel baru `order_items`; `orders` mendapat kolom `subtotal`, `discount_total`, `coupon_code`. Owner mendapat app admin **Kupon Diskon** (owner-only) dan editor tier diskon bundel di panel **Harga Jual**.

Satu order per template **tidak mungkin** — `UNIQUE INDEX idx_orders_amount_active` + nominal QRIS unik membuat dua order senilai sama tidak bisa aktif bersamaan. Itu alasan desainnya, jangan “diperbaiki”.

---

## 2. Aturan bisnis yang DIKUNCI owner (jangan diubah tanpa izin)

| Topik | Aturan |
|---|---|
| Struktur order | 1 checkout = 1 order = 1 QRIS; rincian di `order_items` |
| Harga | Rp199.000 per template (dibaca `getBasePrice()`), sama untuk semua template |
| Diskon bundel | 2 template → 10%, 3+ → 15% (default; owner bisa ubah di panel Harga Jual) |
| Kupon vs bundel | **Best-of, bukan tumpuk.** Seri → bundel. Dihitung 100% server |
| Batas bawah | Total tidak pernah < **Rp1.000**. Gratis penuh hanya lewat aktivasi gratis portal |
| Kupon | 1 kupon/order; persen 1–90% (opsional maks rupiah) atau nominal Rp1.000–50.000.000; jadwal WIB; kuota total + `max_per_email` best-effort |
| Kupon owner-only | `requireOwnerMode()` → **404** di situs klien, sebelum auth |
| Checkout publik | Hanya pembeli **situs baru**. Klien lama tambah template → portal `/api/client-template` |
| Entitlement | Hanya ditulis **portal onboarding**, tidak pernah dari Worker/D1 klien |
| Kupon | Tidak pernah dihapus permanen — hanya `archived_at` |
| Nominal | `orders.amount` = total setelah diskon **+ kode unik QRIS**. Jangan hitung ulang manual |

---

## 3. Bukti verifikasi (sudah dijalankan, bukan klaim)

| Gate | Hasil |
|---|---|
| `npx vitest run` | **158 file / 1.377 test PASS** |
| `npx tsc --noEmit` | **0 error** |
| `npx eslint` (file berubah) | bersih |
| Type-check `scripts/onboarding/*` + backfill | 0 error (tsconfig sementara; config repo mengecualikan `scripts/`) |
| Test fitur ini | `checkoutPricing` 26 · `couponService` 15 · `orderService` 41 · `pricingConfigService` 10 |

Mock D1 dipakai di unit test — **belum ada bukti perilaku di D1 produksi**. Itulah isi checklist §5–§6.

---

## 4. Peta kode (hanya file yang relevan)

### Baru

| File | Peran |
|---|---|
| `src/lib/services/checkoutPricing.ts` | Mesin harga **murni** (bundel, kupon, best-of, alokasi diskon per item, clamp Rp1.000, normalisasi/validasi kode, generator kode) |
| `src/lib/services/couponService.ts` | CRUD + arsip kupon, `getCouponStatus`, `evaluateCoupon`, `reserveCouponRedemption` (atomik), `releaseCouponRedemption`, `validateCouponDraft` |
| `src/app/api/billing/quote/route.ts` | Pratinjau harga publik, read-only, rate limit `billing_quote` |
| `src/app/api/admin/coupons/route.ts` | GET/POST CRUD kupon — owner-only + auth + CSRF + audit |
| `src/app/admin/desktop/panels/CouponsPanel.tsx` | UI kupon (helper WIB: input `datetime-local` ↔ ISO `+07:00`) |
| `src/app/admin/system/coupons/page.tsx` | Rute panel |
| `scripts/cloudflare/backfill-order-items.ts` | Backfill order lama → `order_items` (dry-run default, `--apply`, `--limit N`) |
| `src/lib/services/checkoutPricing.test.ts`, `couponService.test.ts` | Test |

### Diubah (yang penting)

| File | Perubahan |
|---|---|
| `src/lib/services/orderService.ts` | `createOrder` menerima `templateIds[]` + `couponCode`, menulis `order_items`, reservasi kupon, release saat expired/cancel, `reopenOrder` reserve ulang, `getOrderItems` |
| `src/app/checkout/CheckoutForm.tsx` | Multi-pilih template dari registry, kupon, ringkasan harga, guard kupon-belum-diterapkan |
| `src/app/orders/[orderId]/page.tsx` | Rincian item, subtotal, diskon, kode unik; guard order lama |
| `src/app/api/admin/orders/route.ts` | “Buat Pesanan” owner: multi-template + kupon |
| `src/app/admin/desktop/panels/OrdersPanel.tsx` | Form multi-template + breakdown di kartu order |
| `src/app/admin/desktop/panels/HargaPanel.tsx` | Editor tier diskon bundel |
| `src/app/api/admin/pricing/route.ts` | GET/PUT `bundle_discount` |
| `src/lib/d1-schema.ts` | Tabel `order_items`/`coupons`/`coupon_redemptions` + kolom `orders` |
| `src/lib/cloudflareD1.ts` | Self-heal `ALTER` untuk 3 kolom baru |
| `src/lib/services/pricingConfigService.ts` | `getBundleTiers()` / `updateBundleTiers()` (cache 60 s) |
| `scripts/onboarding/notify-online.ts` | `listPurchasedTemplates(slug)` — semua order lunas + harga efektif |
| `scripts/onboarding/server.ts` | Entitlement untuk semua template order tersebut, `price` = `order_items.final_price` |
| `src/app/admin/desktop/registry.ts` | App `coupons` (`ownerOnly: true`) |
| `src/middleware/csrf.ts` | `/api/billing/quote` masuk allowlist same-origin |

---

## 5. Checklist deploy (URUTAN WAJIB)

> Repo ini: deploy = `npm run deploy` (pre-deploy + compat audit + build + deploy Worker). **Deploy tidak memasang skema D1.** Sejak audit 2026-11-20, `POST /api/billing/checkout` dan `/api/admin/coupons` (GET+POST) memanggil `bootstrapD1Schema()` (idempoten, sekali per isolate) sebagai jaring pengaman — tapi tetap jalankan bootstrap sekali setelah deploy.

```bash
# 1. Commit dulu (lihat §7 soal worktree)
git add -A && git commit -m "release 1.3.93: checkout multi-template + kupon diskon"

# 2. Deploy (dari folder repo yang punya .env.local = folder utama owner)
npm run deploy

# 3. Pasang skema D1 (wajib kalau DB owner belum pernah menulis konten sejak upgrade)
npm run cf:bootstrap

# 4. Verifikasi versi
curl -s https://makeitbetter.my.id/api/health     # harus version: "1.3.93"
```

Urutan 3 dan 4 boleh dibalik, tapi **jangan** mengumumkan fitur sebelum `/api/health` melaporkan `1.3.93`. Rollback = deploy commit sebelumnya (tidak ada migrasi destruktif; kolom/tabel baru hanya ditambah).

---

## 6. Uji asap produksi (setelah deploy)

| # | Aksi | Hasil yang diharapkan |
|---|---|---|
| 1 | Login owner → app **Kupon Diskon** | Daftar kupon tampil, tidak ada error |
| 2 | Buat kupon uji `UJI-1` (nominal Rp10.000, kuota 1) | Muncul di daftar, `is_active = 1` |
| 3 | `POST /api/billing/quote` dengan 2 template | `discountSource: "bundle"`, `appliedDiscount` = 10% subtotal |
| 4 | Ubah kuota kupon → arsipkan | Berubah, lalu hilang dari daftar aktif (baris tetap ada) |
| 5 | Checkout 2 template + kupon uji | Total = subtotal − diskon + kode unik (1–999); halaman order menampilkan rincian |
| 6 | Buka order di panel Pesanan | Subtotal/diskon/kupon tampil dan cocok dengan halaman pembeli |
| 7 | Batalkan order uji di panel | Kuota kupon `UJI-1` terpakai kembali (release) |
| 8 | Reopen order uji | Reservasi kupon dibuat ulang; tidak ada error 500 |

Kebiasaan wajib repo ini: **mutasi → baca ulang lewat jalur independen → laporkan angkanya**, bukan sekadar “sudah” (`docs/operations/support-playbook.md`).

---

## 7. Belum dikerjakan / keputusan menunggu

### 7a. Status working tree (penting!)

- **25 file modified + 10 file/folder untracked**, semuanya **belum di-commit**.
- Worktree: `C:\Users\USER\.local\share\opencode\worktree\91c32c\kind-comet` — **detached HEAD** di `0bc2561`.
- `origin/main` = `6744891`. Isinya **identik** (`git diff --stat origin/main HEAD` kosong) tetapi hash berbeda karena riwayat diduplikasi. Aman: commit di worktree lalu cherry-pick/squash ke folder utama, **atau** copy file. Jangan merge buta.
- Worktree **tidak punya** `.env.local` dan **tidak punya** `arsip-klien/`. `node_modules` = junction ke `C:\Users\USER\Documents\tamplate-portofolio\node_modules`. Kredensial D1 owner ada di `C:\Users\USER\Documents\tamplate-portofolio\.env.local`.
- Artinya: **semua perintah yang menyentuh D1/deploy harus dijalankan dari folder utama** (`C:\Users\USER\Documents\tamplate-portofolio`), bukan dari worktree. Script di worktree tetap bisa dipanggil dengan path absolut.

### 7b. Pekerjaan opsional yang belum jalan

| Item | Catatan |
|---|---|
| `npx tsx scripts/cloudflare/backfill-order-items.ts` | Dry-run dulu, lalu `--apply`. Hanya order yang belum punya `order_items`. Aman diulang (idempoten) |
| Menutup `/checkout` + `/api/billing/*` di situs klien | Perilaku lama (bukan regresi). Menutupnya = keputusan produk owner (`requireOwnerMode()` → 404). **Jangan** lakukan sepihak |

### 7c. Temuan audit yang sengaja TIDAK diubah (dengan alasan)

| Temuan | Alasan tidak diubah |
|---|---|
| Backfill memakai `amount` (termasuk kode unik QRIS) sebagai `list_price` order lama | Kosmetik; mengubahnya = mengarang harga historis |
| Kupon kedaluwarsa tidak auto-fallback ke bundel | Menolak order lebih aman daripada menagih lebih tinggi dari yang dilihat pembeli |
| Sumber diskon diputuskan sebelum clamp Rp1.000 (`checkoutPricing.ts:343-359`) | Teoretis saja (kupon persen maks 90%, harga Rp199.000) |
| `validateCouponInput` memakai `Boolean(input.isActive)` | UI mengirim boolean asli; laten |
| Catch pembersihan order di `createOrder` memakai `.catch(() => {})` | Kalau gagal, order pending menahan slug + nominal unik sampai expiry 24 jam. Bisa diperbaiki nanti dengan log/alarm |

---

## 8. Jebakan teknis untuk AI berikutnya

1. **`bootstrapD1Schema` itu lazy + memoized** (`src/lib/cloudflareD1.ts:270-406`). `queryD1` **tidak** memanggilnya — hanya `setD1Value` dkk. Karena itu route checkout/kupon memanggilnya eksplisit. Kalau menambah route baru yang menyentuh tabel v1.3.93, **panggil bootstrap juga** atau pastikan `npm run cf:bootstrap` sudah jalan.
2. **`INSERT INTO order_items` tidak di-guard sendiri.** Kalau tabel hilang, order dihapus dan pembeli melihat “Gagal menyimpan rincian pesanan”. Bootstrap di route adalah pengamannya — jangan dihapus.
3. **Dua berkas DDL hidup berdampingan** — `src/crud/shared/db/schema.ts` (`SHARED_SCHEMA_QUERIES`, dipasang onboarding) dan `src/lib/d1-schema.ts` (`D1_SCHEMA_QUERIES`). Menambah kolom ke tabel bersama = tambahkan di **kedua** berkas.
4. **`ORDER BY`/kode unik QRIS** — jangan pernah menulis `amount` tanpa offset. Index unik aktif hanya untuk `pending_payment`/`waiting_verification`/`activating`.
5. **Kupon & uang sudah masuk** — `activateOrder` yang gagal **tidak** melepas kupon (sengaja: uang sudah diterima). `reopenOrder` juga tidak boleh gagal hanya karena kuota kupon penuh.
6. **Owner mode** — app kupon `ownerOnly`. Kalau menambah tool superadmin baru: `ownerOnly: true` di `registry.ts` + `requireOwnerMode()` di route + `vi.stubEnv('OWNER_MODE','true')` di test.
7. **`OWNER_MODE`/`NEXT_PUBLIC_OWNER_MODE`** harus sama-sama `"true"` di `.env.local` owner, kalau tidak panel Harga Jual/Kupon/Orders hilang dan `pre-deploy-check` menolak deploy.
8. **Nominal jangan dipercaya dari body klien** — `createOrder` selalu menghitung ulang lewat `computeQuote`.
9. **Jangan hapus baris `coupons`/`coupon_redemptions`** — arsipkan. Menghapus = menghapus bukti pendapatan.
10. **`src/components/os/utils/positionSync.ts` wajib tetap barrel di path itu** (3 dynamic import). Tidak terkait fitur ini, tapi sering tersentuh AI yang refactor.

---

## 9. Cara mulai sesi berikutnya (3 langkah)

1. `npm run cf:readiness` (atau `curl /api/health`) dari folder utama → pastikan produksi masih `1.3.92` **atau** sudah `1.3.93`.
2. Kalau belum deploy: commit → `npm run deploy` → `npm run cf:bootstrap` → uji asap §6.
3. Kalau sudah deploy: jalankan backfill dry-run, lalu putuskan item §7c bersama owner.

---

## 10. Rujukan dokumen

- `docs/tracker/logs/fitur_checkout_multitemplate_kupon_2026_11_19.md` — kronologi + keputusan + audit
- `docs/operations/template-purchase-flow.md` §11 — aturan bisnis kanonik (11.1–11.6)
- `docs/operations/support-playbook.md` §0 — alur order chat-first + kupon
- `AGENTS.md` §8 (owner mode), §12 (skema D1, deferred R2, alur checkout)
- `CHANGELOG.md` `[1.3.93]` — ringkasan yang dibaca portal `PENGELOLA_KLIEN.bat`
