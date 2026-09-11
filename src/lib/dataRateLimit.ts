/**
 * Data Rate Limit — Persistent rate limiter berbasis D1.
 *
 * Menggunakan Cloudflare D1 sebagai backend pencatat request count per identifier.
 * Fallback ke in-memory Map jika D1 tidak tersedia (misalnya di unit test).
 *
 * @module dataRateLimit
 */
import 'server-only';
import { isD1Configured } from '@/lib/cloudflareD1';
import { db } from '@/lib/database';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
  blockedUntil?: number;
}

const localLimits = new Map<string, RateLimitRecord>();

// Cleanup interval: evict expired entries every 5 minutes to prevent
// unbounded memory growth in long-running processes or during D1 outages.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, record] of localLimits) {
    if (now > record.resetAt && (!record.blockedUntil || now >= record.blockedUntil)) {
      localLimits.delete(key);
    }
  }
}

// Prune limit for the D1-backed store: when the persisted `rateLimits`
// object grows beyond this number of keys, drop expired entries during
// the next check. Without this, keys derived from `ip|userAgent` grow
// the app_kv row unboundedly and slow down every rate-limit check.
const MAX_PERSISTED_KEYS = 500;

function prunePersistedEntries(
  records: Record<string, RateLimitRecord>,
  now: number,
  keepKey?: string
) {
  const entries = Object.entries(records);
  if (entries.length <= MAX_PERSISTED_KEYS) return records;

  const kept = entries.filter(
    ([key, record]) =>
      key === keepKey ||
      !(
        now > record.resetAt &&
        (!record.blockedUntil || now >= record.blockedUntil)
      )
  );

  // Never drop the key currently being rate-limited.
  if (keepKey && !kept.some(([key]) => key === keepKey)) {
    const current = entries.find(([key]) => key === keepKey);
    if (current) kept.push(current);
  }

  return Object.fromEntries(kept);
}

function checkLocalRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  blockMs: number
): { allowed: boolean; retryAfter?: number } {
  cleanupExpiredEntries();
  const now = Date.now();
  const record = localLimits.get(key);

  if (!record) {
    localLimits.set(key, { attempts: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  // An active block must be honored even if the counting window has
  // already expired — otherwise blockMs is effectively capped at windowMs.
  if (record.blockedUntil && now < record.blockedUntil) {
    return {
      allowed: false,
      retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
    };
  }

  if (now > record.resetAt || (record.blockedUntil && now >= record.blockedUntil)) {
    localLimits.set(key, { attempts: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (record.attempts >= maxAttempts) {
    const blockedUntil = now + blockMs;
    localLimits.set(key, { ...record, blockedUntil });
    return {
      allowed: false,
      retryAfter: Math.ceil(blockMs / 1000),
    };
  }

  localLimits.set(key, { ...record, attempts: record.attempts + 1 });
  return { allowed: true };
}

export async function checkDataRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
  blockMs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now();
  const safePath = key.replace(/[.#$/[\]]/g, '_');

  if (!isD1Configured()) {
    return checkLocalRateLimit(safePath, maxAttempts, windowMs, blockMs);
  }

  try {
    // Capture the decision inside the transaction callback to avoid
    // a TOCTOU race between the transaction commit and a separate read.
    let decision: { allowed: boolean; retryAfter?: number } = { allowed: false };

    // Operate on the parent map so pruning expired sibling keys happens
    // inside the same CAS write that records this attempt.
    const result = await db.ref('rateLimits').transaction((store: unknown) => {
      const records =
        store && typeof store === 'object' && !Array.isArray(store)
          ? (store as Record<string, RateLimitRecord>)
          : {};

      // Prune expired sibling keys so the persisted row cannot grow
      // unboundedly (see prunePersistedEntries).
      const base = prunePersistedEntries(records, now, safePath);
      const record = base[safePath];

      const nextStore: Record<string, RateLimitRecord> = { ...base };

      if (!record) {
        decision = { allowed: true };
        nextStore[safePath] = { attempts: 1, resetAt: now + windowMs };
      } else if (record.blockedUntil && now < record.blockedUntil) {
        decision = {
          allowed: false,
          retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
        };
        return base; // blocked: keep the store as-is (still pruned)
      } else if (now > record.resetAt || (record.blockedUntil && now >= record.blockedUntil)) {
        decision = { allowed: true };
        nextStore[safePath] = { attempts: 1, resetAt: now + windowMs };
      } else if (record.attempts >= maxAttempts) {
        const blockedUntil = now + blockMs;
        decision = {
          allowed: false,
          retryAfter: Math.ceil(blockMs / 1000),
        };
        nextStore[safePath] = { ...record, blockedUntil };
      } else {
        decision = { allowed: true };
        nextStore[safePath] = { ...record, attempts: record.attempts + 1 };
      }

      return nextStore;
    });

    // If CAS never committed (retries exhausted), fail closed instead of
    // trusting the callback's optimistic decision — the attempt was never
    // persisted, so allowing it would under-count concurrent attempts.
    if (!result.committed) {
      return { allowed: false, retryAfter: 60 };
    }

    return decision;
  } catch (error) {
    console.error('[RateLimit] Transaction failed:', error);
    // Fail-closed in production: block the request when D1 is unreachable
    // to prevent attackers from bypassing rate limits by triggering errors.
    // In test/dev, fallback to local limiter for convenience.
    if (process.env.NODE_ENV === 'production') {
      return { allowed: false, retryAfter: 60 };
    }
    return checkLocalRateLimit(safePath, maxAttempts, windowMs, blockMs);
  }
}
