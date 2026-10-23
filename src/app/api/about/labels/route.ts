import { NextRequest, NextResponse } from 'next/server';
import { ContentService } from '@/lib/services/contentService';
import labelsFallback from '@/data/labels.json';
import { Label } from '@/types/labels';
import { z } from 'zod';
import { validationError } from '@/lib/api-response';
import { validateSiteMutationRequest } from '@/lib/admin/siteMutationAuth';
import {
  assertKnownSite,
  revalidateSiteContentPaths,
  resolveRequestSiteId,
  SiteContextError,
  stripSiteContext,
} from '@/lib/admin/siteRequestContext';

const labelSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  color: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

const labelsArraySchema = z.array(labelSchema).max(200);

const service = new ContentService<Label[]>('labels.json', labelsFallback as Label[]);

async function getLabels(siteId = 'default-site') {
  return await service.getData(false, false, siteId);
}

async function saveLabels(data: Label[], siteId = 'default-site') {
  return await service.saveData(data, 'Update labels', siteId);
}

function resolveLabelsPayload(body: unknown) {
  if (Array.isArray(body)) return body;
  if (body && typeof body === 'object' && !Array.isArray(body) && Array.isArray((body as { labels?: unknown }).labels)) {
    return (body as { labels: unknown[] }).labels;
  }
  return stripSiteContext(body);
}

export async function GET(request?: NextRequest) {
  try {
    const siteId = await resolveRequestSiteId(
      request ?? new NextRequest('http://localhost/api/about/labels')
    );
    const labels = await getLabels(siteId);
    return NextResponse.json(labels);
  } catch (_error) {
    if (_error instanceof SiteContextError) {
      return NextResponse.json({ error: _error.message }, { status: _error.status });
    }
    console.error('Failed to fetch labels:', _error);
    return NextResponse.json({ error: 'Failed to fetch labels' }, { status: 500 });
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

    const validation = labelsArraySchema.safeParse(resolveLabelsPayload(body));
    if (!validation.success) {
      return validationError(validation.error);
    }

    const saved = await saveLabels(validation.data, siteId);
    if (!saved) {
      throw new Error('ContentService failed to save labels');
    }

    await revalidateSiteContentPaths(siteId, ['/']);

    return NextResponse.json({ success: true, data: validation.data });
  } catch (_error) {
    if (_error instanceof SiteContextError) {
      return NextResponse.json({ error: _error.message }, { status: _error.status });
    }
    console.error('Failed to update labels:', _error);
    return NextResponse.json({ error: 'Failed to update labels' }, { status: 500 });
  }
}
