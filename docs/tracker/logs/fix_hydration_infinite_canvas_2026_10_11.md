# Tracker Log: Fix Hydration Mismatch Template Infinite Canvas

**Status:** 🟢 Completed
**Mulai:** 2026-10-11
**Selesai:** 2026-10-11

## 🎯 Tujuan (Objective)
- Menghilangkan error "Hydration failed because the server rendered HTML didn't match the client" pada halaman `/preview/infinite-canvas` (Next.js 16.3.6 Webpack).

## 📋 Task List
- [x] Telusuri diff hydration (`backgroundImage`, ikon `Grid2X2` vs `Square`) ke sumber state `gridStyle`
- [x] Pindahkan pembacaan `localStorage` `canvas_grid_style` dari `useState` initializer ke `useEffect` pasca-hydration
- [x] Pindahkan pembacaan `localStorage` `infinite_canvas_admin_positions` dari `useState` initializer ke `useEffect` pasca-hydration (bug kelas sama, memicu mismatch berikutnya pada `left`/`top` kartu proyek)
- [x] Jalankan unit test template (13 lulus), `tsc --noEmit` (bersih), `eslint` file (bersih)

## 📂 File yang Dimodifikasi (Modified Files)
- `src/components/templates/infinite-canvas/InfiniteCanvasRenderer.tsx` -> `gridStyle` & `projectPositions` kini start dari nilai default deterministik; nilai `localStorage` di-sync lewat `useEffect` sekali jalan setelah hydration (`eslint-disable react-hooks/set-state-in-effect`, pola sama dengan `Dock.tsx`/`AdminModal.tsx`).

## 🐛 Bug & Perbaikan (Bug Tracker)
- **Bug 1:** Hydration mismatch pada root div kanvas: server render `background-image: radial-gradient(...)` (default `dots`), client render `background-image: none` (nilai `blank` tersimpan di `localStorage`); ikon kontrol grid juga beda (`Grid2X2` vs `Square`).
  - **Penyebab:** `useState<CanvasGridStyle>(() => { if (typeof window !== 'undefined') ... localStorage.getItem('canvas_grid_style') ... })` — initializer dijalankan server (window undefined → `dots`) dan client (localStorage → `blank`), sehingga HTML berbeda.
  - **Perbaikan:** `InfiniteCanvasRenderer.tsx` — state init `'dots'`, baca `localStorage` di `useEffect([], ...)`.
- **Bug 2 (bug kelas sama, dicegah):** `projectPositions` juga membaca `infinite_canvas_admin_positions` dari `localStorage` di initializer → akan memicu mismatch berikutnya pada inline style `left/top` kartu proyek (terutama untuk admin yang pernah men-drag).
  - **Perbaikan:** init hanya dari data D1 + fallback `SCATTERED_PROJECT_POSITIONS`; overlay posisi lokal di-apply di `useEffect` sekali jalan.

## 📝 Catatan untuk AI Selanjutnya (Handoff Notes)
- Pola wajib untuk state berbasis `localStorage` yang dirender saat SSR: **jangan** baca `localStorage` di `useState` initializer. Init nilai default → sync di `useEffect`. Alternatif: `useSyncExternalStore` dengan `getServerSnapshot` (lihat `useAdminAuth.ts`).
- `CanvasLeftDrawer.tsx` (`canvas_left_notes`) masih pakai initializer + `localStorage`, tapi aman saat ini karena drawer hanya dirender ketika `activePanel` terisi (post-interaction, tidak ikut hydration). Jangan pindahkan ke render awal tanpa mengikuti pola di atas.
