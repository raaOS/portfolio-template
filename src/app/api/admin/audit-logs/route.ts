import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { checkAdminAuth } from '@/lib/auth';
import { queryD1, isD1Configured } from '@/lib/cloudflareD1';
import { SITE_ID } from '@/crud/shared/config';

/**
 * GET /api/admin/audit-logs
 *
 * Data aktivitas admin tersimpan di DUA tempat (sejarah migrasi):
 *  1. Blob JSON `app_kv` key "audit_logs" — ditulis oleh logActivity()/
 *     logAdminActivity() via db.ref().push(). Bentuk: map id -> {action, metadata, timestamp}.
 *  2. Tabel relasional `audit_logs` — ditulis jalur provisioning order
 *     (INSERT INTO audit_logs ...). Kolom: id, site_id, action, entity_type, created_at.
 *
 * Reader ini menggabungkan keduanya tanpa menyentuh writer mana pun,
 * sort descending, dan batasi ke 50 entri terakhir.
 */

interface MergedLog {
  id: string;
  action: string;
  timestamp: string;
  source: 'kv' | 'relational';
  entityType?: string;
  metadata?: Record<string, unknown>;
}

const MAX_LOGS = 50;

async function readKvBlob(): Promise<MergedLog[]> {
  const snapshot = await db
    .ref('audit_logs')
    .orderByChild('timestamp')
    .limitToLast(MAX_LOGS)
    .once('value');
  const data = snapshot.val();
  if (!data) return [];

  return Object.keys(data).map((key) => ({
    id: key,
    action: String(data[key]?.action ?? ''),
    timestamp: String(data[key]?.timestamp ?? ''),
    source: 'kv' as const,
    metadata: data[key]?.metadata as Record<string, unknown> | undefined,
  }));
}

async function readRelationalTable(): Promise<MergedLog[]> {
  if (!isD1Configured()) return [];
  try {
    const rows = await queryD1<{
      id: string;
      action: string;
      entity_type: string | null;
      created_at: string;
    }>(
      `SELECT id, action, entity_type, created_at FROM audit_logs WHERE site_id = ? ORDER BY created_at DESC LIMIT ?`,
      [SITE_ID, MAX_LOGS]
    );
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      timestamp: row.created_at,
      source: 'relational' as const,
      entityType: row.entity_type ?? undefined,
    }));
  } catch (error) {
    // Tabel bisa belum ada di deployment lama — jangan gagalkan seluruh viewer.
    console.error('[AuditLogs] Relational table read failed:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const isAuthenticated = checkAdminAuth(request);
    if (!isAuthenticated) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const [kvLogs, relationalLogs] = await Promise.all([readKvBlob(), readRelationalTable()]);

    // Dedup by id (jaga-jaga satu entri tertulis ganda), kv menang karena lebih kaya metadata.
    const seen = new Set<string>();
    const merged: MergedLog[] = [];
    for (const log of [...kvLogs, ...relationalLogs]) {
      if (seen.has(log.id)) continue;
      seen.add(log.id);
      merged.push(log);
    }

    merged.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ logs: merged.slice(0, MAX_LOGS) });
  } catch (error) {
    console.error('[AuditLogs] Error fetching logs:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan internal' }, { status: 500 });
  }
}
