'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AboutData, DesktopIconPosition, DesktopIconSize } from '@/types/about';
import { getIconPosition, saveIconPosition, loadPositions } from '../utils/positionSync';
import { useLayoutPersistence } from '../contexts/LayoutPersistenceContext';
import { loadVisitorDesktopSession, saveVisitorIconSnapshot } from '../utils/visitorSessionState';

interface UseDesktopLayoutProps {
  aboutData?: AboutData | null;
  isAdmin: boolean;
  csrfToken: string | null;
  siteId?: string;
}

export function useDesktopLayout({
  aboutData,
  isAdmin,
  csrfToken,
  siteId = 'default-site',
}: UseDesktopLayoutProps) {
  const { registerFlush, unregisterFlush } = useLayoutPersistence();

  // Admin localStorage / in-session drags are overrides. Cloudflare D1 remains
  // a derived template, so aboutData changes do not require render-phase setState.
  const [iconPositionOverrides, setIconPositionOverrides] = useState<
    Record<string, DesktopIconPosition>
  >(() => (isAdmin ? loadPositions().icons || {} : loadVisitorDesktopSession()?.icons || {}));

  const iconPositions = useMemo(() => {
    const cloudIconPositions = aboutData?.desktopPreferences?.iconPositions || {};
    const persistedAdminPositions = isAdmin ? loadPositions().icons || {} : {};
    return { ...cloudIconPositions, ...persistedAdminPositions, ...iconPositionOverrides };
  }, [aboutData?.desktopPreferences?.iconPositions, iconPositionOverrides, isAdmin]);

  const handleIconPositionChange = useCallback(
    (id: string, x: number, y: number) => {
      // Update state (untuk semua agar responsif)
      const vp =
        typeof window !== 'undefined'
          ? { width: window.innerWidth, height: window.innerHeight }
          : { width: 1440, height: 900 };

      const updated: DesktopIconPosition = {
        ...iconPositions[id],
        x,
        y,
        xPct: vp.width > 0 ? (x / vp.width) * 100 : 0,
        yPct: vp.height > 0 ? (y / vp.height) * 100 : 0,
        refScreenWidth: vp.width,
        refScreenHeight: vp.height,
      };

      setIconPositionOverrides((prev) => ({ ...prev, [id]: updated }));

      // Save ke positionSync (localStorage untuk admin, no-op untuk visitor)
      saveIconPosition(
        id,
        { x, y, zIndex: iconPositions[id]?.zIndex, size: iconPositions[id]?.size },
        isAdmin
      );
      if (!isAdmin) {
        saveVisitorIconSnapshot(id, updated);
      }
    },
    [iconPositions, isAdmin]
  );

  const handleIconZIndexChange = useCallback(
    (id: string, zIndex: number, position?: { x: number; y: number }) => {
      setIconPositionOverrides((prev) => {
        const existing = prev[id] || iconPositions[id] || position;
        if (!existing) return prev;
        return {
          ...prev,
          [id]: {
            ...existing,
            zIndex,
          },
        };
      });

      const existing = iconPositions[id] || position;
      if (existing) {
        saveIconPosition(
          id,
          { x: existing.x, y: existing.y, zIndex, size: existing.size },
          isAdmin
        );
        if (!isAdmin) {
          saveVisitorIconSnapshot(id, { ...existing, zIndex });
        }
      }
    },
    [iconPositions, isAdmin]
  );

  const handleIconSizeChange = useCallback(
    (id: string, size: DesktopIconSize, position?: { x: number; y: number }) => {
      setIconPositionOverrides((prev) => {
        const existing = prev[id] || iconPositions[id] || position;
        if (!existing) return prev;
        return {
          ...prev,
          [id]: {
            ...existing,
            size,
          },
        };
      });

      const existing = iconPositions[id] || position;
      if (existing) {
        saveIconPosition(
          id,
          { x: existing.x, y: existing.y, zIndex: existing.zIndex, size },
          isAdmin
        );
      }
    },
    [iconPositions, isAdmin]
  );

  const getIconPos = useCallback(
    (id: string, defaultX: number, defaultY: number) => {
      const saved = iconPositions[id];
      if (saved) return { x: saved.x, y: saved.y };
      return getIconPosition(id, null, { x: defaultX, y: defaultY }, isAdmin);
    },
    [iconPositions, isAdmin]
  );

  // Flush Icons to Server (Admin only)
  const flushIcons = useCallback(async () => {
    if (!isAdmin || !csrfToken) return;
    try {
      const { flushPositions } = await import('../utils/positionSync');
      await flushPositions(csrfToken, siteId);
    } catch (error) {
      console.error('[DesktopLayout] Failed to flush icons:', error);
    }
  }, [isAdmin, csrfToken, siteId]);

  useEffect(() => {
    registerFlush('desktopIcons', flushIcons);
    return () => unregisterFlush('desktopIcons');
  }, [registerFlush, unregisterFlush, flushIcons]);

  return {
    iconPositions,
    setIconPositions: setIconPositionOverrides,
    handleIconPositionChange,
    handleIconZIndexChange,
    handleIconSizeChange,
    getIconPos,
  };
}
