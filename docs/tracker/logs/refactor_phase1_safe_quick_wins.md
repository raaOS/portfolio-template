# Tracker Log: Phase 1 Safe Refactor — Zero-Risk Quick Wins

**Status:** 🟢 Completed
**Mulai:** 2026-09-12
**Selesai:** 2026-09-12

## 🎯 Tujuan (Objective)
Fase pertama program refactor terencana (konsensus AI GLM 5.3 + Gemini 3.8, lihat diskusi di bawah): pangkas 4 file terlarang di AGENTS.md Section 3 melalui ekstraksi murni (constants/types/helpers/sub-komponen) **tanpa mengubah satu behavior pun**. Semua protected cores (8 inti) tidak tersentuh.

**Konteks konsensus:**
- Analisa penuh 24 file terlarang (100% baris dibaca) menghasilkan klasifikasi: SAFE-SPLIT / PARTIAL-SPLIT / NO-SPLIT.
- Dua AI berdebat lalu konvergen 100% pada: (1) Rule of Scale "< 450 baris & kohesif = tidak jadi target", (2) 8 Protected Cores tidak boleh disentuh, (3) AGENTS.md banyak klaim stale (RHF/Zod di DesignPhilosophyForm, dnd-kit di AdminExplorerClient, Sharp aktif di upload route — semua sudah tidak sesuai kode riil).
- 5 guard eksekusi: barrel `positionSync` (3 dynamic import), static imports only di upload route, jaga nama export stub legacy, error-class→status mapping verbatim, prosedur wajib tracker/CHANGELOG/test.

## 📋 Task List
- [x] Task 1: `viewport.ts` — dedup `getViewport()` dari 4 file → modul bersama
- [x] Task 2: `DesignPhilosophyForm.tsx` — ekstrak constants (DEFAULT_WORKFLOW_STEPS, AVAILABLE_ICONS, COLORS) + dedup tipe lokal ke kanonik `@/types/about`
- [x] Task 3: `ExitIntentFeedback.tsx` — ekstrak `FeedbackEyeIcon` (Lottie) + session helpers
- [x] Task 4: `upload/route.ts` — ekstrak helpers murni (sanitize, ICNS, ext map, scoping, error class) ke `src/lib/media/uploadHelpers.ts`
- [x] Verifikasi: tsc 0 error, eslint 0 error/warning, 109 files / 821 tests PASS

## 📂 File yang Dimodifikasi (Modified Files)
**Baru:**
- `src/components/os/utils/viewport.ts` — SSR-safe `getViewport()` single source of truth (fallback 1440x900)
- `src/constants/designPhilosophy.ts` — constants UI Design Philosophy (219 baris)
- `src/components/os/ui/FeedbackEyeIcon.tsx` — komponen Lottie mata (71 baris)
- `src/components/os/ui/exitIntentSession.ts` — session flags + clientId + device detect (78 baris)
- `src/lib/media/uploadHelpers.ts` — helpers murni upload pipeline (142 baris)

**Dimodifikasi:**
- `src/components/os/utils/positionSync.ts` (369→321) — pakai `getViewport` dari `./viewport`; `getCurrentViewport` lokal dihapus. **Path module & seluruh export names tetap utuh** (guard 3 dynamic import: `useWindowPersistence.ts:148`, `useStickyNotes.ts:~400`, `useDesktopLayout.ts:137`; stub legacy `loadSessionPositions`/`clearVisitorPositions` tetap diekspor)
- `src/components/os/hooks/window-manager/useWindowActions.ts` (368→364) — import `getViewport` bersama
- `src/components/os/hooks/window-manager/useWindowInitialization.ts` (143→139) — idem
- `src/components/os/hooks/useStickyNotes.ts` (457→401) — import bersama + 1 inline viewport duplikat di load effect diganti
- `src/components/admin/about/DesignPhilosophyForm.tsx` (765→497) — tipe lokal `SubStep`/`WorkflowStep`/`DesignPhilosophyData` diganti tipe kanonik `@/types/about` (`WorkflowSubStep`/`WorkflowStep`/`DesignPhilosophy`); constants pindah
- `src/components/os/ui/ExitIntentFeedback.tsx` (504→339) — session flags & Lottie icon kini di modul terpisah; `markFeedbackShown`/`markFeedbackSent` menggantikan try/catch inline (behavior identik)
- `src/app/api/admin/upload/route.ts` (791→585) — helpers murni pindah ke `src/lib/media/uploadHelpers.ts`; POST/DELETE handler, pipeline sequential, dan error mapping (SiteContextError→e.status, WallpaperImageTooSmallError→413) tidak berubah; static imports only

## 🐛 Bug & Perbaikan (Bug Tracker)
Tidak ada bug diperbaiki — fase ini murni ekstraksi non-behavioral. (Koreksi kecil: `assertWallpaperImageDimensions` versi lama sudah no-op sejak migrasi Cloudflare; versi helper baru mempertahankan kontrak yang sama.)

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Fase 2 (belum dieksekusi, sudah disepakati):** `Dock.tsx` → ekstrak `GlobalDock`/`OSDock`/`DockItem` (props-driven, terverifikasi); `AdminExplorerClient.tsx` → ekstrak antrean upload ke `useExplorerUploadQueue` dengan syarat hook memegang sendiri `compressChainRef` + `currentParentIdRef`.
- **Backlog defer:** `Window.tsx` (constants/snap hook), `InfiniteCanvasView` (dedup fade-math), `OSSystemContext` (3 slice independen — aman tapi YAGNI), `infiniteCanvasEngine`, `useWindowActions` split, `database.ts` helpers, `positionSync` split.
- **8 Protected Cores (haram disentuh):** core rAF `useJellyDrag`, WASM chain `BackgroundUploadContext`, render loop `InfiniteCanvasView`, store `UnifiedZIndexContext`, singleton gating `SoundManager`, dual-engine transport `MusicPlayerContext`, CAS chain `explorerService`, snap/frame binding `Window.tsx`.
- **Penting:** jangan pecah `positionSync.ts` lebih jauh selama 3 dynamic import masih menarget path module itu; jika split diperlukan, wajib jadikan path lama barrel re-export.
- **AGENTS.md Section 3 masih stale** — update klaim (RHF/Zod, dnd-kit, Sharp) direncanakan sebagai penutup sprint refactor (setelah Fase 2), dengan alasan terverifikasi.
