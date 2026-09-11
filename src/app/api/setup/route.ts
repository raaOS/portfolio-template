/**
 * Setup API — POST /api/setup
 * Seeds the database with initial site, admin user, and content data.
 * Only works if no admin user exists yet (first-time setup).
 */
import { NextResponse } from 'next/server';
import { seedDeployment, verifyDeployment } from '@/crud/shared/db/seed';
import { SITE_ID } from '@/crud/shared/config';

export async function GET() {
  try {
    const status = await verifyDeployment();
    return NextResponse.json({
      siteId: SITE_ID,
      ...status,
      isSetupComplete: status.hasSite && status.hasAdmin,
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
