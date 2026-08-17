'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Storage breakdown shown inside the Database popout. Tells the admin
 * how many files D1 thinks each category has vs how many R2 actually
 * stores, so wallpaper / project upload mismatches surface without
 * needing to dig into a CLI script.
 */

export interface KindCounts {
  total: number;
  image: number;
  video: number;
  other: number;
}

export interface StorageCategoryStats {
  id: string;
  label: string;
  prefix: string;
  d1: KindCounts;
  r2: KindCounts;
  orphans: number;
  dangling: number;
  orphanKeys: string[];
  danglingPaths: string[];
  /** Plain-language explanation rendered below the count grid. */
  note?: string;
  /** R2 objects that are convention-named side-car files for video assets. */
  sidecarCount: number;
}

export interface StorageStatsPayload {
  categories: StorageCategoryStats[];
  generatedAt: number;
  cached: boolean;
  warnings: string[];
}

export type StorageStatsState =
  | { status: 'idle' }
  | { status: 'loading'; data: StorageStatsPayload | null }
  | { status: 'ready'; data: StorageStatsPayload }
  | { status: 'error'; message: string; data: StorageStatsPayload | null };

interface Options {
  /**
   * When true, the hook fetches once on mount and on each `enabled` flip
   * from false → true. We avoid eager fetching while the popout is closed
   * because /api/admin/storage-stats does an R2 ListObjectsV2 round-trip.
   */
  enabled: boolean;
}

export function useStorageStats({ enabled }: Options) {
  const [state, setState] = useState<StorageStatsState>({ status: 'idle' });
  // Keep latest data across status transitions so the popout doesn't
  // flash an empty grid every time it re-opens.
  const lastDataRef = useRef<StorageStatsPayload | null>(null);

  const refresh = useCallback(async (fresh = false) => {
    setState((prev) => ({
      status: 'loading',
      data: lastDataRef.current ?? (prev.status === 'ready' ? prev.data : null),
    }));
    try {
      const url = fresh ? '/api/admin/storage-stats?fresh=true' : '/api/admin/storage-stats';
      const res = await fetch(url, { cache: 'no-store', credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error('AUTH_REQUIRED');
        }
        const errBody = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as StorageStatsPayload;
      lastDataRef.current = data;
      setState({ status: 'ready', data });
    } catch (e) {
      setState({
        status: 'error',
        message: e instanceof Error ? e.message : 'Unknown error',
        data: lastDataRef.current,
      });
    }
  }, []);

  // Lazy fetch: only when the popout that consumes this is open.
  useEffect(() => {
    if (!enabled) return;
    void refresh(false);
  }, [enabled, refresh]);

  return {
    state,
    refresh,
  };
}
