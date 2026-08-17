import { checkDataRateLimit } from '@/lib/dataRateLimit';

const MAX_ATTEMPTS = 100;
const LOCKOUT_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

const localLimits = new Map<
  string,
  {
    count: number;
    lastAttempt: number;
    lockedUntil?: number;
  }
>();

/**
 * Cek rate limit dengan strategi two-tier:
 * 1. Primary: Cloudflare D1-backed (persistent lintas cold-start serverless)
 * 2. Fallback: in-memory Map (HANYA untuk development)
 *
 * Di production, fallback in-memory TIDAK aman karena:
 * - Serverless/edge runtime bisa membuat instance baru per cold-start
 * - Attacker bisa spread attempts ke banyak instance → reset counter
 * - Memori tidak shared antar region
 *
 * Karena itu di production kita return `false` (block) kalau D1 gagal.
 * Fail-closed lebih aman daripada fail-open untuk endpoint sensitif.
 */
export async function checkRateLimit(ip: string): Promise<boolean> {
  if (!ip) return false;

  try {
    const result = await checkDataRateLimit(ip, MAX_ATTEMPTS, WINDOW_MS, LOCKOUT_MS);
    return result.allowed;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[RateLimit] D1 unavailable, using local fallback (dev only):', error);
      return checkRateLimitLocal(ip);
    }
    // Fail-closed di production: D1 down = treat as rate limited.
    // Jangan izinkan request tanpa rate limit protection.
    console.error('[RateLimit] D1 unavailable in production, failing closed:', error);
    return false;
  }
}

function checkRateLimitLocal(ip: string): boolean {
  const now = Date.now();
  const attempt = localLimits.get(ip) || { count: 0, lastAttempt: 0 };

  if (attempt.lockedUntil && now > attempt.lockedUntil) {
    attempt.count = 0;
    attempt.lockedUntil = undefined;
  }

  if (attempt.lockedUntil && now <= attempt.lockedUntil) {
    return false;
  }

  if (now - attempt.lastAttempt > WINDOW_MS) {
    attempt.count = 0;
  }

  if (attempt.count >= MAX_ATTEMPTS) {
    attempt.lockedUntil = now + LOCKOUT_MS;
    localLimits.set(ip, attempt);
    return false;
  }

  attempt.count++;
  attempt.lastAttempt = now;
  localLimits.set(ip, attempt);
  return true;
}

export function resetRateLimit(ip: string): void {
  if (!ip) return;
  localLimits.delete(ip);
}

export function cleanupRateLimits(): void {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;

  for (const [ip, data] of localLimits.entries()) {
    if (data.lastAttempt < cutoff) {
      localLimits.delete(ip);
    }
  }
}
