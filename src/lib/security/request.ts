import type { NextRequest } from 'next/server';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import {
  CLOUDFLARE_CONNECTING_IP_HEADER,
  UNKNOWN_IP,
  X_FORWARDED_FOR_HEADER,
  X_REAL_IP_HEADER,
} from '@/lib/security/constants';

/**
 * Get client IP address from request
 *
 * SECURITY: Only trust headers set by trusted proxies/CDN.
 * - cf-connecting-ip: Set by Cloudflare when proxying (trusted when using Cloudflare proxy)
 *
 * Headers like x-forwarded-for and x-real-ip are client-spoofable
 * and should NOT be trusted for rate limiting decisions.
 */
export function getClientIP(request: Request | NextRequest): string {
  // Cloudflare proxy IP (trusted when using Cloudflare)
  const cfIP = request.headers.get(CLOUDFLARE_CONNECTING_IP_HEADER);
  if (cfIP) {
    return cfIP.trim();
  }

  // Fallback for local/non-Cloudflare environments
  // Note: These can be spoofed, so rate limiting based on this is not fully reliable
  const forwarded = request.headers.get(X_FORWARDED_FOR_HEADER);
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIP = request.headers.get(X_REAL_IP_HEADER);
  if (realIP) {
    return realIP.trim();
  }

  return UNKNOWN_IP;
}

export function getClientIdentifier(request: Request | NextRequest, scope?: string): string {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const baseIdentifier = `${ip}|${userAgent}`;

  return scope ? `${scope}:${baseIdentifier}` : baseIdentifier;
}

export async function enforceRequestRateLimit(
  request: Request | NextRequest,
  scope: string,
  maxAttempts: number,
  windowMs: number,
  blockMs: number
) {
  return checkDataRateLimit(getClientIdentifier(request, scope), maxAttempts, windowMs, blockMs);
}
