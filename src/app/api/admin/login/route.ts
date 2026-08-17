import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminPassword, getAdminToken } from '@/lib/auth';
import { generateCSRFToken, validateCSRFToken } from '@/lib/security';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { cookies } from 'next/headers';
import { getClientIdentifier, getClientIP } from '@/lib/security/request';
import { logAdminActivity } from '@/lib/services/auditLogger';
import {
  ADMIN_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_HEADER,
  CSRF_TOKEN_MAX_AGE,
} from '@/lib/security/constants';
import { logOperationalEvent, summarizeError } from '@/lib/observability/operationalLog';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS_PER_WINDOW = 3;
const RATE_LIMIT_WINDOW = 5 * 60 * 1000;
const BLOCK_DURATION = 30 * 60 * 1000;

async function auditLogin(
  request: NextRequest,
  action: string,
  metadata?: Record<string, unknown>
) {
  await logAdminActivity(request, action, metadata).catch((error) => {
    console.error('[Audit] Failed to log admin login activity:', error);
  });
}

function parseUserAgent(ua: string) {
  let os = 'Unknown OS';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'MacOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  let browser = 'Unknown Browser';
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';

  return `${os} - ${browser}`;
}

async function getGeoInfo(ip: string) {
  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    return { location: 'Localhost', isp: 'Local System' };
  }

  try {
    const res = await fetch(`https://ip-api.com/json/${ip}?fields=status,country,city,isp`);
    const data = await res.json();

    if (data.status === 'success') {
      return {
        location: `${data.city}, ${data.country}`,
        isp: data.isp,
      };
    }
  } catch {
    // Best-effort only.
  }

  return { location: 'Unknown', isp: 'Unknown' };
}

export async function GET() {
  const token = generateCSRFToken();
  const response = NextResponse.json({ csrfToken: token });

  response.cookies.set(CSRF_TOKEN_COOKIE, token, {
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

interface LoginRequestBody {
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const csrfToken = request.headers.get(CSRF_TOKEN_HEADER);
    const cookieStore = await cookies();
    const sessionCsrfToken = cookieStore.get(CSRF_TOKEN_COOKIE)?.value;

    if (!csrfToken || !sessionCsrfToken) {
      await auditLogin(request, 'Admin login rejected', { reason: 'missing-csrf' });
      logOperationalEvent({
        event: 'admin.login',
        level: 'warn',
        status: 'blocked',
        request,
        message: 'Admin login rejected: missing CSRF',
        metadata: { reason: 'missing-csrf' },
      });
      return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
    }

    const isValid = validateCSRFToken(csrfToken, sessionCsrfToken);
    if (!isValid) {
      await auditLogin(request, 'Admin login rejected', { reason: 'invalid-csrf' });
      logOperationalEvent({
        event: 'admin.login',
        level: 'warn',
        status: 'blocked',
        request,
        message: 'Admin login rejected: invalid CSRF',
        metadata: { reason: 'invalid-csrf' },
      });
      return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
    }

    const clientId = getClientIdentifier(request);
    // SECURITY FIX: Rate-limit berbasis IP SAJA. Key lama `ip|userAgent`
    // memungkinkan attacker merotasi User-Agent untuk me-reset counter.
    const rateLimitIp = getClientIP(request);
    // FIX #57: Hapus bypass berbasis header `x-test-bypass`.
    // Bypass hanya diizinkan untuk environment test/E2E resmi.
    const isTestEnv = process.env.NODE_ENV === 'test' || process.env.E2E_TEST === 'true';

    if (!isTestEnv) {
      const rateLimit = await checkDataRateLimit(
        `login_${rateLimitIp}`,
        MAX_ATTEMPTS_PER_WINDOW,
        RATE_LIMIT_WINDOW,
        BLOCK_DURATION
      );

      if (!rateLimit.allowed) {
        const [ip, userAgent] = clientId.split('|');
        const geo = await getGeoInfo(ip);
        const device = parseUserAgent(userAgent);

        await auditLogin(request, 'Admin login blocked by rate limit', {
          retryAfter: rateLimit.retryAfter,
          device,
          location: geo.location,
        });
        logOperationalEvent({
          event: 'admin.login',
          level: 'warn',
          status: 'blocked',
          request,
          message: 'Admin login blocked by rate limit',
          metadata: { retryAfter: rateLimit.retryAfter },
        });

        return NextResponse.json(
          {
            error: 'Too many login attempts. Please try again later.',
            retryAfter: rateLimit.retryAfter,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(rateLimit.retryAfter) },
          }
        );
      }
    }

    const { password } = (await request.json()) as LoginRequestBody;

    if (!password || typeof password !== 'string') {
      await auditLogin(request, 'Admin login rejected', { reason: 'missing-password' });
      logOperationalEvent({
        event: 'admin.login',
        level: 'warn',
        status: 'failure',
        request,
        message: 'Admin login failed validation',
        metadata: { reason: 'missing-password' },
      });
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    if (password.length < 8) {
      await auditLogin(request, 'Admin login failed', { reason: 'invalid-password-length' });
      logOperationalEvent({
        event: 'admin.login',
        level: 'warn',
        status: 'failure',
        request,
        message: 'Admin login failed validation',
        metadata: { reason: 'invalid-password-length' },
      });
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    const [ip, userAgent] = clientId.split('|');
    const geo = isTestEnv
      ? { location: 'E2E Test Environment', isp: 'Playwright' }
      : await getGeoInfo(ip);
    const device = isTestEnv ? 'Playwright Test Runner' : parseUserAgent(userAgent);

    let passwordValid = false;
    try {
      passwordValid = await verifyAdminPassword(password);
    } catch {
      logOperationalEvent({
        event: 'admin.login',
        level: 'error',
        status: 'failure',
        request,
        message: 'Admin authentication service error',
      });
      return NextResponse.json({ error: 'Authentication service error' }, { status: 500 });
    }

    if (!passwordValid) {
      await auditLogin(request, 'Admin login failed', {
        device,
        location: geo.location,
      });
      logOperationalEvent({
        event: 'admin.login',
        level: 'warn',
        status: 'failure',
        request,
        message: 'Admin login failed',
        metadata: { reason: 'invalid-password' },
      });

      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    await auditLogin(request, 'Admin login success', {
      device,
      location: geo.location,
    });
    logOperationalEvent({
      event: 'admin.login',
      status: 'success',
      request,
      message: 'Admin login success',
    });

    const token = getAdminToken();
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
    });

    response.cookies.set(ADMIN_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 2 * 60 * 60,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    console.error('[Admin Login] Authentication failed:', error);
    logOperationalEvent({
      event: 'admin.login',
      level: 'error',
      status: 'failure',
      request,
      message: 'Admin login handler failed',
      metadata: { error: summarizeError(error) },
    });
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
