import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { templateRegistryService } from '@/lib/services/templateRegistryService';
import { queryD1 } from '@/lib/cloudflareD1';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const templates = await templateRegistryService.getAllTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[AdminTemplatesGET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, description, category, tierRequired, priceIdr, previewImageUrl } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'ID and Name are required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await queryD1(
      `INSERT INTO portfolio_templates (id, name, description, category, tier_required, price_idr, is_active, preview_image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id.toLowerCase().trim(),
        name.trim(),
        description || '',
        category || 'landing',
        tierRequired || 'lite',
        typeof priceIdr === 'number' ? priceIdr : 0,
        previewImageUrl || null,
        now,
      ]
    );

    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, "system", ?, "template", ?)',
      [`audit_${crypto.randomUUID()}`, `TEMPLATE_CREATED_${id}`, now]
    );

    return NextResponse.json({ success: true, message: `Template ${id} created` });
  } catch (error) {
    console.error('[AdminTemplatesPOST] Error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
