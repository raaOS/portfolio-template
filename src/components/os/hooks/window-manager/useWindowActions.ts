import { useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import { WindowState } from './types';
import { AboutData } from '@/types/about';
import { ElementType } from '@/components/os/context/UnifiedZIndexContext';
import { saveWindowPosition } from '@/components/os/utils/positionSync';
import { getViewport } from '@/components/os/utils/viewport';

interface UseWindowActionsProps {
  windows: WindowState[];
  setWindows: React.Dispatch<React.SetStateAction<WindowState[]>>;
  setBouncingDocId: React.Dispatch<React.SetStateAction<string | null>>;
  bringToFrontZIndex: (id: string, type: ElementType) => number;
  getCenterPosition: (w: number, h: number) => { x: number; y: number };
  aboutData?: AboutData | null;
  isAdmin: boolean;
  csrfToken?: string;
  saveWindowPreference: (
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
  ) => Promise<void>;
}

export function useWindowActions({
  windows,
  setWindows,
  setBouncingDocId,
  bringToFrontZIndex,
  getCenterPosition,
  aboutData,
  isAdmin,
  csrfToken,
  saveWindowPreference,
}: UseWindowActionsProps) {
  const persistWindowZIndex = useCallback(
    (id: string, zIndex: number) => {
      saveWindowPosition(id, { zIndex }, isAdmin);
      if (isAdmin && csrfToken) {
        void saveWindowPreference(id, { zIndex });
      }
    },
    [csrfToken, isAdmin, saveWindowPreference]
  );

  // Sound ownership lives in Window.tsx / WindowTitleBar.tsx through SoundManager.
  // Keep state actions silent so opening/closing a window cannot emit duplicate sounds.
  const openWindow = useCallback(
    (id: string, customConfig?: Partial<WindowState>) => {
      const newZIndex = bringToFrontZIndex(id, 'window');
      persistWindowZIndex(id, newZIndex);

      const resolveWindowContent = (windowState?: WindowState, overrideContent?: ReactNode) => {
        if (overrideContent !== undefined) {
          return overrideContent;
        }
        if (windowState?.content != null) {
          return windowState.content;
        }
        return windowState?.contentFactory ? windowState.contentFactory() : null;
      };

      setWindows((prev) => {
        const existingWindow = prev.find((w) => w.id === id);

        const getMobileDims = (w?: number, h?: number) => {
          const vp = getViewport();
          const isMobile = vp.width < 768;
          if (!isMobile) return { width: w || 800, height: h || 600 };

          return {
            width: Math.min(w || 800, vp.width * 0.95),
            height: Math.min(h || 600, vp.height * 0.7),
          };
        };

        if (!existingWindow && customConfig) {
          const { width, height } = getMobileDims(customConfig.width, customConfig.height);

          const newWindow: WindowState = {
            title: 'Window',
            noPadding: false,
            ...customConfig,
            id,
            isOpen: true,
            zIndex: newZIndex,
            initialPosition: customConfig.initialPosition || getCenterPosition(width, height),
            width,
            height,
            content: customConfig.content,
            originRect: customConfig.originRect,
          };
          return [...prev, newWindow];
        }

        return prev.map((w) => {
          if (w.id === id) {
            if (w.isOpen) {
              return {
                ...w,
                isMinimized: false,
                zIndex: newZIndex,
                content: resolveWindowContent(w, customConfig?.content),
                title: customConfig?.title || w.title,
              };
            }

            const pref = aboutData?.windowPreferences?.[id];
            const rawWidth = customConfig?.width || pref?.width || w.width || 800;
            const rawHeight = customConfig?.height || pref?.height || w.height || 600;

            const { width, height } = getMobileDims(rawWidth, rawHeight);
            const isMobile = getViewport().width < 768;

            const initialPosition =
              pref && pref.x !== undefined && pref.y !== undefined && !isMobile
                ? { x: pref.x, y: pref.y }
                : getCenterPosition(width, height);

            return {
              ...w,
              isOpen: true,
              isMinimized: false,
              zIndex: newZIndex,
              initialPosition: w.initialPosition || initialPosition,
              width,
              height,
              content: resolveWindowContent(w, customConfig?.content),
              title: customConfig?.title || w.title,
              originRect: customConfig?.originRect || w.originRect,
            };
          }
          return w;
        });
      });
    },
    [aboutData, getCenterPosition, bringToFrontZIndex, persistWindowZIndex, setWindows]
  );

  const closeWindow = useCallback(
    (id: string) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id === id) {
            return { ...w, isOpen: false, isMinimized: false, isMaximized: false };
          }
          return w;
        })
      );
    },
    [setWindows]
  );

  const minimizeWindow = useCallback(
    (id: string) => {
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id === id) return { ...w, isMinimized: true };
          return w;
        })
      );
      setBouncingDocId(id);
    },
    [setWindows, setBouncingDocId]
  );

  const maximizeWindow = useCallback(
    (id: string) => {
      const newZIndex = bringToFrontZIndex(id, 'window');
      persistWindowZIndex(id, newZIndex);
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id === id) return { ...w, isMaximized: !w.isMaximized, zIndex: newZIndex };
          return w;
        })
      );
    },
    [bringToFrontZIndex, persistWindowZIndex, setWindows]
  );

  const focusWindow = useCallback(
    (id: string) => {
      const newZIndex = bringToFrontZIndex(id, 'window');
      persistWindowZIndex(id, newZIndex);
      setWindows((prev) =>
        prev.map((w) => {
          if (w.id === id) return { ...w, zIndex: newZIndex };
          return w;
        })
      );
    },
    [bringToFrontZIndex, persistWindowZIndex, setWindows]
  );

  const updateWindowPosition = useCallback(
    (id: string, x: number, y: number) => {
      const win = windows?.find((w) => w.id === id);
      saveWindowPosition(
        id,
        {
          x,
          y,
          width: win?.width,
          height: win?.height,
        },
        isAdmin
      );

      setWindows((prev) =>
        prev?.map((w) => {
          if (w.id === id) {
            return { ...w, initialPosition: { x, y } };
          }
          return w;
        })
      );

      if (isAdmin && csrfToken) {
        // Convert pixels to percentages for responsive positioning
        const vp = getViewport();
        const xPct = (x / vp.width) * 100;
        const yPct = (y / vp.height) * 100;

        queueMicrotask(() =>
          saveWindowPreference(id, {
            x,
            y, // Legacy pixel values
            xPct,
            yPct, // Percentage-based for responsive
            refScreenWidth: vp.width,
            refScreenHeight: vp.height,
          })
        );
      }
    },
    [saveWindowPreference, isAdmin, csrfToken, windows, setWindows]
  );

  const handleWindowResize = useCallback(
    (id: string, width: number, height: number) => {
      setWindows((prev) =>
        prev?.map((w) => {
          if (w.id === id) {
            return { ...w, width, height };
          }
          return w;
        })
      );
    },
    [setWindows]
  );

  const handleWindowResizeEnd = useCallback(
    (id: string, width: number, height: number) => {
      saveWindowPosition(id, { width, height }, isAdmin);
      if (isAdmin && csrfToken) {
        // Convert pixels to percentages for responsive sizing
        const vp = getViewport();
        const widthPct = (width / vp.width) * 100;
        const heightPct = (height / vp.height) * 100;

        queueMicrotask(() =>
          saveWindowPreference(id, {
            width,
            height, // Legacy pixel values
            widthPct,
            heightPct, // Percentage-based for responsive
            refScreenWidth: vp.width,
            refScreenHeight: vp.height,
          })
        );
      }
    },
    [saveWindowPreference, isAdmin, csrfToken]
  );

  const togglePin = useCallback(
    (id: string) => {
      const targetWindow = windows?.find((w) => w.id === id);
      if (!targetWindow) return;

      const nextPinned = !targetWindow.isPinned;
      setWindows((prev) => prev?.map((w) => (w.id === id ? { ...w, isPinned: nextPinned } : w)));

      if (nextPinned) {
        const x = targetWindow.initialPosition?.x || 0;
        const y = targetWindow.initialPosition?.y || 0;
        const width = targetWindow.width || 800;
        const height = targetWindow.height || 600;

        // Convert to percentages for responsive positioning
        const vp = getViewport();
        const xPct = (x / vp.width) * 100;
        const yPct = (y / vp.height) * 100;
        const widthPct = (width / vp.width) * 100;
        const heightPct = (height / vp.height) * 100;

        void saveWindowPreference(id, {
          x,
          y,
          width,
          height, // Legacy pixel values
          xPct,
          yPct,
          widthPct,
          heightPct, // Percentage-based
          refScreenWidth: vp.width,
          refScreenHeight: vp.height,
          isOpenByDefault: true,
          zIndex: targetWindow.zIndex,
        });
      } else {
        void saveWindowPreference(id, { isOpenByDefault: false });
      }
    },
    [saveWindowPreference, windows, setWindows]
  );

  const resetWindows = useCallback(() => {
    setWindows((prev) =>
      prev.map((w) => ({ ...w, isOpen: false, isMinimized: false, isMaximized: false }))
    );
  }, [setWindows]);

  return useMemo(
    () => ({
      openWindow,
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      focusWindow,
      updateWindowPosition,
      handleWindowResize,
      handleWindowResizeEnd,
      togglePin,
      resetWindows,
    }),
    [
      openWindow,
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      focusWindow,
      updateWindowPosition,
      handleWindowResize,
      handleWindowResizeEnd,
      togglePin,
      resetWindows,
    ]
  );
}
