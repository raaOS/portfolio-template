import { NextRequest, NextResponse } from 'next/server';
import { aboutService } from '@/lib/services/aboutService';
import { invalidateAboutCache } from '@/lib/about';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
} from '@/lib/admin/siteRequestContext';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const siteId = await resolveRequestSiteId(request, body);
    const isAuthenticated = await validateSiteMutationRequest(request, siteId);
    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const { desktopPreferences } = body;

    if (!desktopPreferences) {
      return NextResponse.json({ error: 'desktopPreferences is required' }, { status: 400 });
    }

    await aboutService.updateAboutData(
      {
        desktopPreferences,
      },
      siteId
    );

    invalidateAboutCache();
    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({
      success: true,
      message: 'Desktop preferences saved',
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error saving desktop preferences:', error);
    return NextResponse.json({ error: 'Failed to save desktop preferences' }, { status: 500 });
  }
}
