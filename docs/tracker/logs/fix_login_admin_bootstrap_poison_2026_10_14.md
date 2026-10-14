# Fix: Login Admin 500 Intermiten — Bootstrap Skema D1 Tidak Lagi Mengunci Isolate (v1.3.42)

**Tanggal:** 2026-10-14
**Pemicu:** Owner melaporkan `/admin/login` membalas "⚠️ Backend Error: Masalah koneksi database (Internal Server Error)" di `https://makeitbetter.my.id` tepat setelah deploy v1.3.41.
**Status:** ✅ Selesai, terverifikasi, live (lihat bagian Akhir).

## Gejala

- `POST /api/auth/login` → **500** `{"error":"Gagal memproses login"}`, berulang-ulang.
- `GET /api/health` → **200** `database: connected` (D1, 143 ms) — kontradiksi yang membuat diagnosis awal meleset.
- Halaman login memanggil **`/api/auth/login`** (jalur customer auth), **bukan** `/api/admin/login`.

## Jejak Diagnosis (termasuk 3 jalur sesat yang dikoreksi)

1. **D1 REST dari mesin lokal sehat.** Query `sqlite_master`, `SELECT COUNT(*) FROM site_users`, `CREATE TABLE IF NOT EXISTS` (no-op) — semua sukses dengan `CLOUDFLARE_D1_API_TOKEN` dari `.env.local`. Tabel `site_users` ada, berisi 1 admin (`site_id = default-site`, algoritma **scrypt**).
2. **Secret worker lengkap** (`wrangler secret list`): `CLOUDFLARE_D1_API_TOKEN`, `JWT_SECRET`, `ADMIN_PASSWORD_SCRYPT`, dll.
3. **`node:crypto` bukan penyebabnya.** Docs Cloudflare (diakses 2026-10-14): "All `node:crypto` APIs are fully supported" (kecuali argon2/ed448/x448/DSA-DH); `wrangler.jsonc` memakai `compatibility_flags: ["nodejs_compat"]` (compat date 2026-06-28). `scryptSync` sah di workerd.
4. **Jalur login IDENTIK dijalankan dari Node** (`authenticateUser('default-site', {email, password salah})`) → **sehat**, balas `{"success":false,"error":"Email atau password salah"}` dalam 3.6 dtk. Skema, data, token, dan logika aplikasi **bukan** masalahnya.
5. **Pola waktu yang memecahkan kasus** (3x POST berurutan):

   | # | Hasil | Latensi | Interpretasi |
   |---|---|---|---|
   | 1 | 500 | **8.451 ms** | bootstrap 19 statement jalan lalu gagal |
   | 2 | 500 | **527 ms** | `schemaPromise` sudah rejected → langsung rethrow, tanpa mencoba |
   | 3 | 500 | **664 ms** | sama |

   Ini tanda klasik **poisoned promise**: `bootstrapD1Schema()` menyimpan satu Promise di level modul; kalau ia reject, semua request berikutnya di isolate itu **selamanya** menolak sampai isolate didaur ulang.
6. **Tulisan worker ke D1 tetap berfungsi** (`app_kv` terakhir ditulis `2026-10-14T17:33:44Z`, `site_users.last_login_at = 2026-10-08 18:38:24` = login terakhir sukses). Jadi token & izin baca-tulis sehat.

**Koreksi atas dua temuan awal yang keliru (dicatat agar tidak diulang):**
- "Tabel `rate_limits` kosong → tulisan worker gagal" — **salah ukur**. Kolom `updated_at` tidak ada di tabel itu (skemanya `key/count/window_start`) sehingga query-nya melempar dan terbaca sebagai kosong. Lebih jauh lagi: `dataRateLimit` **tidak memakai tabel itu sama sekali** — ia memakai `db.ref('rateLimits')`.
- "Bootstrap gagal di statement pertama" — **tidak cocok dengan bukti**: kegagalan terjadi setelah ~8,4 dtk (≈19 query × ~440 ms), bukan ~400 ms.

## Akar Masalah (3 lapis, saling mengunci)

1. **Bootstrap skema dijalankan pada setiap isolate dingin** — 19 query REST D1 berurutan (`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX`) untuk database produksi yang skemanya **sudah lengkap**. Makan 4–8 dtk tiap login dari isolate baru, dan membuka peluang gagal sesaat (burst limit D1/API).
2. **Satu kegagalan sesaat dijadikan keputusan final** — `schemaPromise` tidak pernah di-reset saat reject, sehingga mengunci seluruh isolate: semua login berikutnya langsung 500 tanpa mencoba.
3. **`catch {}` di route login tidak mencatat apa pun** — kegagalan tidak meninggalkan jejak di log worker (`wrangler tail` menunjukkan `"exceptions": [], "logs": []`, `outcome: ok`), sehingga penyebab sesungguhnya harus direkonstruksi manual.

## Perubahan Kode (2 file, tanpa perubahan perilaku yang diminta)

| File | Perubahan |
|---|---|
| `src/crud/shared/db/connection.ts` | Per statement dalam `bootstrapD1Schema()` dibungkus `try/catch` → gagal sesaat dicatat (`console.error '[D1] bootstrapD1Schema: statement dilewati ->'`) dan **dilanjutkan**. Promise tidak pernah lagi reject, jadi isolate tidak bisa terkunci. Kegagalan skema yang nyata tetap terlihat: query berikutnya melempar error SQL `no such table` yang jelas. |
| `src/app/api/auth/login/route.ts` | `catch {}` → `catch (error)` + `console.error('[Auth] /api/auth/login gagal:', error)`. |
| `src/lib/constants.ts` | `APP_VERSION` `1.3.41` → **`1.3.42`** (hotfix). |

**Mengapa tidak menghapus bootstrap dari login:** di luar cakupan yang diizinkan owner (perbaikan 2 file) dan menyentuh perilaku bersama (`createSite`, `getSiteById`, `seedDeployment`, `settings/site`, `changePassword`). Catatan untuk AI berikutnya: bootstrap 19 statement per isolate dingin tetap membebani login ~4–8 dtk — kandidat optimasi lanjutan, bukan bagian dari hotfix ini.

## Temuan Terkait yang BELUM Dikerjakan (butuh izin owner)

- **`src/lib/cloudflareD1.ts:173` memakai pola `schemaPromise` yang sama** (poisoning-on-reject). Bedanya: hanya ±3 statement (murah), jadi risikonya jauh kecil. Kandidat penerapan pola best-effort yang sama.
- Worker **tidak punya D1 binding** — seluruh akses D1 lewat REST API + token. Konsekuensi: tiap query = 1 HTTP round trip (biaya latensi), dan bootstrap 19 query menjadi mahal.

## Verifikasi

- `npx tsc --noEmit` → **0 error**; `npm run lint` → **bersih**; `npm test` → **133 file / 1.069 test PASS** (identik baseline pasca-merge v1.3.41, nol test patah).
- Diff kecil & terisolasi: 2 file kode + 1 konstanta versi.

## Akhir (LIVE)

- Deploy `npm run deploy` → **Version ID dicatat di baris git commit + `/api/health`**.
- Smoke live: `/api/health` = **1.3.42** + `database: connected`; `POST /api/auth/login` (password salah) diulang beberapa kali → **401 konsisten, nol 500**.
- Owner diminta mencoba login sungguhan dari browser (incognito) sebagai verifikasi akhir.

## Handoff untuk AI Selanjutnya

- Kalau login 500 muncul lagi, **baca log worker dulu** (`npx wrangler tail`) — sejak v1.3.42 error-nya sudah dicatat dengan prefix `[Auth]` / `[D1]`. Jangan ulangi pelacakan manual dari nol.
- Jangan pernah mengembalikan `bootstrapD1Schema()` ke bentuk "reject mengunci isolate".
- `.env.local` di salinan utama berisi kredensial Cloudflare nyata (git-ignored). Jangan commit.
- Kredensial admin sempat terekspos lewat screenshot owner di sesi ini → owner sudah diingatkan untuk mengganti password.
