'use client';

import { useState, useCallback, useRef } from 'react';
import type { AdminWindowState, AdminDesktopActions } from './types';
import { ADMIN_ZONES } from './registry';

let nextZIndex = 100;

function getStaggerOffset(windowCount: number) {
  const base = 30;
  return {
    x: base + (windowCount % 8) * 30,
    y: base + (windowCount % 8) * 30,
  };
}

export function useAdminDesktop() {
  const [windows, setWindows] = useState<AdminWindowState[]>([]);
  const windowCountRef = useRef(0);

  const openApp: AdminDesktopActions['openApp'] = useCallback((_zoneId: string, appId: string) => {
    // Check if app is already open
    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === appId);
      if (existing) {
        // Bring to front & unminimize
        nextZIndex++;
        return prev.map((w) =>
          w.id === existing.id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w
        );
      }

      // Find app definition from registry
      let appDef = null;
      let zone = null;
      for (const z of ADMIN_ZONES) {
        const found = z.apps.find((a) => a.id === appId);
        if (found) {
          appDef = found;
          zone = z;
          break;
        }
      }
      if (!appDef || !zone) return prev;

      windowCountRef.current++;
      nextZIndex++;
      const offset = getStaggerOffset(windowCountRef.current);

      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
      const w = Math.min(appDef.defaultWidth, vw - 80);
      const h = Math.min(appDef.defaultHeight, vh - 80);

      const newWindow: AdminWindowState = {
        id: `${appId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        appId,
        title: appDef.label,
        icon: appDef.icon,
        iconColor: appDef.iconColor,
        isMinimized: false,
        isMaximized: false,
        zIndex: nextZIndex,
        x: Math.max(20, Math.min(offset.x, vw - w - 20)),
        y: Math.max(40, Math.min(offset.y, vh - h - 40)),
        width: w,
        height: h,
      };

      return [...prev, newWindow];
    });
  }, []);

  const closeWindow: AdminDesktopActions['closeWindow'] = useCallback((windowId) => {
    setWindows((prev) => prev.filter((w) => w.id !== windowId));
  }, []);

  const minimizeWindow: AdminDesktopActions['minimizeWindow'] = useCallback((windowId) => {
    setWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, isMinimized: true } : w)));
  }, []);

  const toggleMaximize: AdminDesktopActions['toggleMaximize'] = useCallback((windowId) => {
    setWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, isMaximized: !w.isMaximized } : w))
    );
  }, []);

  const bringToFront: AdminDesktopActions['bringToFront'] = useCallback((windowId) => {
    nextZIndex++;
    setWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, zIndex: nextZIndex, isMinimized: false } : w))
    );
  }, []);

  const updatePosition: AdminDesktopActions['updatePosition'] = useCallback((windowId, x, y) => {
    setWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, x, y } : w)));
  }, []);

  const updateSize: AdminDesktopActions['updateSize'] = useCallback((windowId, width, height) => {
    setWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, width, height } : w)));
  }, []);

  const openFolder: AdminDesktopActions['openFolder'] = useCallback((zoneId) => {
    const folderAppId = `folder-${zoneId}`;
    setWindows((prev) => {
      const existing = prev.find((w) => w.appId === folderAppId);
      if (existing) {
        nextZIndex++;
        return prev.map((w) =>
          w.id === existing.id ? { ...w, zIndex: nextZIndex, isMinimized: false } : w
        );
      }

      const zone = ADMIN_ZONES.find((z) => z.id === zoneId);
      if (!zone) return prev;

      windowCountRef.current++;
      nextZIndex++;
      const offset = getStaggerOffset(windowCountRef.current);

      const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
      const defaultWidth = 560;
      const defaultHeight = 400;
      const w = Math.min(defaultWidth, vw - 80);
      const h = Math.min(defaultHeight, vh - 80);

      const newWindow: AdminWindowState = {
        id: `${folderAppId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        appId: folderAppId,
        title: zone.label,
        icon: zone.icon,
        iconColor: zone.iconColor,
        isMinimized: false,
        isMaximized: false,
        zIndex: nextZIndex,
        x: Math.max(20, Math.min(offset.x, vw - w - 20)),
        y: Math.max(40, Math.min(offset.y, vh - h - 40)),
        width: w,
        height: h,
      };

      return [...prev, newWindow];
    });
  }, []);

  const actions: AdminDesktopActions = {
    openApp,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    bringToFront,
    updatePosition,
    updateSize,
    openFolder,
  };

  return { windows, actions };
}


