# Sprint 65 - Master Dashboard R2 Storage Usage UI

## Ringkasan Pekerjaan
Menambahkan indikator visual pemakaian **Cloudflare R2 Storage** secara real-time pada UI **Admin Master Dashboard** (`MasterSiteTable` & `MasterSiteEditorSidebar`).

## Detail Perubahan
1. **`MasterSiteTable.tsx`**:
   - Menambahkan header pill ringkasan Total Storage R2 yang terpakai di seluruh site client (perbandingan terhadap 10 GB Free Tier Cloudflare).
   - Menambahkan Progress Bar & label indikator kapasitas R2 per-site (MB terpakai / Quota MB) bersisian dengan indikator jumlah project.
   - Menyesuaikan skema warna progress bar berdasarkan persentase (Normal: Indigo/White, >75%: Amber, >90%: Red).

2. **`MasterSiteEditorSidebar.tsx`**:
   - Menghapus Card "Pemakaian Storage R2" dari tab Storage sesuai permintaan UI/UX user, sehingga tab Storage berfokus penuh pada input Custom Quota Add-ons.

3. **`ClientDashboardPanel.tsx`**:
   - Menghapus 3 card ringkasan kuota teratas (Quota project, Quota storage, Status plan) yang redundan dan mengalami bug visual overlapping badge, sehingga tabel Projects langsung menempati bagian utama layar secara lebih bersih dan efisien.

4. **Refaktor Layout Tabbed Sidebar (`MasterSiteEditorSidebar.tsx`)**:
   - Merefaktor sidebar kanan dari tumpukan vertical 10-block yang panjang menjadi **3 Sub-Tab Rapi** (`Pengaturan`, `Storage & Quota`, `Akses & Hapus`).
   - Menghilangkan scrollbar vertikal yang berlebihan, memadatkan padding/height form control, dan membuat navigasi admin jauh lebih cepat.

## File yang Dimodifikasi
- `src/app/admin/client-dashboard/components/MasterSiteTable.tsx`
- `src/app/admin/client-dashboard/components/MasterSiteEditorSidebar.tsx`
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx`
- `docs/tracker/logs/sprint_65_master_storage_usage_ui.md`
- `docs/tracker/INDEX_TRACKER.md`

## Status Verifikasi
- Unit test (`npm test`): **Passed** (806 tests, 116 test files).
- Typecheck (`tsc --noEmit`): **Passed**.

## Fix False Mismatch Hard Skill & Dock Icons (2026-07-24)
- **Bug:** Card storage menampilkan `MISMATCH` dan `10 dangling` saat R2 kosong, walaupun 10 icon tersebut adalah asset bundled dari `public/assets/icons-library/`.
- **Penyebab:** `extractStoragePath()` sengaja mengenali path `/assets/*`, tetapi audit icon tidak membedakan asset public bundled dari object R2.
- **Perbaikan:** Referensi icon bundled tetap dihitung pada total D1, tetapi dikecualikan dari pemeriksaan key R2. Catatan kategori juga menjelaskan bahwa icon lokal/CDN tidak membutuhkan object R2.
- **File dimodifikasi:**
  - `src/app/api/admin/storage-stats/route.ts`
  - `src/app/api/admin/storage-stats/categoryStats.ts`
  - `src/app/api/admin/storage-stats/route.test.ts`
- **Verifikasi:** Vitest storage stats `11/11` lulus; ESLint targeted lulus; TypeScript lulus; endpoint lokal dengan D1/R2 nyata menghasilkan D1 `14`, R2 `0`, orphan `0`, dangling `0`, warnings `0`.
