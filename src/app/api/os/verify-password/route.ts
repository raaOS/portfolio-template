import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/database';
import { generateCSRFToken, validateCSRFToken, verifyStoredPassword } from '@/lib/security';
import { CSRF_TOKEN_MAX_AGE } from '@/lib/security/constants';
import { enforceRequestRateLimit } from '@/lib/security/request';

const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = 5 * 60 * 1000;
const VERIFY_BLOCK_MS = 15 * 60 * 1000;

interface OsSettings {
  passwordHash?: string;
  passwordSalt?: string;
  passwordAlgorithm?: 'sha256' | 'scrypt';
}

function hasStoredPasswordConfig(
  settings: OsSettings
): settings is OsSettings & { passwordHash: string } {
  return (
    typeof settings.passwordHash === 'string' &&
    (settings.passwordAlgorithm === undefined ||
      settings.passwordAlgorithm === 'sha256' ||
      settings.passwordAlgorithm === 'scrypt') &&
    (settings.passwordSalt === undefined || typeof settings.passwordSalt === 'string')
  );
}

function unauthorizedResponse() {
  return NextResponse.json({ success: false, message: 'Invalid password' }, { status: 401 });
}

export async function GET() {
  const token = generateCSRFToken();
  const response = NextResponse.json({ csrfToken: token });

  response.cookies.set('csrf_token', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: CSRF_TOKEN_MAX_AGE,
    path: '/',
  });

  response.headers.set('Cache-Control', 'no-store, max-age=0, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');

  return response;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await enforceRequestRateLimit(
      request,
      'os_verify_password',
      MAX_VERIFY_ATTEMPTS,
      VERIFY_WINDOW_MS,
      VERIFY_BLOCK_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfter) },
        }
      );
    }

    const csrfHeader = request.headers.get('x-csrf-token');
    const cookieStore = await cookies();
    const csrfCookie = cookieStore.get('csrf_token')?.value;

    if (!csrfHeader || !csrfCookie || !validateCSRFToken(csrfHeader, csrfCookie)) {
      return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
    }

    const body = (await request.json().catch(() => null)) as { password?: string } | null;
    const password = body?.password?.toString().trim();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const snap = await db.ref('os-settings').once('value');
    const settings = (snap.val() || {}) as OsSettings;

    if (!hasStoredPasswordConfig(settings)) {
      return NextResponse.json({ error: 'System not initialized' }, { status: 500 });
    }

    const verification = verifyStoredPassword(password, settings);

    if (!verification.valid) {
      return unauthorizedResponse();
    }

    if (verification.needsUpgrade && verification.upgradedRecord) {
      await db.ref('os-settings').update(verification.upgradedRecord);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[VerifyPassword] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
