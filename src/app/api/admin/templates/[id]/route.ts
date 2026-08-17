import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { queryD1 } from '@/lib/cloudflareD1';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, description, category, tierRequired, priceIdr, isActive, previewImageUrl } = body;

    const now = new Date().toISOString();

    await queryD1(
      `UPDATE portfolio_templates 
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           category = COALESCE(?, category),
           tier_required = COALESCE(?, tier_required),
           price_idr = COALESCE(?, price_idr),
           is_active = COALESCE(?, is_active),
           preview_image_url = COALESCE(?, preview_image_url)
       WHERE id = ?`,
      [
        name,
        description,
        category,
        tierRequired,
        typeof priceIdr === 'number' ? priceIdr : null,
        typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null,
        previewImageUrl,
        id,
      ]
    );

    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, "system", ?, "template", ?)',
      [`audit_${crypto.randomUUID()}`, `TEMPLATE_UPDATED_${id}`, now]
    );

    return NextResponse.json({ success: true, message: `Template ${id} updated` });
  } catch (error) {
    console.error('[AdminTemplatesPUT] Error:', error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}
