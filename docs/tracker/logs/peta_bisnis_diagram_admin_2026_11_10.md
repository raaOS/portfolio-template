# Peta Bisnis di Admin: Alur Jualan Jadi Diagram Berwarna (v1.3.79) — 2026-11-10

## Kenapa ada log ini

Owner melihat window **Peta Bisnis** (zona Sistem Owner) masih menampilkan **kartu 3 kolom**
("Pembeli / Sistem / Owner") padahal sudah minta bentuk **diagram panah berwarna**.

Akar masalah: pekerjaan diagram dikerjakan di **worktree opencode** (`happy-engine`), sedangkan
`npm run dev` owner dijalankan dari folder utama `C:\Users\USER\Documents\tamplate-portofolio`.
Dua folder itu beda isi walau commit-nya sama (`6c3887e`) — worktree hanya punya perubahan
yang belum di-commit, folder utama punya perubahan lain (Peta Bisnis versi kartu dari agen zcode).
Perubahan di worktree tidak pernah terlihat di dev server folder utama.

Perbaikan: diagram dipindah **ke folder utama**, menggantikan kartu di dalam panel yang sudah ada
(`petaBisnis`) — bukan menambah app baru, supaya tidak ada dua window mirip
("Alur Bisnis" + "Peta Bisnis"). Perubahan worktree yang duplikat sudah dibatalkan.

## File yang berubah

| File | Perubahan |
|---|---|
| `src/app/admin/desktop/panels/bizMapContent.ts` | `ALUR_BISNIS` (kartu 3 lane) diganti **`ALUR_FASE`**: 6 fase × 18 langkah, tiap kotak punya `actor` + `head` + 3 baris teks; tipe `BizActor`/`BizNode`/`BizPhase`. `PETA_ASET` + `CATATAN_SOP` tidak diubah. |
| `src/app/admin/desktop/panels/AlurBisnisDiagram.tsx` | **Baru.** SVG inline 1580×1208: band fase berwarna, kotak berwarna per pelaku (biru pembeli · ungu sistem · hijau owner · amber "cek mutasi dulu" · abu cron), panah berwarna per fase + 6 marker, legenda bawah. |
| `src/app/admin/desktop/panels/PetaBisnisPanel.tsx` | Grid kartu 3 kolom diganti `<AlurBisnisDiagram />` (dibungkus `overflow-x-auto`); heading & Peta Aset & Catatan SOP tetap. |
| `src/app/admin/desktop/registry.ts` | Window `petaBisnis` 980×660 → **1180×780** supaya diagram terbaca. |

## Kenapa SVG, bukan Mermaid

Diuji mermaid@11 di Chromium: `flowchart TB` 3 subgraph = **1303×4532 px** (satu kolom panjang),
`flowchart LR` = **5592×268 px** (satu baris, teks ±6 px), dan `direction` di dalam subgraph
diabaikan bila ada edge lintas subgraph. Untuk 18 langkah berurutan, layout 2D terbaca hanya bisa
dibuat manual.

## Kenapa SVG inline, bukan file `public/`

Isi diagram = proses internal owner (`R2_PENDING`, `media_pending`, aturan "cek mutasi dulu, bukan
struk"). File di `public/` ikut ter-deploy ke **setiap** deployment klien dan bisa dibuka lewat URL.

## Verifikasi (dijalankan di folder utama, `node_modules` ada)

- `npx tsc --noEmit` → **0 error**.
- `npx eslint` pada 5 file terkait → **bersih**.
- `npx vitest run src/app/admin/desktop/registry.test.ts` → **6/6 PASS** (guard `PANEL_MAP` + owner-mode).
- Render panel ke HTML statis lalu buka di Chromium: `viewBox 0 0 1580 1208`, **24 rect** (18 kotak +
  6 band), **18 line** (panah dalam fase), **11 path** (5 panah antar-fase + 6 panah legenda),
  **6 marker**, **0 `ol`** (kartu sudah tidak ada), tanpa error console.

## Jarak dalam window (susulan permintaan owner)

Isi window sebelumnya menempel ke tepi kiri (root panel hanya `pr-1`). Sekarang root
`PetaBisnisPanel` memakai `px-5 pb-6 pt-4` — jarak kiri/kanan 20 px, atas 16 px, bawah 24 px,
seragam untuk diagram, Peta Aset, dan Catatan SOP. Diverifikasi lewat computed style:
`padding: 16px 20px 24px 20px`.

## Susulan: ubin zone responsif (HP & tablet tidak menumpuk)

Permintaan owner: jarak antar zone terlalu jauh di desktop, dan di HP/iPad zone saling menumpuk.

**Akar masalah**

1. `openAllZonesTiled` memakai ukuran mati: `Math.min(560, …)` × `Math.min(400, …)` → di layar 1920 px tersisa
   ~770 px kosong di tengah; baris bawah juga menyisakan celah ~140 px.
2. `canTile = vw >= 1160 && vh >= 700`. Di bawah itu jatuh ke `openFolder()` bertingkat 30 px → **bertumpuk**.
3. `@media (max-width: 768px)` memaksa **semua** `.admin-window` fullscreen (`!important`) → di HP keempat
   zone menempati layar yang sama persis = tumpuk total.

**Perbaikan**

| File | Perubahan |
|---|---|
| `useAdminDesktop.ts` | `getZoneTile(slot, vw, vh)` menghitung lebar/tinggi dari ruang tersedia; `cols = vw >= 720 ? 2 : 1`, `rows = 4 / cols`. `openAllZonesTiled` → `layoutZones` (buat **atau** geser jendela zone yang sudah ada) + listener `resize` (rAF) supaya rotasi/resize langsung rapi. |
| `AdminWindowFrame.tsx` | Kelas `admin-window-zone` untuk jendela `folder-*`. |
| `admin-desktop.css` | Media query fullscreen dibatasi ke `.admin-window:not(.admin-window-zone)`; `admin-folder-grid` di HP padding 12 px, gap 6 px. |
| `useAdminDesktop.test.ts` | Kasus 1000×760, iPad 820×1180, HP 390×844 + helper `hasOverlap()` (tidak ada dua jendela yang beririsan). |

**Hasil ukur (harness CSS asli, 3 viewport)**

- HP 390×844 → 1 kolom: 4 jendela 368×175 di x=12, y=48/231/414/597, `overlap: false`.
- iPad 820×1180 → 2×2: 395×527, `overlap: false`.
- Desktop 1440×900 → 2×2: 705×387, x=12/725, y=48/443 (celah 10 px, tanpa ruang menganggur), `overlap: false`.

## Susulan 2: ikon zone menumpuk & label hilang di HP/iPad

Laporan owner (dua kali, dengan tangkapan layar): di HP/iPad ikon di dalam zone bertumpuk & dempet, judul ikon tidak terlihat.

**Akar masalah 1 — baris grid menyusut.** `.admin-folder-grid` memakai `h-full` (height: 100%) sementara isinya
lebih tinggi dari kotak window. `align-content` bawaan `stretch` lalu **menyusutkan baris** sampai `min-height`
tombol (44 px, aturan global `button`), sehingga ikon baris ke-2 menimpa label baris ke-1.
Bukti: `gridTemplateRows` = `44px 44px 44px` padahal tinggi item 108 px.

**Akar masalah 2 — kartu zone menyusut di HP.** Setelah `grid-auto-rows: max-content` baris jadi 101 px, tapi
kartu zone tetap 204/141/196/141 px dan 12 label tetap hilang. Jumlah keempatnya = 682 px + gap 30 + padding
132 = **tepat 844 px (tinggi layar)** → `.admin-desktop` (flex column) **mengempiskan** kartu karena
`.admin-window` punya `min-height: 0`, jadi `height: auto` saja tidak cukup; `overflow: hidden` memotong grid.

**Perbaikan**

| File | Perubahan |
|---|---|
| `admin-desktop.css` `.admin-folder-grid` | `grid-auto-rows: max-content` + `align-content: start`. |
| `admin-desktop.css` `@media (max-width: 768px)` | `.admin-desktop` jadi flex column + `overflow-y: auto` + padding `48px 12px 84px`; `.admin-window-zone` → `position: static`, `flex: 0 0 auto`, `width: 100%`, `height: auto`; `.admin-window-zone .admin-window-content` → `flex: 0 0 auto; min-height: auto; overflow: visible`; grid → `height: auto; overflow: visible`. |
| `admin-desktop.css` `@media (max-width: 480px)` | ikon 46 px, padding 10/4, gap 6, label 10,5 px. |

**Hasil ukur (harness CSS asli, `zone3.js`)**

- HP 390×844: kartu 360 / 239 / 333 / 239 px, `scrollHeight` 1334 > `clientHeight` 844 → **benar-benar scroll**,
  `hiddenLabels: []`, `clash: false`, `overlapWindows: false`.
- iPad 820×1180: 2×2, baris grid 123/123/108 px, `hiddenLabels: []`, `clash: false`.
- `tsc` 0 error, `eslint` bersih, `useAdminDesktop.test.ts` + `registry.test.ts` 12/12 PASS.

**Jebakan untuk AI berikutnya:** jangan hapus `flex: 0 0 auto` pada `.admin-window-zone` di media query HP —
tanpa itu `min-height: 0` di `.admin-window` membuat kartu mengempis dan grid terpotong (bug ini sudah muncul
dua kali).

## Catatan untuk AI berikutnya

- Sumber tunggal teks alur = `bizMapContent.ts` (`ALUR_FASE`). Ubah di sana; jangan hidupkan lagi
  `docs/diagrams/*.mmd` (sudah tidak dipakai portal).
- Jangan bikin app admin baru untuk diagram ini — pakai window `petaBisnis` yang sudah ada.
- Jangan pindahkan SVG ke `public/` (alasan keamanan di atas).
