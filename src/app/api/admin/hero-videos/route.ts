import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { requireOwnerMode } from '@/lib/ownerMode';
import {
  getHeroPreviewPosters,
  getHeroPreviewVideos,
  updateHeroPreviewVideo,
} from '@/lib/services/heroVideoService';

/**
 * GET /api/admin/hero-videos
 * Membaca peta video + poster hero per slot template (owner-mode only + admin).
 *
 * Guard `requireOwnerMode` menahan route ini di deployment klien (404):
 * video hero adalah konten halaman jualan site owner, bukan konten klien
 * (lihat src/lib/ownerMode.ts).
 */
export async function GET(request: NextRequest) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    if (!(await validateAdminRequest(request, { checkCsrf: false }))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [videos, posters] = await Promise.all([
      getHeroPreviewVideos(),
      getHeroPreviewPosters(),
    ]);
    return NextResponse.json({ success: true, videos, posters });
  } catch (error: unknown) {
    console.error('GET /api/admin/hero-videos error:', error);
    return NextResponse.json(
      { error: 'Gagal memuat video hero' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/hero-videos
 * Menyimpan/menghapus video satu slot (admin + CSRF).
 * Body: { slug: 'os-desktop' | ..., url: string, posterUrl?: string } —
 * `url` kosong = hapus slot (hero kembali ke gambar screenshot statis);
 * `posterUrl` (v1.3.57, auto-poster) opsional: undefined = pertahankan
 * poster tersimpan, kosong = hapus, isi = ganti.
 */
export async function PUT(request: NextRequest) {
  try {
    const ownerDenied = requireOwnerMode();
    if (ownerDenied) return ownerDenied;

    const isValid = await validateAdminRequest(request);
    if (!isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body?.slug) {
      return NextResponse.json(
        { error: 'Slot template (slug) wajib diisi.' },
        { status: 400 }
      );
    }

    const result = await updateHeroPreviewVideo(body.slug, body.url, body.posterUrl);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Gagal menyimpan video hero' },
        { status: 400 }
      );
    }

    const [videos, posters] = await Promise.all([
      getHeroPreviewVideos(),
      getHeroPreviewPosters(),
    ]);
    return NextResponse.json({ success: true, videos, posters });
  } catch (error: unknown) {
    console.error('PUT /api/admin/hero-videos error:', error);
    return NextResponse.json(
      { error: 'Gagal menyimpan video hero' },
      { status: 500 }
    );
  }
}
