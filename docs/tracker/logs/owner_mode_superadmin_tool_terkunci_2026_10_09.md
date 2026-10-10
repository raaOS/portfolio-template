# Owner Mode (Superadmin): Tool Owner Tidak Terlihat/Terjangkar di Site Klien

**Tanggal:** 2026-10-09
**Versi:** 1.3.30
**Status:** ✅ Selesai & tervalidasi penuh (gerbang: `tsc --noEmit` 0, ESLint 0 error, 128 file / 1012 test PASS, `next build` exit 0, bundle client nol referensi `NEXT_PUBLIC_OWNER_MODE` = ter-inline)

---

## 1. Pertanyaan & Permintaan Owner

> _"kenapa tidak ada role admin? aku jadi ragu-ragu setiap mau membuat fitur baru + ada crud karena takut ke deploy ke customer"_

Lalu setelah penjelasan awal, owner menjawab:

> _"jadi gini emang semua customer ketika beli dia akan jadi admin untuk websitenya. aku mau sistem dan project ini tau kalau aku sebagai superadmin, jadi ada beberapa tool gak ke deploy karena tau ini punya superadmin"_

**Inti permintaan:** sistem harus mengenali deployment mana yang milik owner (superadmin) supaya tool milik owner **tidak tampil & tidak terjangkar** di site klien.

## 2. Fakta yang Diverifikasi di Kode (sebelum menulis apa pun)

1. **Role sistem memang ada tapi cuma satu nilai:** kolom `site_users.role` (default `'admin'`) + guard `requireAdmin()` di `src/crud/shared/auth/guard.ts` — tapi hanya role `admin` klien yang pernah dibuat. **Tidak ada role owner** di dalam aplikasi (grep `'owner'` → 0 hasil). Ini disengaja: owner beroperasi via portal `PENGELOLA_KLIEN.bat`, Wrangler CLI, dan token Cloudflare langsung — tidak pernah login ke site klien (prinsip "tanpa pintu belakang owner di site klien" tetap dipertahankan).
2. **Update ke klien 100% manual** (`handleUpdate()` di `scripts/onboarding/cloud-manager.ts`) — kode baru tidak pernah sampai otomatis ke klien.
3. **Pipeline `deployClient()` sudah fail-closed** untuk env owner: `collectOwnerBlankKeys()` membuang kunci `.env.local` yang tidak terdaftar, `buildClientEnvPlan()` memaksa nilai tertentu (contoh lama: `FEATURE_AI: 'false'` untuk semua klien).
4. **🔴 Temuan nyata — 2 app owner tampil di desktop admin SEMUA klien:**
   - **"Harga Jual"** (`harga`) → `pricingConfigService` (`base_price_idr`, guardrail Rp50.000–50.000.000) = harga jual site milik owner (pola yang sama dipakai `orderService.getBasePrice()`).
   - **"Order & Pembayaran"** (`orders`) → `OrdersPanel` menampilkan `desired_slug`, `buyer_name/email/whatsapp`, `amount`, status `pending_payment → activating → activated` = **sistem pembelian site oleh pembeli owner**, bukan pesanan milik klien.
   - Keduanya terdaftar di zona `system` `src/app/admin/desktop/registry.ts` → ikut ter-deploy & tampil ke semua klien. (Data mentah pembeli tetap aman karena tiap klien punya D1 sendiri yang kosong — tapi **fiturnya** tidak boleh terlihat/terjangkar di site klien, dan route API-nya memang membaca D1 masing-masing.)
   - Tidak ada janji fitur ini ke klien di dokumen (justru dikelola owner; zone terkait "clientDashboard/paymentConfig" pernah dihapus v1.3.20 karena alasan serupa).

## 3. Solusi: Sakelar Identitas Deployment `OWNER_MODE`

Pendekatan: **env flag deployment** (bukan role login di D1 klien) — konsisten dengan prinsip "owner di luar aplikasi klien", nol kredensial owner di database klien, dan memakai jalur fail-closed yang sudah ada.

| Kunci | Dibaca oleh | Nilai owner | Nilai klien |
|---|---|---|---|
| `OWNER_MODE` | route API / server (runtime) | `"true"` | `"false"` (dipaksa) |
| `NEXT_PUBLIC_OWNER_MODE` | bundle client (ter-inline saat build) | `"true"` | `"false"` (dipaksa) |

Kedua kunci **selalu di-set bersamaan**.

## 4. Daftar Perubahan Kode

| # | File | Perubahan |
|---|---|---|
| 1 | `src/lib/ownerMode.ts` | **Baru.** `isOwnerMode()` + `requireOwnerMode()` — guard balas **404** (bukan 403: site klien tidak boleh tahu route ada) sebelum lapisan auth mana pun. |
| 2 | `src/lib/ownerMode.test.ts` | **Baru.** Fail-closed: 404 saat `OWNER_MODE=false`/kosong/tidak diset/`TRUE` (case-sensitive); lolos saat `true`. |
| 3 | `src/app/admin/desktop/types.ts` | `AdminApp` dapat opsi `ownerOnly?: boolean`. |
| 4 | `src/app/admin/desktop/registry.ts` | Array direname `ALL_ADMIN_ZONES`; export `ADMIN_ZONES` = hasil filter: app `ownerOnly` dibuang + zone kosong dibuang saat `NEXT_PUBLIC_OWNER_MODE != 'true'`. App `harga` & `orders` ditandai `ownerOnly: true`. Zona `system` tetap ada untuk klien (AI/Statistik/Log/Backup). |
| 5 | `src/app/api/admin/orders/route.ts` | `requireOwnerMode()` di awal GET & POST. |
| 6 | `src/app/api/admin/pricing/route.ts` | `requireOwnerMode()` di awal GET & PUT (+dokumen JSDoc). |
| 7 | `src/app/api/admin/pricing/route.test.ts` | `vi.stubEnv('OWNER_MODE','true')` semua test jalur normal + describe baru **Owner Mode guard** (404 GET/PUT tanpa menyentuh auth/service; unset → tetap 404). |
| 8 | `src/app/api/admin/orders/route.test.ts` | **Baru.** Test 401 auth, 400 validasi, + **Owner Mode guard** (404 GET/POST tanpa menyentuh auth/service; unset → 404). |
| 9 | `src/app/admin/desktop/registry.test.ts` | **Baru.** Owner lihat `harga`/`orders`; klien tidak (juga saat env tidak diset); zona `system` tetap berisi app klien. Pakai `resetModules` + import dinamis (env dibaca saat module init). |
| 10 | `scripts/onboarding/client-deploy.ts` | `buildClientEnvPlan().overrides` memaksa `OWNER_MODE: 'false'` + `NEXT_PUBLIC_OWNER_MODE: 'false'` — bahkan jika `config.env` klien menuliskan `true` (fail-closed lapis-2; lapis-1 = tidak ada di `INHERITED_OWNER_KEYS` → dibuang dari `next-env.mjs`). |
| 11 | `scripts/onboarding/client-deploy.test.ts` | Describe **buildClientEnvPlan (Owner Mode fail-closed)**: dipaksa `false` meski config.env klien meminta `true`; `false` juga saat tak disebut. |
| 12 | `.env.example` | Bagian "Deployment role": dokumentasi kedua kunci + aturan pasangan + peringatan fail-closed. |
| 13 | `.env.local` (owner) | `OWNER_MODE="true"` + `NEXT_PUBLIC_OWNER_MODE="true"` **ditambahkan** (build site produksi sendiri). |
| 14 | `AGENTS.md` §8 | Sub-bagian **"Owner Mode (Superadmin) — v1.3.30"**: tabel kunci, lapisan fail-closed, cara menambah tool superadmin baru, peringatan operasional. |
| 15 | `CHANGELOG.md` | Entri `[1.3.30]` di baris paling atas. |
| 16 | `src/lib/constants.ts` | `APP_VERSION` `1.3.29` → `1.3.30` (sintest sinkron CHANGELOG). |

## 5. Cara Menambah Tool Superadmin Berikutnya (panduan singkat)

1. Tandai app dengan `ownerOnly: true` di `src/app/admin/desktop/registry.ts`.
2. Pasang `requireOwnerMode()` di awal route API-nya (sebelum auth).
3. Tambah `vi.stubEnv('OWNER_MODE', 'true')` di test route tersebut.
4. Fitur untuk klien **tidak** memakai flag ini.

## 6. Hasil Verifikasi (dijalankan, bukan klaim)

- `npx tsc --noEmit` → exit 0.
- `npx eslint src` → exit 0 error.
- `npx vitest run` → **128 file / 1012 test PASS** (0 gagal; sebelumnya 127/1008 — +1 file registry, +4 test registry; +4 test orders; +3 test guard pricing; +2 test buildClientEnvPlan).
- `npm run build` (`next build`) → exit 0.
- Bundle client (`.next/static/**/*.js`): **0 referensi** ke `NEXT_PUBLIC_OWNER_MODE` → nilai ter-inline saat build (build dengan `.env.local` owner meng-inline `true`; build klien meng-inline `false`).

## 7. Catatan Operasional untuk Owner

- **Site produksi Anda** (`makeitbetter.my.id`) baru mendapat `OWNER_MODE=true` di `.env.local` (build time) — **deploy ulang (`npm run deploy`) diperlukan** supaya kedua panel tetap tampil. Tanpa kunci ini, "Harga Jual" & "Order & Pembayaran" akan **hilang dari admin Anda sendiri** (fail-closed, by design). Jangan hapus kedua kunci dari `.env.local`.
- **Klien yang sudah ada** mendapat perlindungan ini otomatis pada **update template berikutnya** (portal → Update Versi Template) — app kedua panel hilang dari desktop mereka, route API membalas 404.
- Route `billing/*` publik (checkout, proof-upload dsb.) **tidak dikunci** — itu jalur pembeli di site owner; di site klien tabel `orders` mereka kosong sehingga tidak berbahaya. Kalau nanti mau lebih ketat, tinggal tambah `requireOwnerMode()` serupa.

## 8. File yang Dimodifikasi

Lihat tabel §4. Commit & push: lihat `git log` setelah entri ini (branch `main`).

## 9. Penambahan 2026-10-10 — Guard anti-human-error pre-deploy

Pertanyaan owner: _"apa ada kemungkinan celah dibobol atau skenario human error?"_ → audit skenario + verifikasi:

**Terverifikasi aman:**
- `.env.local` / `arsip-klien/` / `.open-next/` **tidak pernah ter-track di git & tak ada di history** (`.gitignore` baris 55/96/3; `git log --all -- .env.local` kosong).
- Guard value rahasia ada di `scripts/release/audit-release-package.js` (pola `*_TOKEN/_SECRET/_KEY/_PASSWORD/_SALT` + daftar eksplisit) untuk paket rilis.
- `config.env` klien yang berisi `OWNER_MODE=true` → dipaksa `false` oleh pipeline (sudah dites).
- Boundary utama data owner = **pemisahan akun Cloudflare per klien** (1 klien 1 akun; D1/R2 owner tak terjangkar dari deployment klien mana pun) — `OWNER_MODE` = lapis kedua.
- Klien yang iseng mengubah env deployment **mereka sendiri** → hanya membuka data D1/R2 **mereka sendiri** (orders mereka kosong).

**Satu celah human-error nyata ditemukan & DIPERBAIKI:**
- `scripts/deploy/pre-deploy-check.js` tidak memeriksa `OWNER_MODE` → skenario: kunci terhapus dari `.env.local` → `npm run deploy` sukses tapi kedua panel hilang diam-diam dari admin owner (fail-closed tanpa peringatan).
- **Fix:** assert baru di pre-deploy-check — `OWNER_MODE === 'true' && NEXT_PUBLIC_OWNER_MODE === 'true'` wajib sebelum deploy site owner. Script ini **hanya** dipanggil `npm run deploy` (verifikasi: build klien `deployClient` → `npm run cf:build` langsung, tidak melewatinya) → aman untuk dikunci tegas.
- **Bukti dijalankan:** run normal → exit 0 ("All Cloudflare pre-deploy checks passed"); simulasi `OWNER_MODE=false` → exit 1 dengan pesan `OWNER_MODE & NEXT_PUBLIC_OWNER_MODE must both be "true" before deploying the owner site…`.

**Sisa risiko yang tersisa (bukan bug, keputusan/kebiasaan owner):**
- `.env.local` berisi semua token → keamanan = keamanan fisik laptop/jangan paste isinya ke chat (rotasi token terbukti bisa, 2026-10-09).
- Secret tertempel ke file sumber biasa (bukan `.env.example`) → tak ada full scanner track-file (guard rilis hanya paket jualan).
- Klien lama **belum** dapat perlindungan sampai owner menjalankan Update Versi Template (proses, bukan kode).
