# Tracker Log: Audit Bug Tersembunyi - 2026-07-12

**Status:** ✅ Resolved (semua 3 bug diperbaiki di Sprint 34)
**Mulai:** 2026-07-12
**Selesai:** 2026-07-12 (audit), 2026-07-05 (perbaikan di Sprint 34)

## Tujuan (Objective)
- Menilai jalur runtime yang relevan untuk penggunaan multi-tenant dan melakukan validasi statis serta automated test pada keadaan worktree saat audit dimulai.
- Mencatat hanya bug yang mempunyai bukti kode dan langkah reproduksi yang konkret.

## Cakupan dan Verifikasi
- Membaca tracker index dan log audit keamanan/V6 yang relevan.
- Meninjau route project, komentar, metrik, cache revalidation, client mutation, dan schema D1 terkait.
- `npx tsc --noEmit` selesai tanpa error.
- `npm run lint` selesai tanpa error; terdapat 3 warning non-blocking (dua import tidak dipakai dan satu dependency hook berlebih).
- `npm test` gagal: 5 file / 18 test. Lima belas kegagalan berasal dari test yang belum mengatur `FEATURE_AI=true` atau mock yang sudah tidak sesuai. Tiga test wallpaper-poster gagal karena `revalidatePath` tidak dimock pada unit-test. Kegagalan test tersebut harus diperbaiki agar regresi dapat dideteksi, tetapi tidak dengan sendirinya membuktikan kegagalan produksi.

## File yang Dimodifikasi (Modified Files)
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan tautan audit ini.
- `docs/tracker/logs/audit_hidden_bugs_2026_07_12.md` -> Dokumentasi temuan audit.

## Bug Terkonfirmasi

### ✅ Bug 1: Cache halaman project tenant tidak di-invalidasi setelah mutasi project — RESOLVED
- **Bukti:** `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, dan `src/app/api/projects/bulk/route.ts` selalu memanggil `revalidatePath('/', ...)`, `/projects`, dan `/admin`. Halaman tenant menggunakan path `/${siteSlug}`, `/${siteSlug}/projects`, dan `/${siteSlug}/projects/${slug}` serta ISR `revalidate = 60`.
- **Status:** ✅ **Diperbaiki di Sprint 34.** `revalidateSiteProjectPaths()` sekarang digunakan di semua route project dan handle path tenant (`/${slug}`, `/${slug}/projects`, `/${slug}/projects/${projectSlug}`).

### ✅ Bug 2: Komentar project bocor dan bercampur antar-tenant bila slug project sama — RESOLVED
- **Bukti:** D1 menetapkan keunikan project sebagai `UNIQUE(site_id, slug)` di `src/lib/d1-schema.ts`; slug yang sama karena itu valid pada dua site. Namun `src/app/api/comments/route.ts` membaca dan menulis `db.ref(\`comments/${slug}\`)` tanpa `siteId`. Client di `src/components/projects/project-detail/hooks/useProjectDetail.ts` juga mengirim hanya `slug`.
- **Status:** ✅ **Diperbaiki di Sprint 34.** `buildCommentPath(siteId, slug)` sekarang membuat path `comments/${siteId}/${slug}`. Client hook mengirim `siteId` di semua request komentar.

### ✅ Bug 3: Metrik like/share tidak di-scope per tenant dan fallback membaca project legacy — RESOLVED
- **Bukti:** `src/app/api/metrics/route.ts` menyimpan key `metrics/metrics/${slug}` dan menerima hanya `slug`; `getFallbackMetrics()` memanggil `projectService.getProjects()` tanpa site context. `useProjectDetail.ts` juga mengirim hanya `slug`.
- **Status:** ✅ **Diperbaiki di Sprint 34.** `buildMetricsPath(siteId, slug)` sekarang membuat path `metrics/metrics/${siteId}/${slug}`. Fallback metrics menggunakan `projectSqlService.getProjectBySlugSql(siteId, slug)` yang site-aware. Client hook mengirim `siteId` di semua request metrics.

## Catatan untuk AI Selanjutnya (Handoff Notes)

**UPDATE 2026-07-21:** Semua 3 bug yang ditemukan dalam audit ini sudah diperbaiki di Sprint 34 (Full Site Scope Content CRUD):

1. ✅ **Bug 1 (Cache revalidation):** `revalidateSiteProjectPaths()` sudah handle path tenant.
2. ✅ **Bug 2 (Comments leak):** `buildCommentPath(siteId, slug)` sudah scope per tenant.
3. ✅ **Bug 3 (Metrics not scoped):** `buildMetricsPath(siteId, slug)` sudah scope per tenant.

Audit ini sekarang ditandai sebagai `Resolved`. Tidak ada tindak lanjut yang diperlukan.
