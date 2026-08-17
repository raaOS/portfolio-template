# Tracker Log: Sprint D - Backend Integration & Cleanup

**Status:** 🟢 Completed
**Mulai:** 27 Juni 2026
**Selesai:** 27 Juni 2026

## 🎯 Tujuan (Objective)
- Mengalihkan jalur pengambilan data UI dari Key-Value store lama (`app_kv`) sepenuhnya ke dalam tabel Relasional SQL (`projects`, `project_narratives`, `media_assets`).
- Menyiapkan mekanisme pengujian data lokal melalui skrip seeder multi-tenant (`seed-sql.ts`).

## 📋 Task List
- [x] Menyempurnakan `projectSqlService.ts` dengan fungsi pembacaan data (`getProjectsSql`, `getProjectBySlugSql`).
- [x] Mengubah `src/app/api/projects/route.ts` untuk menggunakan metode pembacaan SQL baru alih-alih `projectService.getProjects()`.
- [x] Membuat `scripts/cloudflare/seed-sql.ts` untuk menyuntikkan data *dummy* relasional agar UI bisa dirender dan divalidasi.

## 📂 File yang Dimodifikasi (Modified Files)
- `src/lib/services/project/projectSqlService.ts` [MODIFIED]
- `src/app/api/projects/route.ts` [MODIFIED]
- `scripts/cloudflare/seed-sql.ts` [NEW]

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Problem:** Endpoint API lama tidak mengenali konsep `siteId`.
  - **Fix:** Untuk mempertahankan fungsionalitas UI saat masa transisi ini, kita memberikan identitas `siteId = 'default-site'` secara eksplisit di level API Route sampai manajemen multi-tenant penuh (di frontend) dibangun pada tahapan berikutnya.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
Integrasi *Backend SQL* telah dirampungkan dari hulu ke hilir. API `/api/projects` sekarang merespons berdasarkan kueri SQL sejati, dan Dual-Write masih dipertahankan untuk keamanan. Tahap selanjutnya adalah **Sprint E (Frontend Migration)** untuk menangani perubahan struktural di dalam UI komponen jika diperlukan, atau pembersihan tabel `app_kv` secara bertahap jika semuanya dinilai sudah 100% stabil.
