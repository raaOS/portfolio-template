import { NextResponse } from 'next/server';

/**
 * Owner Mode (superadmin) — sakelar identitas deployment.
 *
 * Deployment milik OWNER sendiri (site produksi owner) menjalankan build
 * dengan `OWNER_MODE=true` di `.env.local`. Deployment milik klien SELALU
 * `false` karena pipeline `deployClient()` (`scripts/onboarding/client-deploy.ts`)
 * memaksa `OWNER_MODE` & `NEXT_PUBLIC_OWNER_MODE` = `'false'` di `overrides`
 * (fail-closed: kunci ini juga tidak ada di `INHERITED_OWNER_KEYS`, jadi
 * kedua lapisan membuang/menetralkan nilai owner secara independen).
 *
 * Gunakan guard ini pada route API yang menampilkan/mengelola data bisnis
 * owner (penjualan site, harga jual, dsb.) agar tidak pernah terjangkar di
 * site klien.
 *
 * Catatan klien-vs-server (konvensi Next.js):
 * - `OWNER_MODE`  -> dibaca runtime di route API / komponen server.
 * - `NEXT_PUBLIC_OWNER_MODE` -> ter-inline ke bundle client saat build;
 *   dipakai registry desktop admin untuk menyembunyikan app `ownerOnly`.
 * Keduanya harus selalu di-set bersamaan (lihat `.env.example`).
 */
export function isOwnerMode(): boolean {
  return process.env.OWNER_MODE === 'true';
}

/**
 * Guard route API khusus owner. Return `null` kalau owner mode aktif,
 * atau response 404 kalau tidak.
 *
 * Sengaja 404 (bukan 403): site klien tidak boleh mengonfirmasi keberadaan
 * endpoint ini — seolah route memang tidak ada di sana.
 */
export function requireOwnerMode(): NextResponse | null {
  if (isOwnerMode()) return null;
  return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
}
