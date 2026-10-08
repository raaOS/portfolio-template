# Batch Perbaikan Hasil Audit Reviewer — v1.3.28 (F-01…F-11)

- **Tanggal:** 2026-10-08
- **Rilis:** `1.3.28` (`APP_VERSION` sinkron dengan entri CHANGELOG teratas)
- **Konteks:** Reviewer/auditor menjalankan `prompt-reviewer-agent.md` terhadap rilis `1.3.27` (PK1–PK8) → **PARTIALLY COMPLETE / NEEDS FIX**: semua 4 gerbang hijau (tsc 0, ESLint 0, 123 file/968 test, build exit 0) dan klaim Agent A terbukti jujur, TAPI ada 1 temuan P1 + 10 temuan P2/P3. Owner memberi izin: _"fix semua"_ → seluruh temuan dieksekusi (termasuk keputusan owner untuk F-02/F-03: selaraskan kode ke spesifikasi, bukan sahkan deviasi).

## Daftar temuan & perbaikan

| ID | Sev | Temuan | Perbaikan | File |
|----|-----|--------|-----------|------|
| F-01 | P1 | `SALIN_CADANGAN.bat` hanya salin `backups\`; `arsip-klien\` + `.env.local` tidak pernah ikut | Ketiganya disalin (2 terakhir guarded, pesan jelas bila absen); gagal salin per-aset → RC gabungan ≥8 → exit code gagal | `SALIN_CADANGAN.bat` |
| F-02 | P2 | Guardrail Rp1.000–Rp100.000.000 ≠ spesifikasi Rp50.000–Rp50.000.000 | `MIN_BASE_PRICE=50_000`, `MAX_BASE_PRICE=50_000_000` + test boundary baru; teks UI panel ikut | `pricingConfigService.ts`, `.test.ts`, `admin/harga/page.tsx` |
| F-03 | P2 | Key `pricing_config` ≠ spesifikasi `base_price_idr` | Key baru `base_price_idr`; baca IN-query dengan `ORDER BY` key baru menang; key lama tetap fallback 1 arah (data owner aman); tulis hanya ke key baru | `pricingConfigService.ts`, 2 file test |
| F-04 | P3 | `getBasePrice()` tanpa cache 60 dtk (spesifikasi) | Cache in-memory TTL 60 dtk; `updateBasePrice()` bersihkan cache; error query tidak di-cache; export `clearBasePriceCache()` (dipanggil `beforeEach` test yang terdampak) | `pricingConfigService.ts`, 2 file test |
| F-05 | P3 | Halaman di `/admin/system/harga`, spesifikasi `/admin/harga` | Folder dipindah (`git mv`), import relatif page diperbaiki, registry desktop → `/admin/harga`; guard `AdminAuthGuard` + middleware `/admin` tak berubah | `admin/harga/page.tsx`, `registry.ts` |
| F-06 | P3 | Tidak ada test bukti "order lama tak dihitung ulang saat harga berubah" | Test baru: order A Rp250.000 → ubah harga → order B Rp400.000; assert A tetap Rp250.000, nol `UPDATE` menyentuh `amount`, tulis pakai `base_price_idr` | `orderService.test.ts` |
| F-07 | P3 | Output tanpa subfolder tanggal | `DEST = …\cadangan-flashdisk\<tanggal>` / `<drive>:\cadangan-portfolio\<tanggal>`; tanggal via PowerShell `Get-Date -Format yyyy-MM-dd` (locale-independent), fallback `tanpa-tanggal` | `SALIN_CADANGAN.bat`, `README.txt` |
| F-08 | P3 | `README.txt` tidak menyarankan enkripsi flashdisk | Bagian ENKRIPSI: kompres `7z a -p -mhe=on`, password disimpan terpisah; isi README diperbarui (3 aset, path bertanggal) | `cadangan-flashdisk/README.txt` |
| F-09 | P3 | Checklist serah terima 5 butir, spesifikasi 6 | Ditambah: "Panduan singkat kelola konten dijelaskan ke klien" | `client-deploy.ts` |
| F-10 | P3 | Runbook tak menyebut scope token & cron backup | Prasyarat: **D1 Edit + R2 Edit + Workers Edit** (template *Edit Cloudflare Workers*); gerbang final: cek backup otomatis harian 01:00 WIB → `backup-restore-runbook.md` | `GLADI_RESIK_KLIEN_PERDANA.md` |
| F-11 | P3 | Helper mati `endpointPath()` (tak ada lagi path `{siteSlug}`) | Helper dihapus; `pathName = check.path`; komentar: `--site-slug` hanya label laporan | `synthetic-production-check.js` |

## Test baru

- `pricingConfigService.test.ts` +3: fallback key lama, cache 60 dtk (query sekali), cache bersih setelah update; guardrail diperbarui ke Rp50.000–Rp50.000.000.
- `orderService.test.ts` +1: F-06 immutability nominal order + assert key `base_price_idr`.
- Total: 968 → **972 test** (diverifikasi dari output gerbang).

## Gerbang (dijalankan ulang oleh reviewer setelah batch fix)

- `npx tsc --noEmit` → exit 0
- `npx eslint src` → exit 0
- `npm test` → **123 file / 972 test PASS** (exit 0, 26.27s)
- `npm run build` → exit 0
- Uji jalur nyata `SALIN_CADANGAN.bat` → 4 jalur lulus (guard/segar/inkremental/gagal; detail di atas). `.bat` tidak dicakup 4 gerbang (bukan kode TS), jadi uji langsung ini gerbangnya.

## Uji jalur nyata `SALIN_CADANGAN.bat` (menutup poin UNVERIFIED audit "menjalankan .bat-nya")

Diuji sungguhan lewat `cmd /c` dengan input pipa (4 jalur). Pengujian langsung **menangkap 3 bug** yang tidak terlihat saat review statis — semuanya diperbaiki sebelum commit final:

1. **`robocopy "%~dp0" …` → argumen tercampur.** `%~dp0` berakhir backslash → `\"` di-parse CRT-robocopy sebagai quote literal → `.env.local` **tidak pernah tersalin** (jalur senyap yang justru merusak klaim F-01). Diperbaiki: `"%~dp0."`.
2. **`:gagal` jatuh ke `:selesai` → `exit /b 0`.** Script sukses melaporkan gagal (klaim "exit code gagal" palsu). Diperbaiki: jalur gagal `pause` + `exit /b 1`.
3. **RC robocopy = bit-flag.** Run ke-2 mengembalikan **RC=2** (extras: `arsip-klien` + `.env.local` di tujuan bukan bagian sumber `backups\`) sehingga `if %RC% EQU 0` tak pernah cocok. Diperbaiki: `set /a "RC_KOPI = RC & 1"` (pesan tampil bila bit "file tersalin" tak terpasang).
4. Line-ending `.bat` dipaksa CRLF (working copy sempat LF murni hasil write).

Hasil uji final (semua jalur):

| Jalur | Kondisi | Hasil |
|---|---|---|
| Guard | `backups\` tanpa `d1\`/`r2\` | exit **1**, "Belum ada isi backup" ✅ |
| Segar | folder tanggal baru | exit **0**, `[OK] Selesai`, ketiga aset ada (backups, `arsip-klien\`, `.env.local`) ✅ |
| Inkremental | run ke-2, file identik | exit **0**, "Tidak ada file baru" muncul ✅ |
| Gagal | tujuan berupa file (bukan folder) | exit **1**, "[X] Gagal menyalin. Kode masalah: …" ✅ |

Catatan: `attrib +R` tidak memblokir folder NTFS — kegagalan dipicu dengan membuat FILE bernama folder tujuan. Seluruh artefak uji (dummy `backups\d1\`, folder tanggal) dihapus; tree kembali bersih.

## Yang TIDAK diubah (sengaja)

- Deviasi yang butuh keputusan produk di luar teks spesifikasi tidak ada — owner sudah memilih "selaraskan ke spesifikasi".
- Data historis `pricing_config` tidak dihapus (fallback baca) — tidak ada migrasi destruktif.
- Entri CHANGELOG/INDEX yang sudah terbit (1.3.27 dst.) tetap sebagai catatan rilis historis.

## File yang dimodifikasi

`SALIN_CADANGAN.bat`, `cadangan-flashdisk/README.txt`, `src/lib/constants.ts`, `CHANGELOG.md`, `src/lib/services/pricingConfigService.ts`, `src/lib/services/pricingConfigService.test.ts`, `src/lib/services/orderService.test.ts`, `src/app/admin/harga/page.tsx` (pindah dari `admin/system/harga`), `src/app/admin/desktop/registry.ts`, `scripts/onboarding/client-deploy.ts`, `scripts/monitoring/synthetic-production-check.js`, `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`, `docs/tracker/INDEX_TRACKER.md`, log ini.
