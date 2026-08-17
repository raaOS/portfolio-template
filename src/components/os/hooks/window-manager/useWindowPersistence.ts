import { useRef, useCallback, useEffect } from 'react';

interface UseWindowPersistenceProps {
  csrfToken?: string;
  isAdmin?: boolean;
  siteId?: string;
}

export function useWindowPersistence({
  csrfToken,
  isAdmin,
  siteId = 'default-site',
}: UseWindowPersistenceProps) {
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const persistTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPersistingRef = useRef(false);
  const pendingWindowPreferenceUpdatesRef = useRef<
    Record<
      string,
      Partial<{
        x: number;
        y: number;
        width: number;
        height: number;
        zIndex: number;
        xPct: number;
        yPct: number;
        widthPct: number;
        heightPct: number;
        refScreenWidth: number;
        refScreenHeight: number;
        isOpenByDefault: boolean;
      }>
    >
  >({});

  // Cleanup timeouts on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, []);

  /**
   * Saves window position and default open state to the server.
   * Only works for authenticated admins.
   */
  const saveWindowPreference = useCallback(
    async (
      id: string,
      updates: Partial<{
        x: number;
        y: number;
        width: number;
        height: number;
        zIndex: number;
        xPct: number;
        yPct: number;
        widthPct: number;
        heightPct: number;
        refScreenWidth: number;
        refScreenHeight: number;
        isOpenByDefault: boolean;
      }>
    ) => {
      if (!isAdmin || !csrfToken) return;

      // Prevent overwriting desktop layout from mobile
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
      if (isMobile) {
        // We allow toggling 'isOpenByDefault' (pin) from mobile if needed,
        // but we STRIP spatial updates (x, y, width, height and percentages)
        const spatialKeys = ['x', 'y', 'width', 'height', 'xPct', 'yPct', 'widthPct', 'heightPct'];
        const hasSpatialUpdate = Object.keys(updates).some((k) => spatialKeys.includes(k));

        if (hasSpatialUpdate) {
          const filteredUpdates = { ...updates };
          delete filteredUpdates.x;
          delete filteredUpdates.y;
          delete filteredUpdates.width;
          delete filteredUpdates.height;
          delete filteredUpdates.xPct;
          delete filteredUpdates.yPct;
          delete filteredUpdates.widthPct;
          delete filteredUpdates.heightPct;

          if (Object.keys(filteredUpdates).length === 0) return;
          updates = filteredUpdates;
        }
      }

      if (Object.keys(updates).length === 0) {
        return;
      }

      pendingWindowPreferenceUpdatesRef.current = {
        ...pendingWindowPreferenceUpdatesRef.current,
        [id]: {
          ...(pendingWindowPreferenceUpdatesRef.current[id] || {}),
          ...updates,
        },
      };

      // Use debounce for manual moves to avoid race conditions, but merge
      // pending fields so focus zIndex cannot cancel position/size saves.
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      isPersistingRef.current = true;

      saveTimeoutRef.current = setTimeout(async () => {
        const windowPreferences = pendingWindowPreferenceUpdatesRef.current;
        pendingWindowPreferenceUpdatesRef.current = {};

        try {
          const response = await fetch('/api/about', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({
              siteId,
              windowPreferences,
            }),
          });

          if (!response.ok) {
            throw new Error(`Server responded with status ${response.status}`);
          }
        } catch (error) {
          console.error('[WindowManager] Failed to save preference:', error);
        } finally {
          persistTimeoutRef.current = setTimeout(() => {
            isPersistingRef.current = false;
            persistTimeoutRef.current = null;
          }, 1000);
        }
      }, 800);
    },
    [csrfToken, isAdmin, siteId]
  );

  const flushWindowPositions = useCallback(async () => {
    if (!isAdmin || !csrfToken) return;

    try {
      const { flushPositions } = await import('@/components/os/utils/positionSync');
      await flushPositions(csrfToken, siteId);
    } catch (error) {
      console.error('[WindowManager] Failed to flush:', error);
    }
  }, [isAdmin, csrfToken, siteId]);

  return {
    saveWindowPreference,
    flushWindowPositions,
  };
}
