'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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

// Urutan kuadran 2×2 sesuai mockup owner (v1.3.65): kiri-atas → kanan-atas →
// kiri-bawah → kanan-bawah. Zone di luar daftar ini jatuh ke urutan registry.
const QUADRANT_ORDER = ['system', 'communications', 'content', 'display'];

/**
 * Ubin zone responsif: 2 kolom (tablet/desktop) atau 1 kolom (HP). Ukuran
 * dihitung dari ruang yang tersedia — bukan angka mati — supaya tidak ada celah
 * besar di tengah layar lebar dan tidak saling tumpuk di layar sempit.
 */
const ZONE_TILE = { margin: 12, gap: 10, menubar: 36, taskbar: 60 };

function getZoneTile(slot: number, vw: number, vh: number) {
  const cols = vw >= 720 ? 2 : 1;
  const rows = 4 / cols;
  const width = Math.floor((vw - ZONE_TILE.margin * 2 - ZONE_TILE.gap * (cols - 1)) / cols);
  const height = Math.floor(
    (vh - ZONE_TILE.menubar - ZONE_TILE.taskbar - ZONE_TILE.margin * 2 - ZONE_TILE.gap * (rows - 1)) /
      rows
  );
  return {
    x: ZONE_TILE.margin + (slot % cols) * (width + ZONE_TILE.gap),
    y: ZONE_TILE.menubar + ZONE_TILE.margin + Math.floor(slot / cols) * (height + ZONE_TILE.gap),
    width,
    height,
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

  /**
   * Susun 4 zone sebagai ubin responsif (v1.3.80): 2×2 di tablet/desktop,
   * 1 kolom × 4 baris di HP. Dipanggil saat desktop dimuat dan setiap resize /
   * rotasi layar — jendela zone yang sudah ada cukup digeser, bukan digandakan.
   */
  const layoutZones = useCallback(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;

    setWindows((prev) => {
      const next = [...prev];
      ADMIN_ZONES.forEach((zone, index) => {
        const folderAppId = `folder-${zone.id}`;
        const quadrant = QUADRANT_ORDER.indexOf(zone.id);
        const slot = (quadrant === -1 ? index : quadrant) % 4;
        const rect = getZoneTile(slot, vw, vh);
        const existingIndex = next.findIndex((w) => w.appId === folderAppId);

        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], ...rect };
          return;
        }

        windowCountRef.current++;
        nextZIndex++;
        next.push({
          id: `${folderAppId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          appId: folderAppId,
          title: zone.label,
          icon: zone.icon,
          iconColor: zone.iconColor,
          isMinimized: false,
          isMaximized: false,
          zIndex: nextZIndex,
          ...rect,
        });
      });
      return next;
    });
  }, []);

  // Auto-open saat desktop dimuat. Timer (bukan setState sinkron di effect)
  // agar lolos lint react-hooks/set-state-in-effect; dedup `folder-<zoneId>`
  // bawaan membuat aman terhadap StrictMode double-invoke.
  useEffect(() => {
    const timer = setTimeout(layoutZones, 0);
    return () => clearTimeout(timer);
  }, [layoutZones]);

  // Resize / rotasi perangkat → hitung ulang ubin supaya tetap rapi.
  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(layoutZones);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, [layoutZones]);

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


