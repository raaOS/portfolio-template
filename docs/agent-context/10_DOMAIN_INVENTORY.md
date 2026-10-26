# 10. Domain Inventory (Owner) — WAJIB DIBACA SEBELUM MENYENTUH DOMAIN

> **Ringkas:** owner punya **dua domain** yang sengaja dipisah dan namanya hanya beda **satu huruf**.
> Jangan dipindahkan, digabung, diganti nama, atau dihapus tanpa instruksi eksplisit owner.

Terakhir diverifikasi: **2026-10-26** (DNS publik + DNS-over-HTTPS, Cloudflare API, RDAP).

## 1. Tabel domain

| Domain | Huruf pembeda | Peran | Akun Cloudflare | Status |
|---|---|---|---|---|
| `makeitbetter.my.id` | **e** (bett**e**r) | **Domain utama / produksi owner** | akun utama owner (`.env.local` → `CLOUDFLARE_ACCOUNT_ID`) | active, satu-satunya zona di akun itu |
| `makeitbatter.my.id` | **a** (bett**a**r) | **Domain uji** (gladi resik / calon klien) | akun test milik arsip `arsip-klien/01_gladi-2026-10-24/config.env` | active, paket Free |

```
makeitbetter.my.id   ← "e" → situs produksi owner
  └─ (root) https://makeitbetter.my.id        → HTTP 200

makeitbatter.my.id   ← "a" → domain uji (Worker gladi-2026-10-24)
  ├─ (root) https://makeitbatter.my.id        → HTTP 200  ← alamat utama uji
  └─ https://gladi.makeitbatter.my.id         → HTTP 200  ← tetap hidup
```

## 2. Detail `makeitbetter.my.id` (jangan disentuh)

- Situs produksi owner. Satu-satunya zona di akun utama.
- **DILARANG**: mengubah nameserver, memindahkan zona, mengganti nama, atau menghapus.
- Semua pekerjaan yang menyebut "domain utama", "produksi", atau "website owner" merujuk ke domain ini.

## 3. Detail `makeitbatter.my.id` + gladi

| Fakta | Nilai |
|---|---|
| Registrar | PT Registrasi Neva Angkasa |
| Terdaftar | 2026-07-05 |
| Ditambahkan ke Cloudflare | 2026-10-24 19:12 |
| Nameserver | `anderson.ns.cloudflare.com`, `sima.ns.cloudflare.com` |
| Custom domain terpasang | `makeitbatter.my.id` **dan** `gladi.makeitbatter.my.id` → Worker `gladi-2026-10-24` |
| Root domain | **aktif** sejak 2026-10-26 (sebelumnya kosong) |
| Pemakaian lain | tidak ada (`www`, `mail`, `api`, `cdn`, `app`, `admin`, `blog`, `shop`, dll. kosong) |

Catatan di `arsip-klien/01_gladi-2026-10-24/config.env` (semua konsisten dengan alamat root):

```env
WEBSITE_URL="https://makeitbatter.my.id"
ADMIN_URL="https://makeitbatter.my.id/admin"
CUSTOM_DOMAIN="makeitbatter.my.id"
```

- Dua hostname (root + `gladi.`) menunjuk Worker yang sama. Memasang root **tidak** memutus subdomain.
- Portal Status Board menampilkan `makeitbatter.my.id`, dan tombol "Kunjungi" membuka root.
- **Status Board tidak lagi "Offline" palsu (sejak 2026-10-26):** kalau alamat utama gagal di tingkat jaringan (DNS/cache/timeout), pengecekan otomatis mengulang ke `<slug>.<subdomain>.workers.dev` dan menulis label **"· via workers.dev"**. Batas waktu 12 detik. Label itu **bukan error** — Worker hidup, hanya custom domain yang belum bisa dihubungi dari laptop tersebut. Jadi jangan simpulkan domain mati dari status Offline sebelum mencoba jalur workers.dev.

## 4. Larangan eksplisit (pernah salah paham — jangan diulang)

1. **JANGAN** memindahkan zona `makeitbatter.my.id` ke akun utama. Pemisahan akun itu **disengaja**.
2. **JANGAN** menggabungkan, mengganti nama, atau menghapus salah satu domain.
3. **JANGAN** menganggap `makeitbatter` sebagai typo dari `makeitbetter`. Keduanya milik owner dan punya peran berbeda.
4. **JANGAN** memasang root **domain produksi** ke Worker klien/percobaan. Khusus `makeitbatter.my.id` (domain uji), root **memang sengaja** dipasang ke Worker gladi sejak 2026-10-26.
5. **JANGAN** menyimpulkan "domain belum terpasang" hanya dari tulisan `belum ada (...)` di portal. Itu bisa berarti **catatan lokal** (`CUSTOM_DOMAIN`) hilang, sementara domain sudah aktif di Cloudflare.

## 5. Kalau portal menampilkan "belum ada"

Urutan yang benar (kejadian nyata 2026-10-26):

1. Cek Cloudflare dulu, **read-only**, lewat portal:
   `POST /api/custom-domain/status` dengan body `{ "folderName": "...", "customDomain": "..." }`.
2. Kalau balasannya `{"success":true,"status":"active","service":"<slug>"}` → domain **sudah menempel**.
3. Perbaiki cukup dengan menyunting baris `CUSTOM_DOMAIN` (dan `WEBSITE_URL`/`ADMIN_URL` bila perlu) di `arsip-klien/<folder>/config.env`. **Tidak perlu** attach ulang dan **tidak perlu** menyentuh Cloudflare.
4. Kalau balasannya `not_found` → baru pertimbangkan attach lewat menu **[3] Kelola Custom Domain** di portal.

## 6. Izin yang tersedia di repo

| Kredensial | Kemampuan | Bukti |
|---|---|---|
| `.env.local` → `CLOUDFLARE_D1_API_TOKEN` | hanya **baca** zona | `GET /zones` OK, `POST /zones` → **403 Forbidden** |
| `.env.local` → `CLOUDFLARE_API_TOKEN` | **tidak ada** | kunci tidak ada di file |
| `arsip-klien/00_site-owner/config.env` | tidak menyimpan kredensial Cloudflare | nol kunci `CLOUDFLARE*` |
| `arsip-klien/01_gladi-2026-10-24/config.env` → `CLOUDFLARE_API_TOKEN` | **bisa** baca Worker + **attach/detach custom domain**; **tidak bisa** baca/edit DNS record | `PUT /workers/domains` sukses; `GET /zones/<id>/dns_records` → Authentication error |

Konsekuensi: attach/lepas custom domain di akun test **bisa** dari repo; menambah zona baru atau mengubah nameserver **tidak bisa** (harus dashboard owner + panel registrar).

## 7. Custom domain pelanggan asli (bukan domain owner)

- Domain pelanggan berada di **akun Cloudflare pelanggan masing-masing**, bukan akun owner.
- Dipasang lewat portal menu **[3] Kelola Custom Domain**; hostname dipakai **apa adanya** (kode tidak menambah subdomain).
- Prasyarat Cloudflare: zona domain harus **aktif di akun pelanggan** (nameserver sudah diarahkan ke Cloudflare akun itu). Kalau belum, portal menolak dengan pesan jelas.
- Root (`makantahu.com`) dan `www` adalah **dua hostname terpisah**; pasang satu per satu bila keduanya diinginkan. Root diperbolehkan — bukan hanya subdomain.
- Domain pelanggan yang sudah punya website lama akan **tertimpa** oleh situs baru.

## 8. Saat membersihkan gladi resik

- Worker `gladi-2026-10-24`, D1, R2, KV, dan archive boleh dihapus **setelah owner menyetujui**.
- **Zona `makeitbatter.my.id` ada di akun test.** Jangan menghapus/meninggalkan akun test sebelum memutuskan nasib domain uji.
- Kalau Worker gladi dihapus, **kedua** hostname (`makeitbatter.my.id` dan `gladi.makeitbatter.my.id`) ikut mati. Lepas custom domain lebih dulu bila domain uji akan dipakai lagi untuk klien berikutnya.
- Jika akun test dibuang total: domain tetap aman di registrar dan bisa ditambahkan ulang ke akun Cloudflare mana pun (perlu perubahan nameserver).

## 9. Riwayat

- **2026-10-26 (pagi):** AI mengira `makeitbatter.my.id` sisa/typo dan menawarkan memindahkannya ke akun utama. Owner mengoreksi: dua domain sengaja dipisah (produksi vs uji). Tidak ada perubahan Cloudflare saat itu (`POST /zones` gagal 403).
- **2026-10-26 (lanjutan):** owner meminta root domain uji dipakai untuk situs gladi. Root `makeitbatter.my.id` **dipasang** ke Worker `gladi-2026-10-24` (dengan izin owner), diverifikasi **HTTP 200**. Subdomain `gladi.makeitbatter.my.id` tetap hidup. Catatan portal diperbarui ke alamat root.
- **2026-10-26 (malam):** portal sempat menulis **Offline** untuk gladi karena DNS laptop owner masih menyimpan NXDOMAIN untuk root yang baru dipasang (bukan situs mati). Status Board diperbaiki: cadangan otomatis `workers.dev`, batas waktu 8 → 12 detik, label "· via workers.dev". Test 28 PASS, uji hidup di port 4568 OK.

Log lengkap: `docs/tracker/logs/fix_launcher_pengelola_klien_2026_10_26.md`.
