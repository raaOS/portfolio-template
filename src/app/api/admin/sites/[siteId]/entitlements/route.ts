import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { queryD1 } from '@/lib/cloudflareD1';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await params;
    const body = await request.json();
    const { templateId } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const id = `ent_${siteId}_${templateId}`;
    const now = new Date().toISOString();

    await queryD1(
      `INSERT OR IGNORE INTO site_template_entitlements (id, site_id, template_id, granted_by, created_at)
       VALUES (?, ?, ?, 'master_admin', ?)`,
      [id, siteId, templateId, now]
    );

    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "entitlement", ?)',
      [`audit_${crypto.randomUUID()}`, siteId, `ENTITLEMENT_GRANTED_${templateId}`, now]
    );

    return NextResponse.json({ success: true, message: `Entitlement ${templateId} granted to site ${siteId}` });
  } catch (error) {
    console.error('[AdminEntitlementsPOST] Error:', error);
    return NextResponse.json({ error: 'Failed to grant entitlement' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json({ error: 'templateId query param is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    await queryD1(
      `DELETE FROM site_template_entitlements WHERE site_id = ? AND template_id = ?`,
      [siteId, templateId]
    );

    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "entitlement", ?)',
      [`audit_${crypto.randomUUID()}`, siteId, `ENTITLEMENT_REVOKED_${templateId}`, now]
    );

    return NextResponse.json({ success: true, message: `Entitlement ${templateId} revoked from site ${siteId}` });
  } catch (error) {
    console.error('[AdminEntitlementsDELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to revoke entitlement' }, { status: 500 });
  }
}
