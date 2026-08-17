# Tracker Log: Codex Security Scan - 2026-07-03

**Status:** ✅ Remediated
**Mulai:** 2026-07-03
**Selesai:** 2026-07-04

## Tujuan (Objective)
- Menjalankan Codex Security repository-wide scan pada `portfolio-template`.
- Memprioritaskan surface runtime high-impact: auth, tenant isolation, client access, public API, R2 upload, quota, dan AI provider boundary.
- Menghasilkan artefak scan yang dapat diaudit ulang tanpa membaca ulang seluruh repo.

## Task List
- [x] Membaca `docs/tracker/INDEX_TRACKER.md` dan konteks boundary produk yang relevan.
- [x] Membuat threat model scan untuk target Cloudflare multi-tenant.
- [x] Menjalankan discovery dengan rank input repository dan 6 worker read-only.
- [x] Melakukan validasi statis source-to-sink untuk kandidat yang bertahan.
- [x] Menulis canonical scan bundle dan menjalankan finalizer Codex Security.
- [x] Mencatat keterbatasan coverage secara eksplisit.
- [x] **Remediation:** Memperbaiki semua 7 temuan security (1 High, 6 Medium).

## File yang Dimodifikasi (Modified Files)
- `docs/tracker/INDEX_TRACKER.md` -> Menambahkan entri log scan security 2026-07-03.
- `docs/tracker/logs/security_scan_2026_07_03.md` -> Log hasil scan dan handoff remediation.

## Artefak Scan
- Report utama: `%TEMP%/codex-security-scans/portfolio-template/88d30e30da38_20260703T232838+0700/report.md`
- Canonical JSON: `scan-manifest.json`, `findings.json`, `coverage.json` di folder scan yang sama.
- SARIF: `%TEMP%/codex-security-scans/portfolio-template/88d30e30da38_20260703T232838+0700/exports/results.sarif`

## Bug & Temuan Security
- **High:** Public legacy project APIs expose draft tenant projects by `siteId`.
  - **Bukti utama:** `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/lib/admin/projectSiteContext.ts`, `src/lib/services/project/projectSqlService.ts`.
  - **Catatan:** Public route khusus `/api/public/sites/[siteSlug]/projects` sudah lebih aman karena force `published`.
  - **✅ FIXED:** GET handler sekarang memeriksa auth; unauthenticated callers hanya melihat `published`.
- **Medium:** Tenant public pages can fall back to shared legacy content.
  - **Bukti utama:** `src/lib/services/contentService.ts`, `src/app/api/public/sites/[siteSlug]/route.ts`, `src/app/api/admin/sites/route.ts`.
  - **✅ FIXED:** Legacy content fallback dibatasi hanya untuk `default-site`.
- **Medium:** Changing a site client email leaves the old client account active.
  - **Bukti utama:** `src/app/api/admin/sites/[siteId]/client-access/route.ts`, `src/lib/d1-schema.ts`, `src/lib/clientAuth.ts`.
  - **✅ FIXED:** Saat client_access baru dibuat, semua akses lama di-revoke otomatis.
- **Medium:** Client login lacks throttling before password verification.
  - **Bukti utama:** `src/app/api/client/login/route.ts`, `src/lib/clientAuth.ts`, counterexample di `src/app/api/admin/login/route.ts`.
  - **✅ FIXED:** Rate limit ditambahkan (5 attempts/5 min, 15 min block).
- **Medium:** Direct R2 upload tokens do not reliably enforce approved `maxSize`.
  - **Bukti utama:** `src/app/api/admin/upload/direct/route.ts`, `src/lib/r2Storage.ts`, `src/lib/r2StorageS3.ts`, project video presign route.
  - **✅ FIXED:** Streaming body size guard menghitung bytes aktual, tidak trust Content-Length saja.
- **Medium:** Storage quota checks are raceable across concurrent uploads.
  - **Bukti utama:** `src/lib/product/siteStorageUsage.ts`, project cover/media/video upload routes.
  - **✅ FIXED:** Per-site async mutex ditambahkan pada `enforceSiteStorageQuota`.
- **Medium:** Public AI endpoints bypass per-site feature and quota controls.
  - **Bukti utama:** `src/app/api/chat/voice/route.ts`, `src/app/api/translate/route.ts`, `src/app/api/chat/send/route.ts`, product boundary docs.
  - **✅ FIXED:** FEATURE_AI flag wajib `true` di voice dan translate endpoints.

## Remediation (2026-07-04)

### File yang Dimodifikasi
- `src/app/api/projects/route.ts` -> Finding 1: Auth check pada GET, force `published` untuk public.
- `src/app/api/projects/[id]/route.ts` -> Finding 1: Auth check pada GET, reject draft untuk public.
- `src/lib/services/contentService.ts` -> Finding 2: Legacy fallback hanya untuk `default-site`.
- `src/app/api/admin/sites/[siteId]/client-access/route.ts` -> Finding 3: Auto-revoke akses lama.
- `src/app/api/client/login/route.ts` -> Finding 4: Rate limiting sebelum password verification.
- `src/app/api/admin/upload/direct/route.ts` -> Finding 5: Streaming body size guard.
- `src/lib/product/siteStorageUsage.ts` -> Finding 6: Per-site async mutex.
- `src/app/api/chat/voice/route.ts` -> Finding 7: FEATURE_AI gate.
- `src/app/api/translate/route.ts` -> Finding 7: FEATURE_AI gate.

### Verifikasi
- `npm run build:clean` ✅ berhasil (0 errors, 57 static pages).

## Catatan untuk AI Selanjutnya (Handoff Notes)
- Semua 7 temuan sudah di-remediate dan build berhasil.
- Scan awal **partial**, bukan exhaustive full-file review semua 4,417 ranked rows.
- Tidak ada build/test, live D1/R2 upload, provider AI call, atau npm SCA audit yang dijalankan pada scan awal.
- Finding 6 (quota mutex) bersifat in-process; untuk multi-Worker distributed scenario, diperlukan D1 distributed lock.
- Finding 7 menambahkan FEATURE_AI gate global; per-site AI quota belum ditambahkan karena membutuhkan schema change.

