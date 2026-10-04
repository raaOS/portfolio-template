import { NextRequest, NextResponse } from 'next/server';
import { getSiteBySlug } from '@/lib/adapters/siteDataAdapter';
import { getEffectiveSiteQuotaById } from '@/lib/product/siteQuota';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ siteSlug: string }> }) {
  try {
    const params = await props.params;
    const { siteSlug } = params;
    const site = await getSiteBySlug(siteSlug);

    if (!site || site.status !== 'active') {
      return NextResponse.json(
        { ok: false, error: { code: 'SITE_NOT_FOUND', message: 'Site not found' } },
        { status: 404 }
      );
    }

    const quota = await getEffectiveSiteQuotaById({ siteId: site.id });
    const config = {
      features: {
        ai: process.env.FEATURE_AI === 'true',
        notifications: process.env.FEATURE_NOTIFICATIONS === 'true',
        customDomain: process.env.FEATURE_CUSTOM_DOMAIN === 'true',
        analytics: process.env.FEATURE_ANALYTICS === 'true',
      },
      quota,
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error('[API Public Config GET] Error:', error);
    return NextResponse.json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
