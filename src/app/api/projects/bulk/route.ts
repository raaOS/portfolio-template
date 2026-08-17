import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { validateAdminRequest } from '@/lib/auth';
import { projectSqlService } from '@/lib/services/project/projectSqlService';
import { resolveProjectSiteId } from '@/lib/admin/projectSiteContext';
import { revalidateSiteProjectPaths } from '@/lib/admin/siteRequestContext';

export async function POST(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ids } = body;
    const siteId = resolveProjectSiteId(request, body);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No project IDs provided' }, { status: 400 });
    }

    let success = false;

    if (action === 'delete') {
      success = await projectSqlService.bulkUpdateProjectsSql(siteId, { ids, delete: true });
    } else if (action === 'publish' || action === 'draft') {
      success = await projectSqlService.bulkUpdateProjectsSql(siteId, {
        ids,
        status: action === 'publish' ? 'published' : 'draft',
      });
    } else if (action === 'reorder') {
      success = await projectSqlService.bulkUpdateProjectsSql(siteId, { ids, reorder: true });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!success) {
      return NextResponse.json({ error: 'Failed to perform bulk update' }, { status: 500 });
    }

    await revalidateSiteProjectPaths(siteId);
    revalidatePath('/admin');

    return NextResponse.json({ success: true, message: `Bulk ${action} successful` });
  } catch (error) {
    console.error('[BulkUpdate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
