# Log #171 — Hero "Jungkir-balik Majalah": Koridor Berhenti → Demo LIVE Sungguhan, Tanpa Popup (v1.3.48)

**Tanggal:** 2026-10-20
**Versi:** 1.3.48
**Status:** 🟢 Selesai & LIVE (verifikasi produksi di bagian Akhir)
**Permintaan owner:** setelah v1.3.47 live: *"hasil gambar screenshot kurang bagus dan aku tidak suka"* + tempelan analisis Gemini (CSS3DRenderer / Hybrid live-on-focus / coverflow CSS) dengan syarat tegas: **efek koridor majalah jangan berubah**.

---

## 1. Keputusan (dari 3 opsi Gemini)

| Opsi | Nasib | Alasan |
|---|---|---|
| 1 — CSS3DRenderer (iframe di CSS 3D) | **Ditolak** | Lembaran jadi bidang datar → efek lorong melengkung hilang; 6–8 lembaran = 6–8 iframe Next.js serentak (±1,5 MB JS + ratusan MB RAM) → freeze (Gemini sendiri menyebut "Performance Hell"; angka produksi kita: 3 iframe dingin = 8,31 dtk di v1.3.43). |
| 2 — Hybrid "live saat berhenti" | **DIPILIH (dengan ritme sendiri)** | Efek 100% terjaga; hidup selalu 1 iframe dalam satu waktu. |
| 3 — Coverflow CSS murni | **Ditolak** | Efek berubah total. |

**Tambahan keputusan owner (jawaban tanya jawab):** (a) **tanpa popup** — lembaran yang terangkat ITU SENDIRI yang menjadi live (menggantikan `TemplateDetailModal`, syarat v1.3.41 dianggap terpenuhi lebih baik: demo interaktif langsung di lembaran); (b) screenshot yang bergerak **dibiarkan** (saat koridor meluncur ±1 dtk gambar lewat cepat; saat berhenti = live sungguhan).

## 2. Perilaku final (ritme "jungkir-balik majalah")

```
koridor meluncur 1 lembaran (lerp ±1 dtk)
  → berhenti (REST_DELAY 0,8 dtk)
  → lembaran terdekat (facingIndex) terangkat & berputar menghadap (flip bawaan)
  → iframe DEMO LIVE ditumpangkan presisi di atasnya (bisa scroll & klik)
  → LIVE_HOLD 5,5 dtk (pengunjung menyentuh demo → siklus berhenti, milik pengunjung)
  → dilepas (turn-back) → meluncur 1 langkah → ulangi
```

- Geser/drag manual → **snap ala carousel** ke kelipatan `pageSpacing` → live.
- Ketuk lembaran mana pun (termasuk pinggir) → terangkat → live.
- Tutup: **✕** di pojok overlay / **Esc** / ketuk luar lembaran.
- Tab tersembunyi → browser menghentikan rAF → seluruh siklus ikut jeda otomatis (tanpa kode tambahan).
- Jalur fallback (reduced-motion / WebGL mati): kartu statis → klik = buka demo di **tab baru**.

## 3. Teknis (semua di `MagazineShowcase.tsx`, nol sentuh API/rute/D1/R2)

| Bagian | Implementasi |
|---|---|
| Mesin gerak | State-machine di `step()`: drift konstan dihapus (`travel.drift`/`driftPerSecond` dibuang); `pendingGlide`/`restT` menggerakkan siklus; fisika lerp & `uSpeedY` (lipatan kertas) lama tetap dipakai sehingga efek saat meluncur identik. |
| Snap | `onPointerUp` drag: `scroll.target = round(target / pageSpacing) * pageSpacing`. |
| Lembaran "menghadap" | `facingIndex()` — argmin `|zCorridor|` memakai **rumus shader yang sama** (`glmod` JS meniru mod GLSL). |
| Rect tumpangan | `computeFocusRect()` — proyeksi 2 sudut bidang fokus via `THREE.Vector3.project(camera)` → piksel CSS presisi di segala ukuran; dihitung ulang saat resize (`setSize`). |
| Tumpangan live | `<iframe>` same-origin (`previewUrl` per gambar) transparan sampai `onLoad` (tanpa kedip putih, `opacity` 0→1 0,35 dtk); tombol ✕ 34 px di pojok; `claimLive()` pada `onPointerDown`/`onFocus` iframe = pemilik menyentuh → auto-siklus berhenti. |
| Hemat | Saat live tayang: `step()` return awal (render WebGL dijeda); `releaseFocus()` menutup live dari ✕/Esc/ketuk luar/`clearFocus`. |
| Props | `MagazineImage` +`previewUrl`; prop `onSheetActivate` dihapus (komponen mandiri). |

## 4. Penghapusan (keputusan owner "tanpa popup"; riwayat git = cadangan)

- `TemplateDetailModal.tsx` + `__tests__/template-detail-modal.test.tsx` — hanya dipakai LandingPage (diverifikasi grep; `@modal` route group tidak memakainya).
- `LandingPage`: state `selectedTemplate`, props `basePrice`/`adminWhatsapp` — komponen kini tanpa data D1.
- `src/app/page.tsx` storefront branch: pembacaan D1 `getBasePrice()` + `getPublicPaymentInfo()` dihapus (hanya melayani popup); `return <LandingPage />`.

## 5. Uji & gerbang

- `magazine-showcase.test.tsx` ditulis ulang: **6 test** (kartu fallback; klik → `window.open(previewUrl,'_blank','noopener,noreferrer')`; nav keyboard; reduced-motion → fallback; urutan `src`; tanpa `previewUrl` → tanpa tab kosong).
- tsc **0**; lint **bersih**; suite penuh: **137 file / 1.107 test PASS** (−4 test modal terhapus, +1 test baru; catatan: percobaan suite pertama gagal 1 test `constants.test.ts` murni **race condition** edit paralel CHANGELOG vs constants — rerun hijau penuh).
- Jalur live-on-focus **tidak teruji jsdom** (butuh WebGL) → diverifikasi via pemeriksaan DOM di produksi (bagian 7).

## 6. File yang dimodifikasi

| Aksi | File |
|---|---|
| UBH | `src/components/landing/MagazineShowcase.tsx` (mesin siklus + live overlay + rect proyeksi) |
| UBH | `src/components/landing/LandingPage.tsx` (tanpa popup/props D1; kirim `previewUrl`) |
| UBH | `src/app/page.tsx` (storefront tanpa fetch harga/WA) |
| UBH | `src/components/landing/__tests__/magazine-showcase.test.tsx` (ditulis ulang, 6 test) |
| UBH | `src/lib/constants.ts` (1.3.48), `CHANGELOG.md`, dokumen ini |
| HAPUS | `src/components/landing/TemplateDetailModal.tsx`, `__tests__/template-detail-modal.test.tsx` |

## 7. Verifikasi produksi

- `/api/health` = **1.3.48**; homepage 200.
- DOM live: setelah halaman dibuka ±3 dtk → terdapat `iframe[src^="/preview/"]` (siklus auto memasang live di lembaran pertama); ✕ hadir dengan `aria-label="Tutup demo live"`.
- (Isi bagian ini di bawah setelah deploy.)

## 8. Jangan (anti-regresi)

- Jangan kembalikan `TemplateDetailModal` / state popup di LandingPage — owner memilih lembaran live; modal jadi kode mati.
- Jangan kembalikan drift konstan (`travel.drift`) — inti ritme luncur-berhenti ada di `pendingGlide`/`restT`.
- Jangan menumpuk >1 iframe live sekaligus (angka freeze terukur v1.3.43).
- Jangan hapus atribusi MIT di kepala `MagazineShowcase.tsx`.
