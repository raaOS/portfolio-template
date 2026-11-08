import { NextRequest, NextResponse } from 'next/server';

import { validateAdminRequest } from '@/lib/auth';
import { isD1Configured } from '@/lib/cloudflareD1';
import { isR2StorageConfigured } from '@/lib/r2Storage';
import { BACKUP_KEEP_COUNT, createD1Backup, listD1Backups } from '@/lib/services/d1BackupService';

export const maxDuration = 60;

/** GET — daftar backup yang tersimpan (read-only, tanpa CSRF). */
export async function GET(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const r2Configured = isR2StorageConfigured();

    return NextResponse.json({
      // Deferred R2 (v1.3.78): tanpa R2, `listD1Backups` akan melempar error
      // S3 fallback — jawab daftar kosong, bukan 500 mentah.
      backups: r2Configured ? await listD1Backups() : [],
      keepCount: BACKUP_KEEP_COUNT,
      d1Configured: isD1Configured(),
      r2Configured,
    });
  } catch (error) {
    console.error('[API/Admin/Backup] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list backups' },
      { status: 500 }
    );
  }
}

/** POST — jalankan backup manual sekarang (admin + CSRF). */
export async function POST(req: NextRequest) {
  try {
    if (!(await validateAdminRequest(req))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }

    const result = await createD1Backup();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[API/Admin/Backup] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Backup failed' },
      { status: 500 }
    );
  }
}
