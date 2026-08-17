# 01. Current Repo Context

## Arsitektur Repo
Repositori ini adalah **Next.js App Router** (React 19, Next.js 16.2.x, TailwindCSS 3).

## Target Platform
Target produk V6 adalah **full Cloudflare**, bukan Vercel:
- Cloudflare Pages/Workers untuk hosting aplikasi/API.
- Cloudflare D1 sebagai source of truth data relasional multi-tenant.
- Cloudflare R2 sebagai storage media.
- Jangan menambah desain baru yang bergantung pada Vercel project, Vercel Functions, atau quota Vercel.
- Jika menemukan referensi Vercel di kode/dokumen, perlakukan sebagai legacy/migration debt kecuali pengguna secara eksplisit meminta kompatibilitas sementara.

## Batasan Perubahan
UI OS Desktop saat ini sangat kompleks dan merupakan fitur utama produk.
**Jangan pecah atau refactor file-file UI core berikut kecuali diminta:**
- `src/components/os/core/Dock.tsx`
- `src/components/os/windows/Window.tsx`
- `src/components/os/context/OSSystemContext.tsx`
- `src/components/os/core/DesktopEnvironment.tsx`
- `src/components/os/hooks/useJellyDrag.ts`
- `src/components/canvas/InfiniteCanvasView.tsx`

## Status Firebase
Firebase **SUDAH TIDAK DIPAKAI**. Sistem database sepenuhnya bergantung pada Cloudflare D1 (terstruktur) dan Cloudflare R2 (media). 
Semua *leftover* atau *legacy codebase* terkait Firebase harus diabaikan atau dihapus.

## Status Produk Multi-Tenant
Konsep terkunci: platform multi-site dengan `site_id` dan `siteSlug`. Lite dan Pro sama-sama self-service untuk client; perbedaannya ada pada quota, feature flags, workflow, analytics, custom domain, AI, dan fitur kolaborasi.
