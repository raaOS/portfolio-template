/**
 * Setup API — POST /api/setup
 * Seeds the database with initial site, admin user, and content data.
 * Only works if no admin user exists yet (first-time setup).
 */
import { NextRequest, NextResponse } from 'next/server';
import { seedDeployment, verifyDeployment } from '@/crud/shared/db/seed';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { getClientIP } from '@/lib/security/request';

// SECURITY FIX (audit 2026-09-29): /api/setup harus tetap publik (first-time
// onboarding), tapi tanpa limit endpoint ini bisa dipakai membanjiri scrypt
// (DoS CPU) dan mempercepat brute-force upaya seeding. Key IP-only.
const RATE_MAX = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_BLOCK_MS = 30 * 60 * 1000;
const GET_RATE_MAX = 30;

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await checkDataRateLimit(
      `setup_status:${getClientIP(request)}`,
      GET_RATE_MAX,
      RATE_WINDOW_MS,
      RATE_BLOCK_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const status = await verifyDeployment();
    return NextResponse.json({
      isSetupComplete: status.hasSite && status.hasAdmin,
      ...status,
    });
  } catch {
    return NextResponse.json(
      { error: 'Gagal memeriksa status setup' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const rateLimit = await checkDataRateLimit(
      `setup_post:${getClientIP(request)}`,
      RATE_MAX,
      RATE_WINDOW_MS,
      RATE_BLOCK_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    // Check if already set up
    const status = await verifyDeployment();
    if (status.hasAdmin) {
      return NextResponse.json(
        { error: 'Setup sudah selesai. Admin user sudah ada.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { siteName, adminEmail, adminPassword } = body;

    if (!adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Email dan password wajib diisi' },
        { status: 400 }
      );
    }

    if (adminPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password minimal 8 karakter' },
        { status: 400 }
      );
    }

    const result = await seedDeployment({
      siteName: siteName || 'My Portfolio',
      adminEmail,
      adminPassword,
    });

    // Lost the insert race against a concurrent setup call — the admin
    // slot for this deployment was taken by another request.
    if (!result.adminCreated) {
      return NextResponse.json(
        { error: 'Setup sudah selesai. Admin user sudah ada.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Setup berhasil!',
      ...result,
    });
  } catch (error) {
    console.error('[Setup] Error:', error);
    return NextResponse.json(
      { error: 'Gagal melakukan setup' },
      { status: 500 }
    );
  }
}
