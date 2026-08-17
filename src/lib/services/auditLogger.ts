/**
 * Audit Logger — Mencatat aktivitas admin (login, CRUD, password change) ke D1.
 *
 * Log disimpan di tabel `audit_logs` dengan metadata IP, user-agent, dan timestamp.
 * Kegagalan logging tidak memblokir operasi utama (non-blocking, fire-and-forget).
 *
 * @module auditLogger
 */
import { db } from '@/lib/database';
import type { NextRequest } from 'next/server';

export interface AuditLog {
  id?: string;
  action: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Logs an administrative activity to the database.
 * Uses Cloudflare D1 via the database wrapper.
 */
export async function logActivity(
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const payload: AuditLog = {
      action,
      metadata,
      timestamp: new Date().toISOString(),
    };

    // push() generates a unique ID and saves the payload
    await db.ref('audit_logs').push(payload);
  } catch (error) {
    console.error('[AuditLogger] Failed to log activity:', error);
  }
}

function getRequestPath(request: Request | NextRequest) {
  const nextUrl = (request as NextRequest).nextUrl;
  if (nextUrl?.pathname) return nextUrl.pathname;

  try {
    return new URL(request.url).pathname;
  } catch {
    return request.url || 'unknown';
  }
}

function getRequestMetadata(request: Request | NextRequest): Record<string, unknown> {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor || realIp || 'unknown';

  return {
    method: request.method,
    path: getRequestPath(request),
    ip,
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

export async function logAdminActivity(
  request: Request | NextRequest,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await logActivity(action, {
    category: 'admin',
    ...getRequestMetadata(request),
    ...metadata,
  });
}
