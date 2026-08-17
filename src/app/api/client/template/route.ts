import { NextRequest, NextResponse } from 'next/server';
import { getClientSessionFromRequest } from '@/lib/clientAuth';
import { templateRegistryService } from '@/lib/services/templateRegistryService';
import { queryD1 } from '@/lib/cloudflareD1';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getClientSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const templates = await templateRegistryService.getAllTemplates();
    const siteRows = await queryD1<{ active_template_key?: string }>(
      'SELECT active_template_key FROM sites WHERE id = ? LIMIT 1',
      [session.siteId]
    );

    const activeKey = siteRows[0]?.active_template_key || 'os-desktop';

    const items = await Promise.all(
      templates.map(async (tpl) => {
        const isEntitled = await templateRegistryService.canSiteUseTemplate(
          session.siteId,
          session.plan,
          tpl.id
        );
        return {
          ...tpl,
          isEntitled,
          isActive: tpl.id === activeKey,
        };
      })
    );

    return NextResponse.json({ templates: items, activeKey });
  } catch (error) {
    console.error('[ClientTemplateAPI GET] Error:', error);
    return NextResponse.json({ error: 'Gagal memuat katalog template' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getClientSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Tidak terotentikasi' }, { status: 401 });
    }

    const body = await request.json();
    const { templateId } = body;

    if (!templateId || typeof templateId !== 'string') {
      return NextResponse.json({ error: 'Template ID wajib diisi' }, { status: 400 });
    }

    const isEntitled = await templateRegistryService.canSiteUseTemplate(
      session.siteId,
      session.plan,
      templateId
    );

    if (!isEntitled) {
      return NextResponse.json(
        { error: 'Situs Anda tidak memiliki lisensi untuk menggunakan template ini.' },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    await queryD1('UPDATE sites SET active_template_key = ?, updated_at = ? WHERE id = ?', [
      templateId,
      now,
      session.siteId,
    ]);

    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "site", ?)',
      [`audit_${crypto.randomUUID()}`, session.siteId, `TEMPLATE_ACTIVATED_${templateId}`, now]
    );

    return NextResponse.json({
      success: true,
      message: `Template ${templateId} berhasil diaktifkan.`,
      activeTemplateKey: templateId,
    });
  } catch (error) {
    console.error('[ClientTemplateAPI POST] Error:', error);
    return NextResponse.json({ error: 'Gagal memperbarui template aktif' }, { status: 500 });
  }
}
