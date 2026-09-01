/**
 * Shared Core — Rate Limiting
 * D1-backed persistent rate limiter with in-memory fallback.
 *
 * @module
 */
import { queryD1, isD1Configured, bootstrapD1Schema } from '@/crud/shared/db/connection';

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const memoryStore = new Map<string, RateLimitEntry>();

/**
 * Check and increment rate limit for a given key.
 * Returns true if the request is allowed, false if rate limited.
 */
export async function checkRateLimit(params: {
  key: string;
  maxAttempts: number;
  windowSeconds: number;
  blockSeconds?: number;
}): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const { key, maxAttempts, windowSeconds, blockSeconds } = params;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  if (isD1Configured()) {
    return checkRateLimitD1(key, maxAttempts, windowSeconds, blockSeconds, now, windowStart);
  }
  return checkRateLimitMemory(key, maxAttempts, windowSeconds, blockSeconds, now, windowStart);
}

async function checkRateLimitD1(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  blockSeconds: number | undefined,
  now: number,
  windowStart: number
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  await bootstrapD1Schema();

  // Clean old entries
  await queryD1(
    `DELETE FROM rate_limits WHERE window_start < datetime(?, 'unixepoch')`,
    [Math.floor(windowStart / 1000)]
  );

  // Get current count
  const rows = await queryD1<{ count: number; window_start: string }>(
    `SELECT count, window_start FROM rate_limits WHERE key = ? LIMIT 1`,
    [key]
  );

  const entry = rows[0];
  const entryWindowStart = entry ? new Date(entry.window_start).getTime() : 0;

  if (!entry || entryWindowStart < windowStart) {
    // New window or expired
    await queryD1(
      `INSERT INTO rate_limits (key, count, window_start)
       VALUES (?, 1, datetime(?, 'unixepoch'))
       ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start`,
      [key, Math.floor(now / 1000)]
    );
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowSeconds * 1000 };
  }

  if (entry.count >= maxAttempts) {
    const resetAt = entryWindowStart + (blockSeconds || windowSeconds) * 1000;
    return { allowed: false, remaining: 0, resetAt };
  }

  // Increment
  await queryD1(
    `UPDATE rate_limits SET count = count + 1 WHERE key = ?`,
    [key]
  );

  return {
    allowed: true,
    remaining: maxAttempts - entry.count - 1,
    resetAt: entryWindowStart + windowSeconds * 1000,
  };
}

function checkRateLimitMemory(
  key: string,
  maxAttempts: number,
  windowSeconds: number,
  blockSeconds: number | undefined,
  now: number,
  windowStart: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const entry = memoryStore.get(key);

  if (!entry || entry.windowStart < windowStart) {
    memoryStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowSeconds * 1000 };
  }

  if (entry.count >= maxAttempts) {
    const resetAt = entry.windowStart + (blockSeconds || windowSeconds) * 1000;
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: maxAttempts - entry.count,
    resetAt: entry.windowStart + windowSeconds * 1000,
  };
}
