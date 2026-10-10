# Deploy Owner v1.3.30 — Rintangan workerd `TEMP` + Gap Izin KV Token (2026-10-10)

**Status:** ✅ Selesai — produksi `makeitbetter.my.id` kini **v1.3.30** (Owner Mode aktif).
**Perintah owner:** "lakukan npm run deploy".
**Pola insiden:** dua kegagalan berturut-turut di fase deploy `opennextjs-cloudflare deploy`, lalu sukses lewat jalur resmi `wrangler deploy` yang sama persis dengan yang dijalankan adapter OpenNext.

---

## 1. Hasil akhir (terverifikasi langsung)

| Pemeriksaan | Hasil |
|---|---|
| `GET /api/health` | `version: "1.3.30"`, `database: connected` (D1 latency 144–256 ms) |
| `GET /api/admin/pricing` (tanpa login) | **401** — bukan 404 = `requireOwnerMode()` lolos → `OWNER_MODE` **true di runtime** |
| `GET /api/admin/orders` (tanpa login) | **401** — sama |
| `GET /`, `/syarat-ketentuan`, `/kebijakan-privasi` | **200** (landing "Rp 199.000 — Pesan Sekarang" tampil benar) |
| `GET /api/about`, `/api/projects` | **200** isi lengkap |
| Stabilitas pasca-deploy | **40/40 fetch berturut-turut = 200**; `wrangler tail` nol exception |
| Browser nyata (tab harness) | Halaman termuat penuh, judul "Portfolio OS - Creative Portfolio" |
| Deploy Cloudflare | Version ID `e166f5a9-3f41-4e8e-8d71-616a133d6bb8`, 15 file baru (914 sudah ada), binding KV×2 + R2 + service + ASSETS + cron `0 18 * * *` |

**Catatan transien jujur:** ± 10 menit pertama pasca-deploy ada 503 sesekali di halaman HTML (1 dari ±6 fetch; API tetap 200). Pola = cold-start/stabilisasi instance baru + cache ISR kosong (populasi cache dilewati, lihat §3). Pulih sendiri; sejak menit ke-±12: 40/40 + tail bersih + webfetch 200.

---

## 2. Rintangan #1 — workerd `CreateDirectory #5` (insiden lama, solusi lama dipakai ulang)

`npm run deploy` gagal 2× di fase deploy dengan crash identik insiden rilis v1.3.27:

```
kj/filesystem-disk-win32.c++:773: failed: CreateDirectory: #5 Access is denied.; path = miniflare-email-store
MiniflareCoreError [ERR_RUNTIME_FAILURE]: The Workers runtime failed to start.
```

Fakta isolasi (sesuai log lama `hapus_tenant_v1_3_27_2026_10_08.md`, diverifikasi ulang hari ini):

- Penyebab pemanggilan = `getEnvFromPlatformProxy()` di `deploy.js` — **hanya membaca variabel string**, tapi tetap menyalakan Miniflare/workerd.
- `workerd.exe` (95 MB, `@cloudflare/workerd-windows-64` 1.20260923.1) **tidak bisa membuat directory di `AppData\Local` mana pun** tetapi **bisa di dalam repo**. Akar pasti tidak teridentifikasi (CFA=0, tanpa AV lain, tanpa event Defender, ACL Temp normal, mitigasi proses nihil). Bukan regresi versi (binary sama sejak v1.3.7).
- **Solusi terverifikasi ulang:** redirect `TEMP`/`TMP`/`TMPDIR` ke folder dalam repo hanya saat deploy:
  ```powershell
  $env:TEMP = "$PWD\tmp\deploy-temp"; $env:TMP = $env:TEMP; $env:TMPDIR = $env:TEMP
  ```
  Dengan ini fase `getPlatformProxy` **lulus** (bukti: kegagalan berikutnya pindah ke tahap berbeda).

Repro minimal tersimpan (gitignored): `scratch/repro-proxy.mjs`.

---

## 3. Rintangan #2 (BARU) — `populateCache` gagal: token tanpa izin KV

Setelah rintangan #1 dilewati, `opennextjs-cloudflare deploy` gagal di `populateKVIncrementalCache`:

```
POST /accounts/<id>/storage/kv/namespaces/<NEXT_INC_CACHE_KV>/bulk → Authentication error [code: 10000]
```

**Diagnosis (terverifikasi via API langsung, tanpa mencetak nilai token):**

- `user/tokens/verify` → **active** (nilai token utuh, 53 karakter, cocok dengan `.env.local`).
- `GET .../storage/kv/namespaces` (list, baca saja) → **401**.
- Sesuai audit `audit_alur_bisnis_logika_2026_10_08.md`: token `portfolio-template-provision` dibuat dengan **3 izin saja** — D1 Edit, Workers R2 Storage Edit, Workers Scripts Edit. **`Workers KV Storage` tidak pernah ditambahkan.** Insiden v1.3.27 (8 Okt) masih memakai token LAMA (yang punya KV) sehingga lolos; sejak pembersihan token, **belum ada** `npm run deploy` penuh sampai hari ini.

**Jalur yang dipakai untuk menyelesaikan deploy hari ini (tanpa mengubah kode & tanpa patch node_modules):** menjalankan perintah yang *persis* dijalankan adapter OpenNext setelah populate-cache, yaitu:

```powershell
$env:OPEN_NEXT_DEPLOY = 'true'; npx wrangler deploy
```

Setara dengan `runWrangler(deploy.js)` — bedanya hanya **populasi KV cache dilewati**. Aman karena: cache ISR/runtime ditulis lewat **binding** worker (bukan API token) → cache terisi sendiri on-demand; skew protection `undefined` (tidak aktif di `open-next.config.ts`) → tanpa `--var` tambahan; pola `npx wrangler deploy` = pola yang sudah lama dipakai `deployClient()` untuk klien dan terbukti.

---

## 4. Insiden kecil yang diamati (tanpa dampak)

± 22:20 WIB terdeteksi rantai `npm run deploy` berjalan yang **bukan** dari sesi ini (kemungkinan dijalankan manual owner di terminal sendiri saat bersamaan). Rantai itu crash di rintangan yang sama (tanpa redirect TEMP) dan mati ± 22:22; produksi tidak berubah (masih 1.3.27 saat diverifikasi 22:23). Tidak ada proses zombie tersisa; lock build `.next/lock` sudah bersih sebelum run final.

---

## 5. ACTION ITEM owner (wajib untuk deploy normal berikutnya)

**Tambahkan izin `Workers KV Storage → Edit` ke token `portfolio-template-provision`:**

1. Dashboard Cloudflare → profil (My Profile) → **API Tokens** → token `portfolio-template-provision` → **Edit**.
2. Tambah permission **Workers KV Storage — Edit** (di samping D1, R2, Workers Scripts yang sudah ada) → Continue → Save.
3. Saat mengedit izin, **nilai token biasanya tidak berubah**. Jika dashboard malah menampilkan token baru, tempel nilai barunya ke `.env.local` key `CLOUDFLARE_D1_API_TOKEN` (lalu jalankan ulang `npx tsx scripts/cloudflare/put-worker-secrets.ts --apply --keys=CLOUDFLARE_D1_API_TOKEN` untuk menyinkronkan Worker secret).

Dengan izin itu, **`npm run deploy` penuh** (termasuk populasi cache) kembali jalan normal seperti masa token lama.

**Opsional (butuh izin owner, belum dikerjakan):** membungkus kebutuhan redirect TEMP ke dalam `scripts/deploy/pre-deploy-check.js`/`cf:deploy` — usulan yang sama sejak log v1.3.27, sengaja tidak dieksekusi sendiri karena menyentuh kebiasaan deploy yang sudah mapan.

---

**UPDATE (2026-10-10, ± 00:11 WIB) — ACTION ITEM SELESAI:** owner menambahkan izin `Workers KV Storage — Edit` via dashboard. Terverifikasi: list KV namespace kini **200 (2 namespace)**, lalu **`npm run deploy` penuh dijalankan ulang dan hijau 100%** — `Successfully populated cache with 62 entries`, `DEPLOY_EXIT=0`, Version ID baru `f6381f44-e407-4a34-9767-7a5cea5bbda1`. Pasca-deploy: `/api/health` = **1.3.30** + connected, homepage **8/8 200**, `/syarat-ketentuan` & `/kebijakan-privasi` 200, `/api/admin/pricing` & `/api/admin/orders` tetap **401** (Owner Mode aktif). Jalur normal `npm run deploy` kembali utuh; satu-satunya syarat berikutnya tetap redirect `TEMP`/`TMP`/`TMPDIR` (rintangan #2 workerd, akar belum teridentifikasi).

## 6. File/jejak

- Tidak ada perubahan kode template sama sekali hari ini (repo bersih sebelum & sesudah; satu-satunya artefak = `.open-next`/`tmp` yang di-gitignore).
- Log mentah (gitignored): `tmp/deploy-v1330-final.log`, `tmp/deploy-v1330-final2.log`, `tmp/wrangler-direct-deploy.log`, `tmp/tail-live.log`.
- Repro (gitignored): `scratch/repro-proxy.mjs`.
