import { NextRequest, NextResponse } from 'next/server';
import { getClientSessionFromRequest, validateClientRequest } from '@/lib/clientAuth';
import { queryD1 } from '@/lib/cloudflareD1';
import {
  templateSettingsService,
  getBentoSettings,
  saveBentoSettings,
} from '@/lib/services/templateSettingsService';
import { bentoSettingsInputSchema, normalizeBentoSettings } from '@/lib/templates/bento/settings';
import { revalidateSiteContentPaths } from '@/lib/admin/siteRequestContext';

export const dynamic = 'force-dynamic';

/**
 * GET: Mengambil settings kustomisasi untuk template aktif site client.
 * Mengembalikan payload mentah + flag `canCustomize` (Pro only).
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getClientSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const siteRows = await queryD1<{ active_template_key?: string }>(
      'SELECT active_template_key FROM sites WHERE id = ? LIMIT 1',
      [session.siteId]
    );
    const templateId = siteRows[0]?.active_template_key || 'os-desktop';

    const settings = await templateSettingsService.getSettings(session.siteId, templateId);

    return NextResponse.json({
      templateId,
      settings: settings?.options ?? null,
      plan: session.plan,
      canCustomize: session.plan === 'pro',
    });
  } catch (error) {
    console.error('[ClientTemplateSettings GET] Error:', error);
    return NextResponse.json({ error: 'Gagal memuat pengaturan template' }, { status: 500 });
  }
}

/**
 * PUT: Menyimpan settings kustomisasi template Bento (Pro only).
 * Body: { settings: { theme?, motion?, sections? } } — parsial diterima,
 * hasil akhir selalu dinormalisasi sebelum ditulis ke D1.
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Tidak terotentikasi atau CSRF tidak valid' }, { status: 401 });
    }

    if (session.plan !== 'pro') {
      return NextResponse.json(
        { error: 'Kustomisasi template hanya tersedia untuk paket Pro.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = bentoSettingsInputSchema.safeParse(body?.settings);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Format pengaturan tidak valid', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const current = await getBentoSettings(session.siteId);
    const next = normalizeBentoSettings({
      theme: { ...current.theme, ...(parsed.data.theme ?? {}) },
      motion: { ...current.motion, ...(parsed.data.motion ?? {}) },
      sections: parsed.data.sections ?? current.sections,
    });

    const saved = await saveBentoSettings(session.siteId, next);
    if (!saved) {
      return NextResponse.json({ error: 'Gagal menyimpan pengaturan template' }, { status: 500 });
    }

    await revalidateSiteContentPaths(session.siteId, ['/']);

    const now = new Date().toISOString();
    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "site", ?)',
      [`audit_${crypto.randomUUID()}`, session.siteId, 'TEMPLATE_SETTINGS_UPDATED_landing-bento', now]
    );

    return NextResponse.json({ success: true, settings: next });
  } catch (error) {
    console.error('[ClientTemplateSettings PUT] Error:', error);
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan template' }, { status: 500 });
  }
}
