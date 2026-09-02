import type { NextRequest } from 'next/server';
import { getSiteUserSession } from '@/crud/shared/auth/guard';
import { SITE_ID } from '@/crud/shared/config';

export type SiteMutationActor = { role: 'admin' };

export async function validateSiteMutationRequest(
  request: NextRequest,
  _siteId: string,
  _options: { checkCsrf?: boolean } = {}
): Promise<SiteMutationActor | null> {
  const session = await getSiteUserSession(request);
  if (session && session.siteId === SITE_ID && session.role === 'admin') {
    return { role: 'admin' };
  }
  return null;
}
