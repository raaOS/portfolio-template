'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getWritableCsrfToken } from '@/lib/security/client-csrf';

/**
 * Halaman operator tidak dihitung sebagai kunjungan pengunjung.
 */
const SKIPPED_PREFIXES = ['/admin', '/setup'];

/**
 * Mengirim satu `page_view` setiap kali route berubah.
 *
 * Dipasang di root layout supaya menjangkau seluruh route publik (`/`,
 * `/about`, `/cv`, `/projects`, `/preview/*`) — route-group `(site)` tidak
 * menutupi `/` karena berkas `page.tsx` homepage ada di root.
 *
 * Gagal diam-diam: analitik tidak boleh mengganggu UX (konsisten dengan
 * `useAnalytics`).
 */
export default function PageViewTracker() {
  const pathname = usePathname();
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (SKIPPED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;
    // React StrictMode menjalankan efek dua kali di dev tanpa menghitung dua.
    if (lastSentRef.current === pathname) return;
    lastSentRef.current = pathname;

    void fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getWritableCsrfToken() || '',
      },
      body: JSON.stringify({ event: 'page_view', details: { path: pathname } }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
