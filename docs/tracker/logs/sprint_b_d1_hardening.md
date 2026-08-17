# Tracker Log: Sprint B - D1/R2 Backend Hardening

**Status:** 🟢 Completed
**Mulai:** 27 Juni 2026
**Selesai:** 27 Juni 2026

## 🎯 Tujuan (Objective)
- Mengonversi database D1 dari pola Key-Value (`app_kv`) yang lama ke pola Relasional Terstruktur.
- Memastikan skema baru (7 tabel + index) siap dieksekusi oleh sistem tanpa langsung merusak kompatibilitas data lama.

## 📋 Task List
- [x] Membuat definisi DDL SQL untuk 7 tabel dan 4 index utama (`src/lib/d1-schema.ts`).
- [x] Menyuntikkan iterasi pembuatan tabel ke dalam `bootstrapD1Schema()` di `src/lib/cloudflareD1.ts`.

## 📂 File yang Dimodifikasi (Modified Files)
- `src/lib/d1-schema.ts` [NEW] -> Menyimpan array statis string DDL SQL (kompatibel dengan Edge).
- `src/lib/cloudflareD1.ts` [MODIFIED] -> `bootstrapD1Schema()` kini membuat tabel `app_kv` (legacy) DAN seluruh tabel baru secara sinkron.

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Problem:** Eksekusi skema `.sql` via Vercel Edge rentan gagal jika membaca file fisik menggunakan `fs`.
  - **Fix:** Menyimpan seluruh skema SQL sebagai `string[]` ber-export dalam file `.ts` biasa, menjamin kompatibilitas runtime Next.js Edge.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
Fondasi D1 SQL Schema telah siap. Tabel-tabel relasional akan dibuat secara otomatis saat *query* D1 berikutnya dipicu. Pekerjaan dapat dilanjutkan ke **Sprint C (Frontend Data Adapters)** untuk mulai menghubungkan antarmuka UI dengan struktur relasional yang baru ini (dan secara bertahap memensiunkan `app_kv`).
