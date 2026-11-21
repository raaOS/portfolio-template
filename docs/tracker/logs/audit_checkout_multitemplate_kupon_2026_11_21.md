# Audit Independen — Checkout Multi-Template + Kupon (v1.3.93)

**Tanggal:** 2026-11-21 (WIB)
**Auditor:** Hermes (sesi review atas permintaan owner — "cek kerjaan agent lain, takut ada celah fatal / human error")
**Objek:** commit `cd12e62` (release 1.3.93, 36 file, +4.487/−207) + handoff `handoff_checkout_multitemplate_kupon_2026_11_20.md`
**Status:** 🟡 Audit selesai — **tidak ditemukan celah fatal pada perhitungan uang**; 4 temuan MEDIUM (jalur kegagalan & human-error deploy) + beberapa LOW. **Belum ada kode diubah** — perbaikan menunggu izin owner (aturan Ponytail).

---

## 1. Verifikasi yang dijalankan sendiri (bukan klaim handoff)

| Gate | Hasil nyata |
|---|---|
| `npx vitest run` | **158 file / 1.377 test PASS** (51,9 dtk) — sama dengan klaim handoff |
| `npx tsc --noEmit` | **0 error** |
| Probe independen mesin harga (`probe-quote-v1393.ts`, scratch) | **31/31 PASS**, termasuk **fuzz 2.000 kasus acak**: jumlah alokasi diskon per item selalu presisi = diskon order, `final_price` ≥ 0, total ≥ Rp1.000 bila subtotal ≥ Rp1.000, duplikat template dibuang |
| Produksi `GET https://makeitbetter.my.id/api/health` | `version: "1.3.90"` → **1.3.93 belum di-deploy** (commit sudah ada di main; bagian handoff "belum di-commit" sudah kedaluwarsa — commit 21:42 WIB 20-Nov) |
| Working tree | bersih kecuali `next-env.d.ts` (auto-generated Next) |

## 2. Yang terbukti AMAN (dicek baris demi baris)

1. **Nominal 100% server.** `checkout/route.ts` dan `admin/orders/route.ts` tidak pernah meneruskan `amount` dari body klien; `createOrder` selalu hitung ulang via `computeQuote` (orderService.ts:963-988).
2. **Mesin harga presisi.** Best-of (seri → bundel, kuota kupon tidak terbakar), clamp Rp1.000, alokasi sisa-terbesar, dedupe templateId, validasi tier (2–10 item, 1–50%, maks 5 tier, duplikat ditolak) — semua lolos probe + fuzz.
3. **Reservasi kupon atomik.** Satu statement `INSERT OR IGNORE ... SELECT ... WHERE COUNT < kuota` (couponService.ts:305-329) — dua checkout bersamaan tidak bisa lolos saat kuota sisa 1 (SQLite single-writer). Reservasi hanya dibuat bila kupon benar-benar menang (orderService.ts:1103).
4. **Owner-only fail-closed.** `requireOwnerMode()` → 404 sebelum auth di `/api/admin/coupons` & `/api/admin/orders`; app `coupons` `ownerOnly: true` di registry; POST kupon = auth + CSRF + audit log.
5. **WIB benar.** `datetime-local` ↔ ISO `+07:00` (CouponsPanel.tsx:72-92); server simpan UTC; perbandingan timestamp benar.
6. **Guard kupon belum diterapkan** memblokir submit (CheckoutForm.tsx:265-271); edit kode membatalkan kupon terapan.
7. **Slug terlindungi.** Order `activated` memblokir slug selamanya (slugService.ts:117-124); reopen punya guard konflik slug (orderService.ts:1779-1797).
8. **`/checkout` di situs klien** sudah 404 (middleware `STOREFRONT_ONLY_PREFIXES` + gate server `isStorefrontDeployment`, checkout/page.tsx:23).
9. **UI kupon aman dari latent bug validator**: panel mengirim `kind` persis 'percent'/'fixed', `isActive` boolean asli, `appliesTo` dari registry (bukan ketikan bebas).
10. **Backfill order-items** dry-run default, idempoten (NOT EXISTS + UPDATE guard `subtotal IS NULL OR = 0`), tidak mengubah `amount`, template tak dikenal dilewati.

## 3. Temuan BARU (di luar daftar §7c handoff)

### F1 — MEDIUM · Jaring bootstrap tidak menutup jalur penjualan utama (human-error deploy)
`bootstrapD1Schema()` hanya dipanggil di **POST /api/billing/checkout** dan **GET/POST /api/admin/coupons** (terverifikasi via grep seluruh `src/`). Tiga jalur lain menyentuh kolom/tabel v1.3.93 **tanpa** bootstrap:
- **GET /api/billing/orders/[orderId]** — SELECT kini ikut `subtotal, discount_total, coupon_code` (route.ts:57). DB lama belum di-bootstrap → "no such column" → **500 untuk SEMUA link order pembeli lama**, sampai ada yang menyentuh checkout/kupon.
- **POST /api/admin/orders action=create** ("Buat Pesanan" — jalur jual utama chat-first; OrdersPanel kini selalu kirim array `templateIds`) → INSERT kolom baru + `order_items` gagal → **500 error SQL mentah**.
- **POST /api/billing/quote** → tabel `coupons` belum ada → semua kupon valid ditolak diam-diam (fail-closed, tapi membingungkan).

Deploy memang tidak memasang skema; handoff mewajibkan `npm run cf:bootstrap` (langkah 3). **Kalau owner lupa langkah itu, jalur penjualan rusak** — persis skenario human-error yang diaudit.
**Usulan fix (3 baris):** tambah `await bootstrapD1Schema()` di ketiga route (pola sama dengan checkout/route.ts:137).

### F2 — MEDIUM · Kebocoran kuota kupon permanen di jalur gagal createOrder
`reserveCouponRedemption` = INSERT lalu SELECT verifikasi. Bila INSERT sukses tapi SELECT gagal (D1 transien), fungsi melempar → catch `createOrder` (orderService.ts:1119-1127) menghapus `order_items` + `orders` **tanpa melepas baris `coupon_redemptions`**. Order hilang → sweeper tidak pernah melepasnya → **slot kuota terpakai selamanya**. Jarang, tapi permanen dan tak terlihat.
**Usulan fix (1 baris):** `await releaseCouponRedemption(orderId)` di cleanup catch (dan di cabang `!reserved` untuk jaga-jaga). Terkait catatan §7c handoff soal `.catch(() => {})` yang bisa menyisakan order pending pengunci slug/nominal 24 jam.

### F3 — MEDIUM · Reopen order bisa 500 — jalan buntu untuk order yang uangnya sudah masuk
`reopenOrder` menjaga konflik **slug** tapi tidak konflik **nominal**. UPDATE `canceled → waiting_verification` (orderService.ts:1799-1807) bisa menabrak `idx_orders_amount_active` bila nominal order sudah dipakai order aktif lain (slot lepas saat cancel). Hasil: UNIQUE constraint dilempar mentah → admin route 500 / webhook Telegram 500 (webhook/route.ts:209, catch luar 244); order tetap `canceled` padahal uang mungkin sudah masuk.
**Usulan fix:** pre-check konflik amount (pola guard slug di 1781-1790) atau tangkap `isUniqueConstraintError(err,'amount')` → pesan ramah "nominal dipakai order lain, hubungi admin untuk verifikasi manual".

### F4 — MEDIUM-LOW · Bootstrap gagal sekali → isolate lumpuh permanen
`schemaPromise` di-memo tanpa reset saat gagal (cloudflareD1.ts:270-406). Error D1 transien saat bootstrap pertama → promise rejected ter-cache → **semua checkout/kupon di isolate itu 500 terus** sampai Cloudflare mendaur ulang isolate. Bandingkan `getAppKvColumns` (baris 52-63) yang sudah punya pola reset "jangan memo hasil gagal".
**Usulan fix:** `.catch` yang mengembalikan `schemaPromise = null` lalu melempar ulang (pola sama, ±4 baris).

### F5 — LOW-MEDIUM · Pembayaran telat tidak me-reserve ulang kupon (akuntansi kuota)
Order expired → kupon dilepas. Pembeli upload bukti telat (`uploadPaymentProof` jalur expired, orderService.ts:1269-1305) → `waiting_verification` → aktivasi late (`activateOrder allowExpired`, 1469-1482): **tidak ada reservasi ulang**. Order lunas ber-kupon tidak terhitung di `redeemed_count` → kuota bisa "terjual" melebihi `max_redemptions` sebanyak order late-payout. `reopenOrder` sudah reserve ulang — jalur late terlewat. Dampak: laporan kuota undercount, bukan uang hilang.

### F6 — LOW · Quote menjanjikan diskon kupon yang kuotanya sudah penuh
`getCouponStatus`/`evaluateCoupon` tidak cek `redeemed_count >= max_redemptions`. Quote menampilkan diskon → checkout menolak `COUPON_EXHAUSTED`. Fail-closed (tidak ada order salah harga), tapi pembeli melihat harga yang tidak bisa ditepati. Usulan: cek kuota di `evaluateCoupon` (1 subquery COUNT).

### F7 — LOW · Jendela crash provisioning: entitlement template tambahan bisa hilang
Grant entitlement hanya `if (siteWasNew)` (scripts/onboarding/server.ts:545-572). Bila provision pertama crash setelah INSERT site tapi sebelum loop entitlement, retry melihat `siteWasNew=false` → template yang sudah dibayar tidak pernah di-grant. `INSERT OR IGNORE` sebenarnya idempoten — grant ulang saat re-provision aman (itu template berbayar, bukan hadiah). Perubahan logika → keputusan owner.

### F8 — LOW · Laten di validator (UI aman, hanya API langsung)
Terverifikasi probe: `kind: 'Fixed'` (kapital) diam-diam jadi **persen** (nilai 50 → kupon 50%, bukan Rp50); `appliesTo` typo lolos validasi → kupon tak pernah berlaku (fail-closed); `Boolean(isActive)` string "false" → true (sudah dicatat handoff). `archiveCoupon` sukses walau ID tak ada (tanpa cek rowcount) — updateCoupon sudah cek. Semua hanya bisa dipicu panggilan API langsung oleh owner, bukan dari panel.

### F9 — LOW · Komentar vs kode resolveBundlePercent
Komentar bilang "tier minItems terbesar yang terpenuhi"; kode mengambil **persen terbesar** di antara tier terpenuhi (checkoutPricing.ts:157-164). Tier terbalik (2→50%, 3→10%) membuat beli 3 dapat 50% — masih dalam cap 50% yang owner set sendiri, bukan uang gratis. Kosmetik.

### Diketahui & sengaja ditunda (bukan regresi, sesuai handoff §7b/7c)
- `/api/billing/*` terbuka di situs klien (keputusan produk owner; order masuk D1 klien tak pernah di-provision).
- `listPurchasedTemplates` ikut `waiting_verification` (klaim "lunas" longgar; praktis tak terjangkau karena guard slug).
- Backfill memakai `amount` (termasuk kode unik) sebagai `list_price` order lama — kosmetik.
- Sumber diskon diputuskan sebelum clamp Rp1.000 — teoretis (probe fuzz membuktikan hasil akhir tetap benar).

## 4. Rekomendasi urutan

1. **Sebelum deploy:** fix F1–F4 (kecil, bertarget, total ±15 baris) — menunggu izin owner.
2. Deploy sesuai handoff §5: commit sudah ada → `npm run deploy` → **`npm run cf:bootstrap` (JANGAN dilewat)** → cek `/api/health` = 1.3.93 → uji asap §6.
3. Setelah deploy: backfill dry-run → `--apply`; putuskan F5–F7 bersama owner.

## 5. File yang disentuh sesi audit ini

- `docs/tracker/logs/audit_checkout_multitemplate_kupon_2026_11_21.md` (dokumen ini)
- `docs/tracker/INDEX_TRACKER.md` (entri baru)
- Probe di scratch: `C:\Users\USER\AppData\Local\hermes\cache\scratch\probe-quote-v1393.ts`.

---

## 6. Realisasi Perbaikan F1–F4 & Polish (2026-11-21 22:05 WIB)

Perbaikan atas instruksi owner ("fix") telah diterapkan dan diverifikasi:

1. **F1 (Bootstrap Guard di Seluruh Jalur Penjualan):**
   - Ditambahkan `await bootstrapD1Schema();` pada `src/app/api/billing/quote/route.ts` (POST).
   - Ditambahkan `await bootstrapD1Schema();` pada `src/app/api/billing/orders/[orderId]/route.ts` (GET).
   - Ditambahkan `await bootstrapD1Schema();` pada `src/app/api/admin/orders/route.ts` (GET & POST).
2. **F2 (Pelepasan Kuota Kupon pada Gagal `createOrder`):**
   - Ditambahkan `await releaseCouponRedemption(orderId).catch(() => {});` baik di cabang `!reserved` maupun di blok `catch` pembersihan `createOrder` (`src/lib/services/orderService.ts`).
3. **F3 (Guard Tabrakan Nominal pada `reopenOrder`):**
   - Ditambahkan query check tabrakan amount aktif sebelum `UPDATE orders SET status = 'waiting_verification'`.
   - Dilindungi dengan try/catch `UNIQUE constraint` error handler agar memberikan pesan error user-friendly tanpa throw HTTP 500 mentah.
   - Ditambahkan unit test verifikasi penolakan reopen bila nominal dipakai order lain (`orderService.test.ts`).
4. **F4 (Reset Cache Promise Bootstrap saat Gagal):**
   - Ditambahkan `.catch((err) => { schemaPromise = null; throw err; })` pada `bootstrapD1Schema` (`src/lib/cloudflareD1.ts`).
5. **Pembersihan Tambahan (Polish):**
   - Mock `@/lib/cloudflareD1` di `src/lib/services/orderService.test.ts` dilengkapi dengan `getD1Value`, `setD1Value`, dll. sehingga peringatan console mock hilang 100%.
   - Helper `wibInputToIso` di `src/app/admin/desktop/panels/CouponsPanel.tsx` diperkuat untuk menangani string input dengan/tanpa detik maupun timezone.

**Hasil Verifikasi:**
- `npx vitest run`: **158 file / 1.378 test PASS** (100% lulus).
- `npx tsc --noEmit`: **0 error**.
