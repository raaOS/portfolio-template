import { NextResponse } from 'next/server';
import { db, getDatabaseBackend } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await db.ref('lastUpdated').once('value');
    return NextResponse.json(
      {
        backend: getDatabaseBackend(),
        lastUpdated: snap.val() || null,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    console.error('[DataVersion] Failed to read lastUpdated:', error);
    return NextResponse.json(
      {
        backend: getDatabaseBackend(),
        lastUpdated: null,
        error: 'Failed to read data version',
      },
      { status: 500 }
    );
  }
}
