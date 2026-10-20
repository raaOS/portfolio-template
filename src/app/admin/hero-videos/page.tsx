'use client';

import { Clapperboard } from 'lucide-react';
import { AdminAuthGuard } from '../components/AdminAuthGuard';
import { AdminHeader } from '../components/components/AdminHeader';
import HeroVideosPanel from '../desktop/panels/HeroVideosPanel';

/**
 * Halaman admin Video Hero (v1.3.49) — upload rekaman demo untuk lembaran
 * hero halaman jualan storefront. Owner-only: app & route API disembunyikan
 * dari deployment klien (ownerOnly di registry + requireOwnerMode di API).
 */
export default function AdminHeroVideosPage() {
  return (
    <AdminAuthGuard>
      <AdminHeader
        title="Video Hero"
        titleIcon={<Clapperboard className="h-5 w-5" aria-hidden />}
        titleAccent="bg-rose-100 text-rose-700"
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <HeroVideosPanel />
      </div>
    </AdminAuthGuard>
  );
}
