# 06. Frontend Logic Context

## Prinsip Integrasi Data
Jangan campurkan *fetching logic* berat langsung di dalam komponen visual UI.
UI harus menerima data siap pakai.

## Modul Kunci
1. **`src/lib/api-client.ts` (`unwrapApiPayload`):** Helper kecil untuk membongkar payload respons API bersarang (`{ success, data }`) — dipakai konsumen seperti `useChatProjects`.
2. **Hook `useAdmin*` (`src/app/admin/hooks/`):** Lapisan fetch panel admin ke endpoint `/api/*` (loading/error state, header CSRF via `src/lib/security/client-csrf.ts`). (Modul lama `masterApiClient.ts` sudah tidak ada.)
3. **`siteDataAdapter.ts`:** Sumber data tunggal (SOT) untuk halaman public (`/[siteSlug]`), membaca langsung D1 lewat `queryD1`.
4. **`projectMapper.ts`:** Bertugas melakukan *mapping* struktur baris SQL D1 (`ProjectSqlRow`, narasi, media) kembali ke bentuk object/prop lama yang diharapkan oleh komponen OS UI. Ini menjaga UI agar tidak pecah/error.

## Aturan Public/Secret
- `NEXT_PUBLIC_API_BASE_URL` adalah variabel publik.
- Secret kredensial admin TIDAK BOLEH terbawa ke *frontend bundle*.
- Gunakan cache atau *stale-while-revalidate* pada Next.js app router fetch untuk data public.
