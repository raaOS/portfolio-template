import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { requireOwnerMode } from '@/lib/ownerMode';
import { templateEntitlementsService } from '@/lib/services/templateEntitlementsService';
import { queryD1 } from '@/crud/shared/db/connection';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await params;
    const body = await request.json();
    const { templateId, price } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const template = await templateEntitlementsService.getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const entitlement = await templateEntitlementsService.grantEntitlement(siteId, templateId, {
      price: price ?? template.price,
      grantedBy: 'master_admin',
    });

    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "entitlement", datetime(\'now\'))',
      [`audit_${crypto.randomUUID()}`, siteId, `ENTITLEMENT_GRANTED_${templateId}`]
    );

    return NextResponse.json({ success: true, entitlement });
  } catch (error) {
    console.error('[AdminEntitlementsPOST] Error:', error);
    return NextResponse.json({ error: 'Failed to grant entitlement' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    if (!templateId) {
      return NextResponse.json({ error: 'templateId query param is required' }, { status: 400 });
    }

    const revoked = await templateEntitlementsService.revokeEntitlement(siteId, templateId);

    if (!revoked) {
      return NextResponse.json({ error: 'Entitlement not found' }, { status: 404 });
    }

    await queryD1(
      'INSERT INTO audit_logs (id, site_id, action, entity_type, created_at) VALUES (?, ?, ?, "entitlement", datetime(\'now\'))',
      [`audit_${crypto.randomUUID()}`, siteId, `ENTITLEMENT_REVOKED_${templateId}`]
    );

    return NextResponse.json({ success: true, message: `Entitlement ${templateId} revoked from site ${siteId}` });
  } catch (error) {
    console.error('[AdminEntitlementsDELETE] Error:', error);
    return NextResponse.json({ error: 'Failed to revoke entitlement' }, { status: 500 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;
    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await params;
    const entitlements = await templateEntitlementsService.getSiteEntitlements(siteId);

    return NextResponse.json({ entitlements });
  } catch (error) {
    console.error('[AdminEntitlementsGET] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch entitlements' }, { status: 500 });
  }
}
