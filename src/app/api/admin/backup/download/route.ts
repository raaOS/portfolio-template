import { NextRequest, NextResponse } from 'next/server';

import { validateAdminRequest } from '@/lib/auth';
import { SITE_ID } from '@/crud/shared/config';
import { getR2Object } from '@/lib/r2Storage';

const BACKUP_PREFIX = `sites/${SITE_ID}/backups/d1/`;

function isValidBackupKey(key: string) {
  if (!key || key.includes('..') || key.includes('\\')) return false;
  return key.startsWith(BACKUP_PREFIX) && key.endsWith('.json');
}

function toWebStream(body: unknown): ReadableStream | null {
  if (!body) return null;

  if (typeof (body as { transformToWebStream?: unknown }).transformToWebStream === 'function') {
    return (body as { transformToWebStream: () => ReadableStream }).transformToWebStream();
  }

  return body as ReadableStream;
}

function getErrorStatus(error: unknown) {
  const candidate = error as { $metadata?: { httpStatusCode?: number }; name?: string };
  if (candidate.$metadata?.httpStatusCode) return candidate.$metadata.httpStatusCode;
  if (candidate.name === 'NoSuchKey' || candidate.name === 'NotFound') return 404;
  return 500;
}

/** GET — unduh satu file backup D1 sebagai attachment. */
export async function GET(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const key = req.nextUrl.searchParams.get('key') || '';
    if (!isValidBackupKey(key)) {
      return NextResponse.json({ error: 'Invalid backup key' }, { status: 400 });
    }

    const object = await getR2Object(key);
    const filename = key.split('/').pop() || 'backup.json';

    return new NextResponse(toWebStream(object.Body), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (getErrorStatus(error) === 404) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    console.error('[API/Admin/Backup/Download] GET error:', error);
    return NextResponse.json({ error: 'Failed to download backup' }, { status: 500 });
  }
}
