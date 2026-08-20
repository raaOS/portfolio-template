# Sprint 73 - Bento Studio Serious Debugging & Fixes

**Status:** 🟢 Completed
**Mulai:** 2026-08-19
**Selesai:** 2026-08-19

## 🎯 Tujuan (Objective)
Mode debugging serius atas program Bento Studio (Sprint 68–72): audit ketat untuk menemukan & memperbaiki bug nyata, membedakan dari item yang ternyata sudah benar.

## 🔍 Hasil Audit (Verified NOT a Bug)
- **Insert `audit_logs` di PUT route:** pola `INSERT INTO audit_logs (id, site_id, action, entity_type, created_at)` konsisten dengan `analyticsService.ts`, `orderService.ts`, `templateEntitlementService.ts`, dan skema `d1-schema.ts:140` — aman.
- **`revalidateSiteContentPaths(siteId, paths = ['/'])`** (`src/lib/admin/siteRequestContext.ts:111`) cocok dengan pemanggilan `revalidateSiteContentPaths(session.siteId, ['/'])`; untuk tenant selain DEFAULT_SITE_ID ia me-revalidate `/${slug}` sebagai `layout` — benar.
- **Skema `site_template_settings`** (`d1-schema.ts:193`) cocok dengan INSERT/upsert service (id, site_id, template_id, settings_json, updated_at; UNIQUE(site_id, template_id)).
- **Middleware constants:** route `/api/client/*` tidak masuk `protectedRoutes` (hanya `/admin`, `/api/admin`, `/portal`) → auth di-handle in-route via `validateClientRequest` — tidak perlu registrasi CSRF tambahan.
- **`normalizeBentoSettings`** menangani `sections: []` dengan menambahkan kembali 5 section default; variant tidak dikenal dibuang + di-reseed default — self-healing benar.

## 🐛 Bug yang Diperbaiki

### 1. Hydration mismatch di `AnimatedSection.tsx`
**Gejala:** `const animate = animation !== 'none' && !prefersReducedMotion()` dievaluasi saat render. SSR tidak punya `window` (→ `false`, konten tersembunyi `opacity:0`), sedangkan client dengan reduced-motion → `true` → style konten berubah saat hydration → **hydration mismatch**.
**Fix:**
- `animate` tidak lagi bergantung pada matchMedia saat render: `const animate = animation !== 'none' && !reducedMotion;` dengan `reducedMotion` state yang baru.
- Deteksi `prefersReducedMotion()` dipindah **murni ke `useEffect`** (pasca-mount): jika reduced-motion → `setReducedMotion(true)` + `setVisible(true)` (konten langsung tampil tanpa animasi).
- Render pertama (SSR == client) selalu identik; perubahan hanya terjadi setelah mount → hydration aman.
- Membersihkan 2 eslint-disable `react-hooks/set-state-in-effect` yang menjadi unused karena rule hanya melaporkan setState pertama per effect.
- Semua 5 test `AnimatedSection.test.tsx` (termasuk kasus reduced-motion yang mengecek `opacity === ''`) tetap hijau.

### 2. Layout regression variant `full` pada `BentoImageSequence.tsx`
**Gejala:** Saat penambahan variant `minimal`, container diubah ke `flex flex-col items-center gap-6` untuk semua variant → variant `full` kehilangan tata letak asli **teks | canvas berdampingan di layar besar** (`lg:flex-row`).
**Fix:** Container kini `flex items-center gap-6` dengan `flex-col` untuk `minimal` dan `flex-col lg:flex-row` untuk `full`.

## 📂 File yang Dimodifikasi
- `src/components/templates/landing-bento/AnimatedSection.tsx` — fix hydration mismatch (reduced-motion pindah ke effect, `animate` deterministik saat render).
- `src/components/templates/landing-bento/components/BentoImageSequence.tsx` — restore `lg:flex-row` untuk variant `full`.

## 🧪 Verification Results
- `npx vitest run src/components/templates/landing-bento`: **2 files / 9 tests PASS**
- `npm test`: **120 files / 873 tests PASS**
- `npx tsc --noEmit`: 0 error
- `npx eslint` area terdampak: 0 error 0 warning

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Backlog tetap: adaptasi kontras untuk background gelap (midnight/cyber/neon/paper) — template dirancang light; `TemplateDemoCustomizer` masih dead code.
- Rendering SSR konten animasi sengaja `opacity:0` (konvensi industri ala framer-motion/AOS); jika butuh konten tampil tanpa JS, tambahkan fallback `<noscript>` di masa depan.
- Seluruh perubahan program Bento Studio (Sprint 68–73) masih **belum di-commit/push**.