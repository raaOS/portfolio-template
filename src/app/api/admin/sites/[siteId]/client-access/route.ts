import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateAdminRequest } from '@/lib/auth';
import { queryD1 } from '@/lib/cloudflareD1';
import { hashClientPassword, normalizeClientEmail } from '@/lib/clientAuth';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

export const dynamic = 'force-dynamic';

const clientAccessSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).optional(),
  status: z.enum(['active', 'suspended']).default('active'),
});

type ClientAccessSummaryRow = {
  id: string;
  site_id: string;
  email: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

function sanitizeAccess(row: ClientAccessSummaryRow) {
  return {
    id: row.id,
    siteId: row.site_id,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

async function loadClientAccess(siteId: string) {
  const rows = await queryD1<ClientAccessSummaryRow>(
    `SELECT id, site_id, email, status, created_at, updated_at, last_login_at
     FROM client_access
     WHERE site_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [siteId]
  );
  return rows[0] ? sanitizeAccess(rows[0]) : null;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ siteId: string }> }
) {
  try {
    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await props.params;
    return NextResponse.json({ clientAccess: await loadClientAccess(siteId) });
  } catch (error) {
    console.error('[API Admin Site Client Access GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load client access' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ siteId: string }> }
) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId } = await props.params;
    const siteRows = await queryD1<{ id: string }>(`SELECT id FROM sites WHERE id = ? LIMIT 1`, [
      siteId,
    ]);
    if (!siteRows[0]) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    const rawBody = await request.json().catch(() => ({}));
    const parsed = clientAccessSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid client access payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const email = normalizeClientEmail(parsed.data.email);
    const currentRows = await queryD1<{ id: string }>(
      `SELECT id FROM client_access WHERE site_id = ? AND email = ? LIMIT 1`,
      [siteId, email]
    );
    const current = currentRows[0];

    if (current) {
      const updates = ['status = ?', 'updated_at = ?'];
      const params: Array<string | number | boolean | null> = [parsed.data.status, now];
      if (parsed.data.password) {
        updates.unshift('password_hash = ?');
        params.unshift(hashClientPassword(parsed.data.password));
      }
      params.push(current.id);
      await queryD1(
        `UPDATE client_access SET ${updates.join(', ')} WHERE id = ?`,
        params
      );
    } else {
      if (!parsed.data.password) {
        return NextResponse.json(
          { error: 'Password is required for new client access' },
          { status: 400 }
        );
      }
      await queryD1(
        `INSERT INTO client_access (id, site_id, email, password_hash, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `client-${crypto.randomUUID()}`,
          siteId,
          email,
          hashClientPassword(parsed.data.password),
          parsed.data.status,
          now,
          now,
        ]
      );

      // SECURITY FIX: Revoke all previous client access for this site
      // to prevent old credentials from remaining active after email change.
      const newRow = await queryD1<{ id: string }>(
        `SELECT id FROM client_access WHERE site_id = ? AND email = ? ORDER BY created_at DESC LIMIT 1`,
        [siteId, email]
      );
      if (newRow[0]) {
        await queryD1(
          `UPDATE client_access SET status = 'revoked', updated_at = ? WHERE site_id = ? AND email = ? AND id != ?`,
          [now, siteId, email, newRow[0].id]
        );
      }
    }

    const clientAccess = await loadClientAccess(siteId);
    logOperationalEvent({
      event: 'client_access.save',
      status: 'success',
      request,
      siteId,
      entityType: 'client_access',
      entityId: clientAccess?.id,
      message: 'Client access saved',
      metadata: {
        mode: current ? 'update' : 'create',
        status: parsed.data.status,
        passwordChanged: Boolean(parsed.data.password),
      },
    });

    return NextResponse.json({ clientAccess });
  } catch (error) {
    console.error('[API Admin Site Client Access POST] Error:', error);
    logOperationalEvent({
      event: 'client_access.save',
      level: 'error',
      status: 'failure',
      request,
      message: 'Client access save failed',
      metadata: { error: summarizeError(error) },
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save client access' },
      { status: 500 }
    );
  }
}
