import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { SITE_ID } from '@/crud/shared/config';
import { queryD1 } from '@/lib/cloudflareD1';
import type { ActiveTemplateKey } from '@/app/admin/desktop/templateScope';

/**
 * GET /api/admin/site-template
 *
 * Membaca `sites.active_template_key` deployment ini untuk desktop admin:
 * app CRUD yang `templateScope`-nya tidak mencakup template aktif disaring
 * keluar secara runtime (lihat `src/app/admin/desktop/templateScope.ts`).
 *
 * Auth: admin-only (validateAdminRequest). Read-only → tanpa CSRF.
 *
 * FAIL-OPEN: kegagalan D1 membalas `activeTemplateKey: null` (HTTP 200) —
 * klien desktop menampilkan SEMUA app bila template tidak diketahui.
 * Jangan pernah menyembunyikan CRUD karena error sesaat.
 */
export async function GET(request: NextRequest) {
  const isValid = await validateAdminRequest(request, { checkCsrf: false });
  if (!isValid) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let activeTemplateKey: ActiveTemplateKey | null = null;
  try {
    const rows = await queryD1<{ active_template_key: string | null }>(
      'SELECT active_template_key FROM sites WHERE id = ? LIMIT 1',
      [SITE_ID]
    );
    const raw = rows[0]?.active_template_key;
    if (
      raw === 'os-desktop' ||
      raw === 'infinite-canvas' ||
      raw === 'spatial-gallery'
    ) {
      activeTemplateKey = raw;
    }
  } catch (error) {
    console.error('[site-template] Gagal membaca active_template_key (fail-open):', error);
  }

  return NextResponse.json(
    { success: true, activeTemplateKey },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
