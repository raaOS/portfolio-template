/**
 * Customer Auth — Login API
 * POST /api/auth/login
 * Authenticates admin with email + password, sets JWT cookie.
 */
import { NextResponse } from 'next/server';
import { SITE_ID } from '@/crud/shared/config';
import { authenticateUser, createLoginResponse } from '@/crud/shared/auth/login';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    const result = await authenticateUser(SITE_ID, { email, password });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    return createLoginResponse(result.token!);
  } catch {
    return NextResponse.json({ error: 'Gagal memproses login' }, { status: 500 });
  }
}
