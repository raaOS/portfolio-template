# Log: Zona Desktop Admin Dipecah 3 → 4 (v1.3.29)

**Tanggal:** 2026-10-09
**Status:** ✅ Selesai & tervalidasi penuh (gerbang: `tsc --noEmit` 0, ESLint 0 error, seluruh test PASS)
**Izin owner:** pertanyaan _"admin dashboard bagian sistem dan tampilan apa bisa dipisah? yang tadinya ada 3 jadi 4?"_ → pilihan owner via kuesioner: **"4 zona: Tampilan + Sistem"**.

---

## Perubahan

Zona `system` ("Sistem & Tampilan", sudah 10 app) dipecah di `src/app/admin/desktop/registry.ts` (`ADMIN_ZONES`):

| Zona (urutan array) | id | Apps |
|---|---|---|
| Konten & Berkas | `content` | 8 app — tetap |
| **Sistem** (rename) | `system` | AI, Statistik Pengunjung, Log Aktivitas, Backup Database, Harga Jual, Order & Pembayaran (6) |
| **Tampilan** (BARU) | `display` | Tampilan (wallpaper), Sistem Dock, Widget & Catatan, Efek Suara (4) |
| Komunikasi | `communications` | 4 app — tetap |

Zona baru: ikon `Palette` (lucide), warna ungu (`text-violet-600` / `bg-violet-500` / `gradient bg-violet-600`) agar beda dari zona lain (biru/hijau/cyan); deskripsi _"Ganti wallpaper, susun dock, atur widget, dan efek suara OS"_. Zona `system` ganti label "Sistem & Tampilan" → "Sistem", deskripsi _"Statistik pengunjung, log aktivitas, backup, harga jual, dan pesanan"_ (sengaja **tidak menyebut AI** — janji fitur AI dihapus sejak v1.3.28).

## Kenapa Aman (verifikasi sebelum eksekusi)

- `openApp` (`useAdminDesktop.ts:36`) mencari app dengan **scan semua `ADMIN_ZONES`**, parameter `zoneId` diabaikan → memindahkan app antar zona tidak mengubah perilaku buka jendela.
- Folder zona digambar `WindowContentRenderer` + `ZoneFolderIcon` langsung dari data → zona ke-4 tampil otomatis, tanpa komponen baru.
- **Tidak ada** penyimpanan zona di `localStorage`/`sessionStorage` (grep desktop = 0) → tidak ada state lama yang nyangkut.
- `APP_ROUTE_MAP` (deep-link `/admin/...`) per-app, tidak disentuh; `PANEL_MAP` tidak disentuh → konten window sama persis.
- Impor lucide dicek ulang: `Palette` ditambahkan; `ImageIcon`/`Layout`/`Type`/`Music`/`Monitor` tetap terpakai (tidak ada unused import).

## File yang Dimodifikasi

- `src/app/admin/desktop/registry.ts` (pecah zona + impor `Palette`)
- `AGENTS.md` (tabel Admin UI Zones: 3 → 4 Zones)
- `docs/operations/GLADI_RESIK_KLIEN_PERDANA.md`, `docs/operations/backup-restore-runbook.md`, `docs/release/SALES_PRICING.md` (penunjuk panel: "Sistem & Tampilan" → "Sistem")
- `CHANGELOG.md` (entri `[1.3.29]`)
- `docs/tracker/INDEX_TRACKER.md` (entri 146)

Catatan: referensi "Sistem & Tampilan" di CHANGELOG/log tracker historis **sengaja tidak diubah** (catatan masa lalu tetap akurat pada zamannya).

## Sisa / Catatan

- Panel AI (`ai`) tetap di zona Sistem walau `PANEL_MAP`-nya sengaja kosong (keputusan owner v1.3.28) — tampilan visual belum dicek di browser (pekerjaan murni data registry; verifikasi runtime: buka `/admin` setelah dev server jalan).
