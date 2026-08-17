import { NextRequest, NextResponse } from 'next/server';
import { stickyNotesService } from '@/lib/services/stickyNotesService';
import { stickyNotesBulkSchema } from '@/lib/validations';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
} from '@/lib/admin/siteRequestContext';

function resolveNotesPayload(body: unknown) {
  return body;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const siteId = await resolveRequestSiteId(request);

    const data = await stickyNotesService.getNotes(force, true, siteId);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error loading sticky notes:', error);
    return NextResponse.json({ error: 'Failed to load sticky notes' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const siteId = await resolveRequestSiteId(request, body);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const rateLimit = await enforceRequestRateLimit(
      request,
      `sticky_notes_put:${siteId}`,
      30,
      60_000,
      300_000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const validation = stickyNotesBulkSchema.safeParse(resolveNotesPayload(body));
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid sticky notes payload',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const updatedData = await stickyNotesService.saveNotes(validation.data, siteId);

    await revalidateSiteContentPaths(siteId, ['/']);

    return NextResponse.json({
      success: true,
      data: updatedData,
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating sticky notes:', error);
    return NextResponse.json({ error: 'Failed to update sticky notes' }, { status: 500 });
  }
}
