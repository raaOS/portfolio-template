'use client';

import useSWR from 'swr';
import type { ActiveTemplateKey } from './templateScope';

/**
 * Baca template aktif deployment ini (`sites.active_template_key`) untuk
 * penyaringan app admin secara runtime. Satu request dibagi semua pemakai
 * (useAdminDesktop + WindowContentRenderer) lewat cache SWR.
 *
 * FAIL-OPEN: bila endpoint gagal / belum termuat → `null` = SEMUA app tampil.
 * Jangan pernah menyembunyikan CRUD karena error sesaat.
 */
interface SiteTemplateResponse {
  success: boolean;
  activeTemplateKey: ActiveTemplateKey | null;
}

const fetcher = async (url: string): Promise<SiteTemplateResponse> => {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Gagal memuat template aktif');
  return res.json();
};

export function useActiveTemplate(): {
  activeTemplate: ActiveTemplateKey | null;
  isLoaded: boolean;
} {
  const { data } = useSWR<SiteTemplateResponse>('/api/admin/site-template', fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });
  return {
    activeTemplate: data?.activeTemplateKey ?? null,
    isLoaded: data !== undefined,
  };
}
