import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/security';
import { getClientSessionFromRequest } from '@/lib/clientAuth';
import { CSRF_TOKEN_COOKIE, CSRF_TOKEN_MAX_AGE } from '@/lib/security/constants';
import { getEffectiveSiteQuotaById } from '@/lib/product/siteQuota';
import { getPlanFeatures } from '@/lib/product/sitePlan';
import { getSiteStorageUsageSafe } from '@/lib/product/siteStorageUsage';
import { queryD1 } from '@/lib/cloudflareD1';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getClientSessionFromRequest(request);
  let csrfToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

  if (!csrfToken || csrfToken.length !== 64) {
    csrfToken = generateCSRFToken();
  }

  const responseBody: Record<string, unknown> = {
    authenticated: Boolean(session),
    csrfToken,
  };

  if (session) {
    const [projectCountRows, storage, quota] = await Promise.all([
      queryD1<{ count: number }>(`SELECT COUNT(*) as count FROM projects WHERE site_id = ?`, [
        session.siteId,
      ]),
      getSiteStorageUsageSafe(session.siteId),
      getEffectiveSiteQuotaById({ siteId: session.siteId, plan: session.plan }),
    ]);
    responseBody.client = {
      email: session.email,
      site: {
        id: session.siteId,
        slug: session.siteSlug,
        name: session.siteName,
        plan: session.plan,
        status: session.siteStatus,
        quota,
        features: getPlanFeatures(session.plan),
        usage: {
          projects: Number(projectCountRows[0]?.count || 0),
          storage,
        },
      },
    };
  }

  const response = NextResponse.json(responseBody);
  response.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CSRF_TOKEN_MAX_AGE,
    path: '/',
  });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
