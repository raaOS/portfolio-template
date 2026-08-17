# 06. Frontend Logic Context

## Prinsip Integrasi Data
Jangan campurkan *fetching logic* berat langsung di dalam komponen visual UI.
UI harus menerima data siap pakai.

## Modul Kunci
1. **`masterApiClient.ts`:** Wrapper standar untuk melakukan *fetch* ke Public/Admin API (menghandle token, error standar).
2. **`siteDataAdapter.ts`:** Sumber data tunggal (SOT) untuk halaman public (`/[siteSlug]`).
3. **`projectMapper.ts`:** Bertugas melakukan *mapping* struktur JSON dari endpoint CRUD Master kembali ke bentuk object/prop lama yang diharapkan oleh komponen OS UI. Ini menjaga UI agar tidak pecah/error.

## Aturan Public/Secret
- `NEXT_PUBLIC_API_BASE_URL` adalah variabel publik.
- Secret kredensial admin TIDAK BOLEH terbawa ke *frontend bundle*.
- Gunakan cache atau *stale-while-revalidate* pada Next.js app router fetch untuk data public.
