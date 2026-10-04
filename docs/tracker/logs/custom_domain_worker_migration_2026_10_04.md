# Log: Custom Domain Klien Dimigrasi dari Cloudflare Pages ke Worker (v1.3.21)

**Tanggal:** 2026-10-04
**Status:** 🟢 Selesai — gerbang hijau: test target **9/9**, `npm test` **116 file / 896 test PASS**, `tsc --noEmit` **0 error** (utama + ter-target 4 file scripts), `eslint src` **0**, `release:audit` **59/59**, `release:sale-readiness` **12/12**; **uji nyata akun Cloudflare SUNGGUHAN LULUS** (attach → HTTP 200 → detach bersih, lihat bagian 5)
**Trigger:** Owner menjawab **"ya perbaiki"** atas pertanyaan sesi sebelumnya (perbaiki sekarang vs tunda sampai klien pertama). Gap ini tercatat sebagai gap #1 di `patch_celah_env_klien_2026_10_04.md`.

---

## 1. Masalah

Sejak v1.3.20, situs klien dideploy sebagai **Worker** (`wrangler deploy --config .open-next/wrangler.client.<slug>.jsonc`), tetapi fitur pemasangan custom domain masih memakai jalur lama **Cloudflare Pages**:

- Portal: `POST /accounts/{id}/pages/projects/{slug}/domains` (API Pages) + instruksi **CNAME manual** ke `<slug>.pages.dev`.
- CLI `cloud-manager.ts`: pola yang sama (`cnameTarget = ${slug}.pages.dev`).
- UI portal (`index.html`): kotak hasil menampilkan "Type CNAME | Host | Target" + pesan WhatsApp berisi langkah DNS manual.

Hasilnya: fitur ini **tidak akan bekerja** untuk deployment Worker (project Pages `<slug>` tidak ada), dan target `pages.dev` sudah bukan alamat klien.

## 2. Solusi (API resmi Cloudflare)

Diverifikasi dari dokumentasi Cloudflare (dicek 2026-10-04):

- Dokumen Custom Domains: `https://developers.cloudflare.com/workers/configuration/routing/custom-domains/`
- API: **`PUT /accounts/{account_id}/workers/domains`** — "Attach Worker Domain", izin **Workers Scripts Write**, body `{hostname, service}` (`zone_id`/`zone_name` **opsional**).
- Cloudflare membuat **DNS record + sertifikat HTTPS otomatis** → instruksi CNAME manual untuk klien **dihapus**.
- Prasyarat: zona/domain harus berada di **akun Cloudflare yang sama** dengan Worker klien; hostname belum boleh punya CNAME lama.
- Konfirmasi perilaku body: kode sumber wrangler yang terpasang (`node_modules/wrangler/wrangler-dist/cli.js`) memanggil endpoint yang sama tanpa memaksa `zone_id` (field zona dilewatkan bila tidak dispesifikasi) → kita ikuti pola `{hostname, service}`.

## 3. Perubahan Kode

| File                                       | Perubahan                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| `scripts/onboarding/custom-domain.ts`      | **BARU** — modul murni (terima `cfApi` sebagai argumen → bisa diuji tanpa jaringan): `normalizeDomain`, `zoneNameOf` (heuristik zona dengan dukungan `co.id`/`co.uk`), `attachWorkerDomain` (PUT + pesan galat Indonesia berisi pesan API + petunjuk NS/CNAME), `findWorkerDomain` (GET list → filter hostname; gagal = `null`, tidak melempar), `buildDomainHandoverMessage` (template WhatsApp tanpa CNAME). |
| `scripts/onboarding/server.ts`             | `POST /api/custom-domain` → `attachWorkerDomain(...)` (blok API Pages dihapus; respons kini `status/zoneName/service/whatsappMessage`); `POST /api/custom-domain/status` → `findWorkerDomain(...)`; surat serah terima `pages.dev` → `workers.dev`.                                                                                                                                                            |
| `scripts/onboarding/cloud-manager.ts`      | Aksi `domain` → `attachWorkerDomain` + `buildDomainHandoverMessage`; keluaran konsol & ringkasan GitHub tidak lagi menampilkan Host/Target CNAME (menampilkan Zone + catatan "DNS dibuat otomatis").                                                                                                                                                                                                           |
| `scripts/onboarding/public/index.html`     | Kotak hasil diganti: "Tidak perlu atur DNS apa pun" + baris `Domain                                                                                                                                                                                                                                                                                                                                            | Zone | Status`(id`res-domain-\*`); pesan WhatsApp memakai `data.whatsappMessage` dari server (fallback lokal tanpa CNAME). |
| `scripts/onboarding/custom-domain.test.ts` | **BARU** — 9 test: normalisasi domain, heuristik zona, panggilan PUT (URL + body persis), galat API → pesan berbahasa Indonesia, jatuh zona lokal, list ditemukan/tidak/gagal, isi pesan WhatsApp (ada domain+https, **tidak ada CNAME**).                                                                                                                                                                     |

## 4. Dokumentasi

- `docs/operations/BENGKEL_HANDOFF.md` — izin API token klien: **"D1, Pages, dan R2" → "D1, R2, dan Workers (Edit)"** (+ catatan Pages tak dipakai lagi).
- `panduan/PANDUAN_UNTUK_KAMU_OWNER.md` §7 — langkah CNAME dihapus; dijelaskan DNS otomatis + syarat nameserver ke akun CF klien.
- `CHANGELOG.md` — entri `[1.3.21]`.
- Gap #1 di `patch_celah_env_klien_2026_10_04.md` ditandai sudah diperbaiki (teks lama tidak dihapus, hanya ditambah catatan).

## 5. Hasil Uji Nyata (2026-10-04, akun Cloudflare owner)

Skrip `scripts/onboarding/uji-custom-domain.ts` (BARU, alat verifikasi ulang untuk klien berikutnya) dijalankan terhadap akun Cloudflare sungguhan dengan API Token milik owner (disimpan di `arsip-klien/uji-domain/token.txt`, gitignored):

```
[uji] Token diterima API Cloudflare. ✅
[uji] Attach sukses: uji.makeitbetter.my.id → Worker "portfolio-os-template" (zone makeitbetter.my.id) [1151ms]
[uji] SITUS TERBUKA ✅ (HTTP 200 via 104.21.32.101) pada percobaan ke-2 — total 13s
[uji] Record DILEPAS, akun kembali bersih ✅
[uji] KESIMPULAN: attach → situs terbuka → detach, SEMUA SUKSES ✅
```

- Verifikasi independen sesudahnya: DoH publik (`dns.google`) untuk A & AAAA `uji.makeitbetter.my.id` → **Status 3 (NXDOMAIN)** = record benar-benar lepas.
- Catatan teknis saat uji: (a) **DNS lokal (router) menyimpan cache NXDOMAIN ~30 menit** sehingga verifikasi awal lewat `fetch` gagal palsu — skrip diubah memakai IP dari DoH publik + `curl --resolve` (validasi TLS tetap penuh terhadap hostname); (b) bug skrip `DELETE` membalas **204 tanpa body** → `res.json()` melempar `Unexpected end of JSON input` — helper `cfApi` skrip kini meng-parse body kosong dengan aman.

## 6. Sisa / Lanjutan

- Izin token: uji memakai token owner (Workers Scripts Write + DNS Write/Read + beberapa tambahan pilihan owner) — **izin minimal persis belum diuji**; kalau ada penolakan API soal DNS, tambah izin Zone → DNS → Edit.
- **Uji end-to-end deploy klien pertama** (akun CF milik klien) masih menunggu klien pertama — termasuk membuktikan zona domain klien yang berbeda akun bisa attach.
- Portal tidak punya tombol **lepas/detach** domain (`DELETE /accounts/{id}/workers/domains/{id}` baru dipakai skrip uji) — tambahkan hanya kalau ada kebutuhan nyata.
