# Log #170 — Hero Baru: Koridor Majalah WebGL (Magazine Flip) — Pengganti 3 Iframe Live (v1.3.47)

**Tanggal:** 2026-10-19
**Versi:** 1.3.47
**Status:** 🟢 Selesai & LIVE (verifikasi produksi di bagian Akhir)
**Permintaan owner:** *"efek iframe live web… aku tidak suka yang sekarang"* → setelah opsi dibahas (poster+lazy, single spotlight, deck, marquee), owner memilih komponen **"Magazine Flip"** dari Originkit (originkit.dev).

---

## 1. Asal-usul kode (provenance — WAJIB dipertahankan)

- Originkit = shadcn-style CLI (npm `originkit`, lisensi **MIT**, landerstudio, v0.2.x, rilis Jul 2026 — terverifikasi di registry npm).
- **Tidak ada CLI/registry/API key yang dipakai.** Kode sumber lengkap komponen disertakan di dalam prompt AI mereka ("copy this prompt"), dan owner menempelkannya ke chat → kode disalin mentah ke `MagazineShowcase.tsx`, lalu diaudit & disesuaikan.
- Key `cmp_live_...` yang pernah muncul **bukan milik owner** dan TIDAK dipakai (owner sudah konfirmasi).
- **Atribusi MIT** dicatat di kepala file komponen — jangan dihapus.

## 2. Audit kode sebelum integrasi (temuan)

| Temuan | Kesimpulan |
|---|---|
| Dependensi `three` | **Sudah ada** di `package.json` (`^0.186.0`) → **nol dependensi baru** |
| Tailwind | Tidak dipakai (style inline murni) → aman untuk proyek Tailwind v3 ini |
| React 19 / compiler | Kompibel; perlu 3 penyesuaian pola (lihat §3) |
| Gambar bawaan | Foto Unsplash contoh → diganti tangkapan layar 3 demo |
| Touch | `touchAction: 'pan-y'` bawaan → gulir halaman ponsel TIDAK tertelan |
| Gambar gagal muat | Digambar ulang sebagai kartu bernomor (rute aman bawaan) |
| CORS atlas | Tangkapan layar same-origin → aman; gagal → `paint(false)` placeholder |

## 3. Penyesuaian atas kode asli (6, semua dicatat di header file)

1. **CELL_MAX 512 → 1024** — ketajaman atlas saat lembaran di-zoom (sumber tangkapan layar ±800px).
2. **`images` wajib**, tanpa default Unsplash; field `screenshot` ditambahkan ke `TemplateItem`.
3. **`onSheetActivate(index)`** dipanggil saat animasi terangkat *tuntas* (fired-once per fokus, di-reset di `clearFocus`) → `LandingPage` membuka `TemplateDetailModal` (**iframe LIVE interaktif — permintaan v1.3.41 tetap di popup**). `view.speed` 5 → 8 (angkat ±0,56 dtk sebelum popup).
4. **`prefers-reduced-motion` / gagal WebGL** → grid kartu statis yang tetap bisa diklik (probe di effect, pola disable scope sama dengan `Dock.tsx` isClientHydrated — aturan repo melarang setState sinkron tanpa keterangan).
5. **Latar transparan** (`setClearColor(alpha 0)` + default `background: 'transparent'`) — koridor mengambang di atas split off-white/biru hero, bukan kotak hitam.
6. **Nav keyboard sr-only** (3 tombol) — tanpa mouse template tetap bisa dibuka (paritas a11y dengan tombol kartu LiveStage lama).

Pelarangan React Compiler yang dipatuhi: **tanpa ref-ditulis-saat-render** (`activateRef`/`imagesRef` disinkronkan di effect; config dibangun via `makeConfig()` di dalam effect).

## 4. Aset tangkapan layar (dari produksi, bukan dummy)

Diambil dengan browser tool dari halaman demo live owner sendiri, disimpan ke `public/landing/`:

| File | Sumber | Ukuran |
|---|---|---|
| `os-desktop.webp` | `/preview/os-desktop` (layar Finder setelah entrance) | 47,9 KB |
| `infinite-canvas.webp` | `/preview/infinite-canvas` (zoom 45%, 2 kartu) | 21,2 KB |
| `spatial-gallery.webp` | `/preview/spatial-gallery` (setelah "Loading 100%") | 32,9 KB |
| **Total** | | **±102 KB** (vs **±4,7 MB** 3 iframe live) |

Catatan kualitas: tangkapan beresolusi viewport browser (800×886) → cukup untuk sel atlas 1024 dengan cover-fit.

## 5. Bersih-bersih (yang dihapus)

- `src/components/landing/LiveStage.tsx` (±142 baris — kartu float/parallax/FLIP-spring, pengukur `--fit`, 3 iframe) — riwayat git = cadangan.
- CSS `.live-stage`/`.stage-*`/`@keyframes stageBob|stagePulse` di `landing.css` (±170 baris) → blok komentar + `.mag-stage` ringkas.
- Aturan `.stage-*` di media `prefers-reduced-motion` → disederhanakan (keputusan fallback kini di JS).
- Test `live-stage.test.tsx` (5 test guardrail 3-iframe) → digantikan `magazine-showcase.test.tsx` (5 test).
- State `activeIndex` + `onActiveChange` di `LandingPage` (konsep "kartu tengah" tidak berlaku untuk koridor).

## 6. Arsitektur interaksi (baru)

```
scroll/drag → koridor lembaran berjalan (drift + wheel + drag, tanpa menelan scroll halaman)
ketuk lembaran → pick GPU (render-to-target) → lembaran terangkat (power2InOut, ±0,56 dtk)
              → onFocusSettle(index) → setSelectedTemplate(TEMPLATE[i]) → TemplateDetailModal
ESC / ketuk lagi → lembaran kembali ke koridor
```

- Fallback statis dirender HANYA jika: matchMedia reduced-motion ATAU konstruktor `MagazineScene` melempar (WebGL mati) — dua jalur ini yang dikunci test.
- Nav sr-only selalu ikut dirender di kedua jalur.

## 7. Uji & gerbang

- **Test baru:** 5 test `__tests__/magazine-showcase.test.tsx` (kartu fallback 3× berlabel, klik → `onSheetActivate(i)`, nav keyboard, reduced-motion → fallback, `src` gambar benar).
- **Suite penuh:** `npm test` → **138 file / 1.110 test PASS** (netral: −5 LiveStage, +5 MagazineShowcase).
- `npx tsc --noEmit` → **0 error**; `npm run lint` → **bersih** (tanpa warning baru).
- Test landing tertarget: 9/9 (magazine-showcase 5 + template-detail-modal 4).

## 8. File yang dimodifikasi

| Aksi | File |
|---|---|
| BARU | `src/components/landing/MagazineShowcase.tsx` |
| BARU | `src/components/landing/__tests__/magazine-showcase.test.tsx` |
| BARU | `public/landing/{os-desktop,infinite-canvas,spatial-gallery}.webp` |
| UBH | `src/components/landing/LandingPage.tsx` (LiveStage → MagazineShowcase) |
| UBH | `src/components/landing/templates.ts` (+field `screenshot`) |
| UBH | `src/components/landing/landing.css` (blok stage lama → `.mag-stage`) |
| UBH | `src/lib/constants.ts` (1.3.47), `CHANGELOG.md`, dokumen ini |
| HAPUS | `src/components/landing/LiveStage.tsx`, `__tests__/live-stage.test.tsx` |

**Tidak disentuh:** `TemplateDetailModal` (live iframe v1.3.41), route API mana pun, `orderService`, data D1/R2.

## 9. Jangan (anti-regresi)

- Jangan mengembalikan `LiveStage`/3 iframe di hero — itu sumber 4,7 MB JS yang dikeluhkan performanya (v1.3.43 mengukurnya).
- Jangan pakai `npx originkit` / API key untuk update komponen — sumbernya sudah di repo & MIT; edit langsung.
- Jangan hapus atribusi MIT di kepala `MagazineShowcase.tsx`.
- Jangan menulis ref saat render (React Compiler error) — pola `makeConfig()` + sync ref di effect.
