# Tracker Log: Sprint C - Frontend Data Adapters

**Status:** 🟢 Completed
**Mulai:** 27 Juni 2026
**Selesai:** 27 Juni 2026

## 🎯 Tujuan (Objective)
- Membangun *Data Access Layer (DAL)* baru untuk tabel SQL.
- Membuat *Mapper* untuk mengubah *row* mentah SQL menjadi objek JSON UI yang *backwards compatible*.
- Menerapkan arsitektur *Dual-Write* selama masa transisi.

## 📋 Task List
- [x] Membuat `projectMapper.ts` -> menerjemahkan baris `projects`, `project_narratives`, dan `media_assets` menjadi `Project` UI statis.
- [x] Membuat `projectSqlService.ts` -> CRUD operations dengan raw SQL `queryD1`.
- [x] Menambahkan pola *Dual-Write* ke dalam `projectService.ts` lama.

## 📂 File yang Dimodifikasi (Modified Files)
- `src/lib/mappers/projectMapper.ts` [NEW]
- `src/lib/services/project/projectSqlService.ts` [NEW]
- `src/lib/services/projectService.ts` [MODIFIED] -> Menyuntikkan `try-catch` blok *Dual-Write* ke SQL.

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Problem:** Fitur *slug collision* mungkin berbeda di SQL.
  - **Fix:** Menghindari update massal atau duplikasi logika kompleks di Service SQL baru. Service ini murni mencerminkan *write* dari atas dengan pola `siteId = 'default-site'` sementara waktu, sebelum nantinya `siteId` dikirim dari API Controller (Sprint D).

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
Lapisan perantara sudah jadi! Setiap penambahan project dari *Admin Panel* sekarang akan direkam ke dua tempat secara bersamaan. Tugas berikutnya adalah **Sprint D**, untuk mulai mengadopsi integrasi end-to-end dengan parameter `siteId`.
