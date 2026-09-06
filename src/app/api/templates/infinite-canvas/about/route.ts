import { NextRequest, NextResponse } from 'next/server';
import { aboutService } from '@/lib/services/aboutService';
import { invalidateAboutCache } from '@/lib/about';
import { updateAboutSchema } from '@/lib/validations';
import { validationError } from '@/lib/api-response';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';
import { UpdateAboutData } from '@/types/about';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const fresh = request.nextUrl.searchParams.get('fresh') === 'true';
    const siteId = await resolveRequestSiteId(request);
    const data = await aboutService.getAboutData(fresh, true, siteId);
    return NextResponse.json(data);
  } catch (error) {
    console.error(
      '[API/Templates/Infinite-Canvas/About] Error:',
      error instanceof Error ? error.message : error
    );
    return NextResponse.json({ error: 'Failed to load about data' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const siteId = await resolveRequestSiteId(request, rawBody);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validationResult = updateAboutSchema.safeParse(stripSiteContext(rawBody));
    if (!validationResult.success) {
      return validationError(validationResult.error);
    }

    const updates: UpdateAboutData = validationResult.data;
    const updatedData = await aboutService.updateAboutData(updates, siteId);

    invalidateAboutCache();
    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true, data: updatedData });
  } catch (error: unknown) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/Templates/Infinite-Canvas/About] Update Error:', error);
    return NextResponse.json(
      { error: 'Failed to update about data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
