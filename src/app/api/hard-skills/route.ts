import { NextRequest, NextResponse } from 'next/server';
import { hardSkillService } from '@/lib/services/hardSkillService';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { bulkUpdateHardSkillsSchema } from '@/lib/validations';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
} from '@/lib/admin/siteRequestContext';

function resolveSkillsPayload(body: unknown) {
  return body;
}

export async function GET(request: NextRequest) {
  try {
    const siteId = await resolveRequestSiteId(request);
    const data = await hardSkillService.getHardSkills(false, false, siteId);
    return NextResponse.json(data.skills);
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error loading hard skills:', error);
    return NextResponse.json({ error: 'Failed to load hard skills' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const siteId = await resolveRequestSiteId(request, body);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const rateLimit = await enforceRequestRateLimit(
      request,
      `hard_skills_post:${siteId}`,
      5,
      60_000,
      300_000
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const validation = bulkUpdateHardSkillsSchema.safeParse(resolveSkillsPayload(body));
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid hard skills payload',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const skills = validation.data;
    const success = await hardSkillService.saveHardSkills(
      skills,
      'Bulk update via Admin API',
      siteId
    );

    if (!success) {
      return NextResponse.json({ error: 'Failed to save skills' }, { status: 500 });
    }

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({ success: true, count: skills.length });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error saving hard skills:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
