import { useEffect, useLayoutEffect, useRef } from 'react';
import { AboutData } from '@/types/about';
import { WindowState } from './types';
import {
  applyVisitorWindowSnapshot,
  loadVisitorDesktopSession,
} from '@/components/os/utils/visitorSessionState';
import { getViewport } from '@/components/os/utils/viewport';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

interface UseWindowInitializationProps {
  initialWindows: WindowState[];
  aboutData?: AboutData | null;
  setWindows: React.Dispatch<React.SetStateAction<WindowState[]>>;
  getCenterPositionStatic: (width: number, height: number) => { x: number; y: number };
  isAdmin: boolean;
}

/**
 * Single-effect window initialization + content sync.
 *
 * DOUBLE-EFFECT RACE FIX: Sebelumnya ada dua useEffect dengan deps overlap
 * yang sama-sama memodifikasi state windows via `setWindows(prev => ...)`.
 * Saat `initialWindows` berubah keduanya fire berurutan dan bisa saling
 * menimpa. Sekarang dikonsolidasi jadi satu effect yang melakukan
 * reconciliation penuh (position, dimensions, content) dalam satu pass.
 */
export function useWindowInitialization({
  initialWindows,
  aboutData,
  setWindows,
  getCenterPositionStatic,
  isAdmin,
}: UseWindowInitializationProps) {
  const hasAppliedVisitorSessionRef = useRef(false);

  useIsomorphicLayoutEffect(() => {
    const visitorSession =
      !isAdmin && !hasAppliedVisitorSessionRef.current ? loadVisitorDesktopSession() : null;

    setWindows((prev) => {
      // Reconcile tiap system window dalam SATU pass
      const reconciled = initialWindows.map((baseW) => {
        const existing = prev.find((w) => w.id === baseW.id);
        // Keep existing state (isOpen, content, isPinned) jika ada
        const w = { ...baseW, ...existing };

        const pref = aboutData?.windowPreferences?.[w.id];
        const vp = getViewport();
        const isMobile = vp.width < 768;

        // ── Dimensions: prefer percentage, fallback ke legacy pixel ──
        let width: number;
        let height: number;
        if (pref?.widthPct !== undefined && pref?.heightPct !== undefined) {
          width = (pref.widthPct / 100) * vp.width;
          height = (pref.heightPct / 100) * vp.height;
        } else {
          width = pref?.width || w.width || 800;
          height = pref?.height || w.height || 600;
        }

        // Clamp ke viewport
        if (isMobile) {
          width = Math.min(width, vp.width * 0.95);
          height = Math.min(height, vp.height * 0.8);
        } else {
          width = Math.min(width, vp.width * 0.95);
          height = Math.min(height, vp.height * 0.95);
        }
        width = Math.max(width, 300);
        height = Math.max(height, 200);

        // ── Position: prefer percentage, fallback legacy pixel, else centered ──
        let x: number;
        let y: number;
        if (pref?.xPct !== undefined && pref?.yPct !== undefined) {
          x = (pref.xPct / 100) * vp.width;
          y = (pref.yPct / 100) * vp.height;
        } else if (pref?.x !== undefined && pref?.y !== undefined && !isMobile) {
          x = pref.x;
          y = pref.y;
        } else {
          const centerPos = getCenterPositionStatic(width, height);
          x = centerPos.x;
          y = centerPos.y;
        }

        const margin = 20;
        x = Math.max(margin, Math.min(x, vp.width - width - margin));
        y = Math.max(margin, Math.min(y, vp.height - height - margin));

        const initialPosition = { x, y };
        const isPinned = pref?.isOpenByDefault || false;
        const zIndex = pref?.zIndex ?? w.zIndex;

        // ── Content sync: ambil fresh content dari baseW, atau hydrate via factory ──
        // Urutan prioritas:
        // 1. Kalau baseW.content fresh dan berbeda dari existing → pakai yang baru (admin update)
        // 2. Kalau content null dan ada factory → hydrate sekali
        // 3. Else pertahankan existing content
        let content = w.content;
        if (baseW.content !== null && baseW.content !== existing?.content) {
          content = baseW.content;
        } else if (content === null && baseW.contentFactory) {
          content = baseW.contentFactory();
        }

        // isOpen: preserve runtime state. Kalau belum ada visitor session,
        // follow admin template/default lama (about terbuka di desktop).
        const isOpen = w.isOpen ?? (w.id === 'about' ? true : pref?.isOpenByDefault || false);

        const reconciledWindow = {
          ...w,
          content,
          isOpen,
          isPinned,
          width,
          height,
          zIndex,
          initialPosition,
        };

        return applyVisitorWindowSnapshot(reconciledWindow, visitorSession?.windows?.[baseW.id]);
      });

      // Preserve custom/dynamic windows yang tidak di initialWindows (mis. project windows)
      const dynamic = prev.filter((w) => !initialWindows.some((iw) => iw.id === w.id));

      return [...reconciled, ...dynamic];
    });

    if (!isAdmin) {
      hasAppliedVisitorSessionRef.current = true;
    }
  }, [aboutData, initialWindows, setWindows, getCenterPositionStatic, isAdmin]);
}
