# Tracker Log: Phase 2 Safe Refactor — Decoupling Komponen Besar

**Status:** 🟢 Completed
**Mulai:** 2026-09-12
**Selesai:** 2026-09-12

## 🎯 Tujuan (Objective)
Fase kedua program refactor terencana (konsensus GLM 5.3 + Gemini 3.8): dekomposisi 2 file terbesar di daftar terlarang AGENTS.md Section 3 — `Dock.tsx` (1064 baris) dan `AdminExplorerClient.tsx` (890 baris) — tetap dengan **0 behavior change**. Core Dock (magnifikasi/popover/dnd) dan serialisasi WASM FFmpeg dipertahankan sebagai unit utuh sesuai protected cores.

## 📋 Task List
- [x] Task 1: `Dock.tsx` → ekstrak `DockItem`, `GlobalDock`, `OSDock` ke file sendiri; `Dock.tsx` jadi core (re-export wrapper via barrel supaya import path lama valid)
- [x] Task 2: `AdminExplorerClient.tsx` → ekstrak antrean upload & kompresi FFmpeg ke hook `useExplorerUploadQueue` (hook memegang sendiri `compressChainRef` + `currentParentIdRef` + `fileInputRef` sesuai konsensus)
- [x] Verifikasi: tsc 0 error, eslint 0 error/0 warning, 109 files / 821 tests PASS

## 📂 File yang Dimodifikasi (Modified Files)
**Baru:**
- `src/components/os/core/DockItem.tsx` (~310 baris) — inner component: hover physics (spring scale), bounce animation, popover, click/keyboard handlers, view-transition delay. Props-driven (menerima `mouseX` MotionValue via prop; mengukur rect sendiri — tidak memegang ref container).
- `src/components/os/core/GlobalDock.tsx` (~150 baris) — wrapper route non-OS (render via DockPortal; hidden di `/` & `/admin`).
- `src/components/os/core/OSDock.tsx` (~175 baris) — wrapper route OS desktop (window context, item config, isOpen tracking).
- `src/app/admin/projects/explorer/hooks/useExplorerUploadQueue.ts` (~250 baris) — antrean upload: state `activeUploads`, `isUploading`, XHR progress, rollback `cleanupUploadedAssets`, register `/api/explorer` POST, optimistic insert via `setNodes`, `getFileKind`, `UploadResult`/`ActiveUpload` types.

**Dimodifikasi:**
- `src/components/os/core/Dock.tsx` (1064 → ~420 baris) — kini hanya core: `mouseX` motion value, state popover terpusat + tooltip-suppression 1000ms, dnd-kit sensors + admin persist `/api/about` PUT / visitor localStorage, `SortableDockItem`, `sortDockItemsWithLocalOrder`, module flag `isClientHydrated`, glass material + hit-area, arrow-key toolbar navigation. `GlobalDock`/`OSDock` di-re-export dari sini sehingga 2 import path lama (`LayoutClient.tsx`, `UIOverlaysLayer.tsx`) tidak perlu berubah.
- `src/app/admin/projects/explorer/AdminExplorerClient.tsx` (890 → 598 baris) — navigasi folder/history (`historyIndexRef` tetap lokal), CRUD (create/delete/rename/move via `MoveDialog`), `buildMoveTargets`, JSX table. `fetchNodes` kini eksplisit `Promise<void>` (return type) karena dipass ke hook. Semua blok upload pindah ke hook.

## 🐛 Bug & Perbaikan (Bug Tracker)
Tidak ada bug. 1 warning lint (`useRef` unused di hook baru) langsung dibersihkan.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- **Core Dock tetap satu unit** (`Dock.tsx`): `mouseX` sharing, popover timing chain (1000ms suppress, `data-dock-popover-closing`), `LINK_BOUNCE_DELAY_MS` (di `DockItem.tsx`), dnd persist — jangan dipecah lagi.
- **`useExplorerUploadQueue` adalah satu-satunya tempat `compressChainRef` hidup** — serialisasi WASM FFmpeg single-thread. Jangan pisahkan compress chain dari register/rollback; keduanya satu closure unit.
- Jadwal inspeksi visual disarankan (manual QA): hover magnifikasi dock, bounce, drag reorder, popover mode selector — unit test tidak mengcover visual physics. (E2E/Playwright opsional.)
- **Backlog defer tersisa** (tidak dieksekusi, aman ditunda): `Window.tsx` constants/snap hook, `InfiniteCanvasView` fade-math dedup, `OSSystemContext` 3-slice split, `positionSync` split (terkendala 3 dynamic import), `database.ts` helpers, `explorerService` path utils.
- **8 Protected Cores tetap haram disentuh:** core rAF `useJellyDrag`, WASM chain `BackgroundUploadContext`, render loop `InfiniteCanvasView`, store `UnifiedZIndexContext`, singleton gating `SoundManager`, dual-engine transport `MusicPlayerContext`, CAS chain `explorerService`, snap/frame binding `Window.tsx`.
- Setelah sprint refactor ditutup: ~~update AGENTS.md Section 3~~ **SELESAI** — Section 3 sudah ditulis ulang (2026-09-12): 3a Protected Cores (8 inti), 3b Core Dock & Upload Queue, 3c file stabil defer; klaim stale dikoreksi (RHF/Zod → plain useState, dnd-kit → tabel click-driven, Sharp → passthrough stub, ExitIntent → useExitIntent eksternal).
