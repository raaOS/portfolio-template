import type { NextRequest } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';

export type SiteMutationActor = { role: 'admin' };

export async function validateSiteMutationRequest(
  request: NextRequest,
  _siteId: string,
  options: { checkCsrf?: boolean } = {}
): Promise<SiteMutationActor | null> {
  if (await validateAdminRequest(request, options)) {
    return { role: 'admin' };
  }
  return null;
}
