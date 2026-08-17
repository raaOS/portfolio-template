import type { NextRequest } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { validateClientRequest, type ClientSession } from '@/lib/clientAuth';

export type SiteMutationActor =
  | { role: 'admin' }
  | { role: 'client'; session: ClientSession };

export async function validateSiteMutationRequest(
  request: NextRequest,
  siteId: string,
  options: { checkCsrf?: boolean } = {}
): Promise<SiteMutationActor | null> {
  if (await validateAdminRequest(request, options)) {
    return { role: 'admin' };
  }

  const clientSession = await validateClientRequest(request, {
    checkCsrf: options.checkCsrf,
    siteId,
  });

  if (!clientSession) return null;
  return { role: 'client', session: clientSession };
}
