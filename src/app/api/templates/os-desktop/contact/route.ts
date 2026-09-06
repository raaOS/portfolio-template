import { NextRequest, NextResponse } from 'next/server';
import type { UpdateContactData } from '@/types/contact';
import { getContactData, updateContactData } from '@/lib/contact';
import { updateContactSchema } from '@/lib/validations';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const fresh = request.nextUrl.searchParams.get('fresh') === 'true';
    const siteId = await resolveRequestSiteId(request);
    const data = await getContactData(fresh, siteId);
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/Templates/OS-Desktop/Contact] Error:', error);
    return NextResponse.json({ error: 'Failed to load contact data' }, { status: 500 });
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

    const validation = updateContactSchema.safeParse(stripSiteContext(rawBody));
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid contact payload', details: validation.error.issues },
        { status: 400 }
      );
    }

    const body: UpdateContactData = validation.data as UpdateContactData;
    const updatedData = await updateContactData(body, siteId);

    await revalidateSiteContentPaths(siteId, ['/', '/contact']);

    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[API/Templates/OS-Desktop/Contact] Update Error:', error);

    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    if (error instanceof TypeError) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 422 });
    }
    if (error && typeof error === 'object' && 'code' in error) {
      const dataError = error as { code: string; message: string };
      if (dataError.code === 'PERMISSION_DENIED') {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
      if (dataError.code === 'NETWORK_ERROR') {
        return NextResponse.json({ error: 'Database connection failed' }, { status: 503 });
      }
    }

    return NextResponse.json({ error: 'Failed to update contact data' }, { status: 500 });
  }
}
