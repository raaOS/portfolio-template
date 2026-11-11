# Bug: Demo Live di Hero Menutup Sendiri Sebelum Tampil (v1.3.81, 2026-11-11)

## Laporan Owner

> "ada bug di hero tumpukan demo template, ketika diklik kan popup live emulator desktop template demo, itu kadang live demo belum muncul tapi sudah kembali ke tumpukan, sering banget ini sangat mengganggu"

## Diagnosis

Direproduksi di Chromium (dev server `localhost:3000`), bukan dugaan:

| Skenario uji | Hasil sebelum perbaikan |
|---|---|
| Satu tap lembaran | overlay muncul ±0,6 s, bertahan (normal) |
| Dua tap berjarak **120 ms** | overlay **tidak pernah muncul** |
| Tap kedua pada ±650 ms (overlay baru tampil) | overlay tampil lalu **langsung tertutup** |
| Klik backdrop segera setelah overlay tampil | langsung tertutup |
| Container di-resize saat live | iframe `opacity: 0` dan tidak kembali |

Akar masalah ada dua lapis:

1. **Animasi angkat ±0,6 detik tanpa umpan balik.** `viewDuration` di `settingsFor()` menghasilkan durasi ~0,55–0,6 s. Selama itu belum ada overlay/loading apa pun, jadi pengguna mengetuk lagi.
2. **Tap kedua = perintah tutup.** `MagazineScene.onTap()` lama selalu memanggil `releaseFocus()` bila `focus.index >= 0`, tanpa jeda. Double-click (kebiasaan desktop) atau ketukan iseng langsung membatalkan animasi tepat sebelum `onLive` terpanggil. Ditambah backdrop `onClick={closeLive}` yang menerima klik apa pun tanpa jeda.

Bug laten ketiga yang ikut diperbaiki: `scene.onLive` selalu memanggil `setLiveReady(false)`. `setSize()` memanggil `onLive` lagi setiap container berubah ukuran (resize/rotasi/alamat bar HP), sehingga iframe yang sudah `onLoad` dikembalikan ke `opacity: 0` tanpa pernah memuat ulang → demo tampak hitam permanen.

## Perbaikan

| File | Perubahan |
|---|---|
| `src/components/landing/MagazineShowcase.tsx` | `TAP_GUARD_MS = 700` + field `focusStamp`; `onTap()` mengabaikan tap pembatal selama guard; guard tutup 300 ms di `closeLive`; `liveIndexRef` + `liveOpenedAt` agar `liveReady` hanya di-reset saat indeks berubah; lapisan tangkapan layar + label "Memuat demo live…" selama `!liveReady` |
| `src/lib/constants.ts` | `APP_VERSION` 1.3.80 → 1.3.81 |
| `CHANGELOG.md` | entri `[1.3.81]` |

## Verifikasi

- Single tap → overlay muncul **0,71 s**, bertahan (bukan regresi).
- Double tap 120 ms → overlay **muncul** (sebelumnya tidak).
- Klik backdrop < 300 ms setelah tampil → **diabaikan**; setelah guard → menutup.
- Container di-resize saat live → `opacity` iframe tetap **1** (sebelumnya 0).
- Esc tetap menutup; tombol ✕ tetap menutup.
- `tsc` 0 error, `eslint` bersih, `vitest` PASS (landing + constants).

## Catatan untuk AI berikutnya

- Jangan menghapus `TAP_GUARD_MS` / guard 300 ms — keduanya menutup laporan bug ini, bukan hiasan.
- Kalau mengubah `onLive`, pertahankan syarat `index !== liveIndexRef.current` sebelum `setLiveReady(false)`.
- Durasi angkat lembaran berasal dari `cfg.view.speed`; menaikkannya (`viewDuration` lebih pendek) akan mengurangi ketukan iseng, tapi guard tetap wajib.
