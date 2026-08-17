import { NextRequest, NextResponse } from 'next/server';
import { hardSkillService } from '@/lib/services/hardSkillService';
import { updateHardSkillSchema } from '@/lib/validations';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

// PUT - update hard skill
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const siteId = await resolveRequestSiteId(request, body);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validation = updateHardSkillSchema.safeParse(stripSiteContext(body));
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid hard skill payload',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const updatedSkill = await hardSkillService.updateHardSkill(id, validation.data, siteId);

    if (!updatedSkill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Revalidate setelah sukses update agar halaman ISR /about fresh
    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true, skill: updatedSkill });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating hard skill:', error);
    return NextResponse.json({ error: 'Failed to update hard skill' }, { status: 500 });
  }
}

// DELETE - delete hard skill
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const siteId = await resolveRequestSiteId(request);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const success = await hardSkillService.deleteHardSkill(id, siteId);

    if (!success) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting hard skill:', error);
    return NextResponse.json({ error: 'Failed to delete hard skill' }, { status: 500 });
  }
}
