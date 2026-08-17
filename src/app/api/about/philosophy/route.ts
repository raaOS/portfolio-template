import { NextRequest, NextResponse } from 'next/server';
import { aboutService } from '@/lib/services/aboutService';
import aboutDataFallback from '@/data/about.json';
import { updateDesignPhilosophySchema } from '@/lib/validations';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

export async function GET(request?: NextRequest) {
  try {
    const siteId = await resolveRequestSiteId(
      request ?? new NextRequest('http://localhost/api/about/philosophy')
    );
    const aboutData = await aboutService.getAboutData(false, false, siteId);
    const philosophy = aboutData.designPhilosophy;

    const result = {
      heading:
        philosophy?.heading || aboutDataFallback.designPhilosophy?.heading || 'Design Philosophy',
      subheading:
        philosophy?.subheading ||
        aboutDataFallback.designPhilosophy?.subheading ||
        'Strategic Thinking Framework',
      workflowSteps:
        philosophy?.workflowSteps || aboutDataFallback.designPhilosophy?.workflowSteps || [],
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to fetch Design Philosophy:', error);
    return NextResponse.json({
      heading: aboutDataFallback.designPhilosophy?.heading || 'Design Philosophy',
      subheading: aboutDataFallback.designPhilosophy?.subheading || 'Strategic Thinking Framework',
      workflowSteps: aboutDataFallback.designPhilosophy?.workflowSteps || [],
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const siteId = await resolveRequestSiteId(request, body);
    if (!(await validateSiteMutationRequest(request, siteId))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    await assertKnownSite(siteId);

    const validation = updateDesignPhilosophySchema.safeParse(stripSiteContext(body));
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid design philosophy payload',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    await aboutService.updateAboutData(
      {
        designPhilosophy: validation.data,
      },
      siteId
    );

    await revalidateSiteContentPaths(siteId, ['/', '/about']);

    return NextResponse.json({
      success: true,
      data: validation.data,
      message: 'Data berhasil disimpan',
    });
  } catch (error) {
    if (error instanceof SiteContextError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to update Design Philosophy:', error);
    return NextResponse.json(
      {
        error: 'Failed to update data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
