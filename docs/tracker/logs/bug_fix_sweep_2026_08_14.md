# Tracker Log: Bug Fix Sweep 2026-08-14

**Status:** 🟢 Completed
**Mulai:** 2026-08-14  
**Selesai:** —

## 🎯 Tujuan (Objective)
- Menutup bug yang tersisa dari daftar temuan QA/audit (Critical/High/Medium/Low) sebelum rilis berikutnya.
- Memastikan `npm run lint` bersih dari error, `npx tsc --noEmit` bersih, dan `npm test` tetap lulus.

## 📋 Task List
- [x] Batch 1 — Critical + High (10 bug): selesai di sesi sebelumnya.
- [x] Batch 2 — Medium (11 bug: #11–#21): selesai di sesi sebelumnya.
- [x] Batch 3 — Low (#18, #23–#57): selesai.

## 📂 File yang Dimodifikasi (Modified Files)
- `src/app/api/admin/sites/[siteId]/project-media/route.ts`
  - Menambahkan handler `DELETE` untuk menghapus file media project site-scoped berdasarkan `key`.
  - Guard prefix `sites/{siteId}/projects/` + sanitasi `..` untuk mencegah penghapusan lintas site.
- `src/lib/observability/operationalLog.ts`
  - Menambahkan event name `'r2.delete'` agar operasi cleanup media dapat di-log.
- `src/app/admin/client-dashboard/ClientDashboardPanel.tsx`
  - Menambahkan `pendingUploadKeysRef` untuk melacak key R2 yang diupload selama editor project terbuka.
  - Otomatis menghapus file yatim saat editor ditutup tanpa menyimpan (`closeEditor`) atau saat item gallery dihapus sebelum save.
  - Membersihkan ref saat project berhasil disimpan.
- `src/lib/services/project/projectSqlService.ts`
  - #35: bulk delete `results.some` → `every` agar kegagalan parsial tidak dilaporkan sukses.
  - #36: mengganti placeholder `legacy-key-*` menjadi string kosong untuk `r2_key` kosong.
  - #43: menambahkan suffix acak pada ID `narr-*` dan `media-*` untuk menghindari collision PK.
  - #44: menambahkan log warning saat slug ditulis ulang karena collision.
- `src/lib/mappers/projectMapper.ts`
  - #43: `generateProjectId()` sekarang menggabungkan `Date.now()` dengan random suffix.
- `src/lib/services/projectService.ts`
  - #37: create project untuk site non-default tidak lagi menulis ke JSON tree global `projects` (sumber kebenaran tetap SQL).
  - #38: perbaikan pengecekan collision slug saat update (`Object.keys(...).some()`).
- `src/app/admin/projects/AdminProjectsClient.tsx`
  - Mengganti `useEffect` yang melakukan `setCurrentPage` dengan derived `displayPage` untuk menghindari cascading render.
  - Menghapus import `useEffect` yang tidak lagi dipakai.
- `src/components/os/core/Dock.tsx`
  - #24: menyambungkan prop `onOpenTrash` ke item Dock `trash` dan mengikat status `isOpen` ke window `trash-bin`.
- `src/lib/services/orderService.ts`
  - #39: dedupe email notifikasi expired berdasarkan `buyer_email` agar buyer tidak kena spam saat banyak order pending expired bersamaan.
  - #40 / #50: unify fallback base URL menjadi `http://localhost:3000` (dari hardcoded production domain) untuk konsistensi lokal.
  - #45: `Math.floor()` pada resolved order amount agar nominal selalu integer.
- `src/lib/services/project/projectSqlService.ts`
  - #46: chunk bulk status update `IN (...)` dengan ukuran 500 untuk menghindari batas parameter SQL.
- `src/lib/services/templateEntitlementService.ts`
  - #41: `grantEntitlement` mengembalikan `false` saat D1 tidak configured (bukan `true`).
  - #42: validasi input `siteId`/`templateId` tidak kosong sebelum grant.
- `src/lib/security/constants.ts` + 5 endpoint auth
  - #49: tambahkan konstanta `CSRF_TOKEN_MAX_AGE` (7 hari) dan pakai di semua endpoint yang set cookie `csrf_token`.
- `src/app/api/client/custom-domain/route.ts`
  - #52: validasi `customDomain` wajib diisi (`min(1)`) saat `action = register`.
- `src/app/admin/projects/AdminProjectsClient.tsx`
  - #48 (serupa): ganti `setState` di `useEffect` dengan derived `displayPage` untuk pagination.
- `src/app/admin/desktop/panels/OrdersPanel.tsx`
  - #47: tambah polling 30 detik agar daftar order ter-update secara real-time.
- `src/app/admin/desktop/useAdminDesktop.ts`
  - #48: tambahkan random suffix pada ID window agar tidak collision saat open berulang cepat.
- `src/app/checkout/page.tsx`
  - #51: label harga plan pill mengambil dari `PLAN_BASE_PRICES` (tidak lagi hardcode 149rb/299rb).
- `src/components/os/hooks/useStickyNotes.ts`
  - #56: ganti `sessionStorage` menjadi `localStorage` untuk flag welcome note.
- `src/app/api/admin/login/route.ts` + `route.test.ts`
  - #57: hapus bypass berbasis header `x-test-bypass`; test diperbarui untuk memastikan rate limit tetap ditegakkan meski header dikirim.

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Bug #18 — Orphan project media saat editor dibatalkan:**
  - **Penyebab:** Upload cover/gallery langsung ke R2, tetapi jika user menutup editor tanpa menyimpan project, file R2 tidak punya referensi D1.
  - **Perbaikan:** Track key di `pendingUploadKeysRef`; panggil `DELETE /api/admin/sites/[siteId]/project-media` saat cancel/remove gallery.
- **Bug #24 — Dock Trash tidak ter-wire:**
  - **Penyebab:** Prop `onOpenTrash` diteruskan ke `OSDock` tetapi tidak pernah dipakai.
  - **Perbaikan:** Tambahkan item Dock `trash` dengan `onClick: onOpenTrash` dan `isOpen: isWindowOpen('trash-bin')`.
- **Bug #35 — Bulk delete project melaporkan sukses saat parsial gagal:**
  - **Penyebab:** `results.some(Boolean)` mengembalikan `true` jika salah satu delete saja berhasil.
  - **Perbaikan:** Ganti menjadi `results.every(Boolean)`.
- **Bug #36 — Placeholder `legacy-key-*` menyebar ke kolom `r2_key`:**
  - **Penyebab:** Kode fallback saat `poster` kosong menulis string `legacy-key-*` sebagai key.
  - **Perbaikan:** Gunakan string kosong sebagai fallback.
- **Bug #37 — JSON tree `projects` tertulis untuk semua site (cross-tenant pollution):**
  - **Penyebab:** `projectService.createProject` selalu dual-write ke tree global `projects`.
  - **Perbaikan:** Hanya dual-write ke tree global untuk `default-site`; site tenant mengandalkan SQL.
- **Bug #38 — Pengecekan collision slug hanya melihat key pertama:**
  - **Penyebab:** `Object.keys(collisionData)[0] !== id` salah jika ada >1 collision.
  - **Perbaikan:** Gunakan `.some((key) => key !== id)`.
- **Bug #43 — ID project berbasis `Date.now()` rentan collision:**
  - **Penyebab:** Dua create dalam milidetik yang sama bisa menghasilkan ID identik.
  - **Perbaikan:** Tambahkan suffix acak (`crypto.randomUUID()`) pada `generateProjectId`, `narr-*`, dan `media-*`.
- **Bug #44 — Slug rewrite karena collision tidak ter-log:**
  - **Penyebab:** `generateUniqueProjectSlug` bisa mengubah slug secara diam-diam.
  - **Perbaikan:** Tambahkan `console.warn` saat resolved slug berbeda dari input.
- **Bug #48 (serupa) — `setState` di dalam `useEffect` pada admin projects pagination:**
  - **Penyebab:** `useEffect` memanggil `setCurrentPage` saat `totalPages` berubah, memicu cascading render.
  - **Perbaikan:** Gunakan derived `displayPage`; UI selalu render halaman valid tanpa setState tambahan.

## ✅ Verifikasi
- `npx tsc --noEmit`: bersih (no output).
- `npm run lint`: 0 error, 16 warning tersisa (unused vars/imports, bukan bug fungsional).
- `npm test -- --run`: 117 test files, 838 tests PASS.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Low bugs yang masih tersisa dan perlu dilanjutkan: #39–#52, #45, #46, #49–#52, #56–#57. Sebagian berada di `orderService.ts` dan UI OS/desktop.
- Saat melanjutkan, prioritaskan yang memiliki test atau lint error agar verifikasi cepat.
- Jangan lupa update log ini dengan daftar file baru yang disentuh.
