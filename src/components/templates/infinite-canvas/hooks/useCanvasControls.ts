'use client';

import { useState, useCallback, useRef } from 'react';

interface CanvasOffset {
  x: number;
  y: number;
}

interface UseCanvasControlsOptions {
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  initialZoom?: number;
}

interface UseCanvasControlsReturn {
  zoom: number;
  offset: CanvasOffset;
  isDragging: boolean;
  hasDragged: boolean;
  handleWheel: (e: React.WheelEvent) => void;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: () => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  panTo: (x: number, y: number, targetZoom?: number) => void;
}

/**
 * Hook untuk mengontrol canvas: drag (pointer), zoom (wheel), dan smooth panTo.
 */
export function useCanvasControls(
  options: UseCanvasControlsOptions = {}
): UseCanvasControlsReturn {
  const {
    minZoom = 0.3,
    maxZoom = 3,
    zoomStep = 0.1,
    initialZoom = 1,
  } = options;

  const [zoom, setZoom] = useState(initialZoom);
  const [offset, setOffset] = useState<CanvasOffset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);

  const dragStart = useRef<CanvasOffset>({ x: 0, y: 0 });
  const offsetStart = useRef<CanvasOffset>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);

  const stopAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      stopAnimation();
      const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
      setZoom((prev) => Math.min(maxZoom, Math.max(minZoom, prev + delta)));
    },
    [minZoom, maxZoom, zoomStep, stopAnimation]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      stopAnimation();
      setIsDragging(true);
      setHasDragged(false);
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetStart.current = { ...offset };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset, stopAnimation]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      if (Math.hypot(dx, dy) > 5) {
        setHasDragged(true);
      }
      setOffset({
        x: offsetStart.current.x + dx,
        y: offsetStart.current.y + dy,
      });
    },
    [isDragging]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const panTo = useCallback(
    (targetCanvasX: number, targetCanvasY: number, targetZoom?: number) => {
      stopAnimation();
      const finalZoom = targetZoom !== undefined ? targetZoom : zoom;
      const startZoom = zoom;
      const startOffset = { ...offset };
      // Canvas transform is: translate(offset.x, offset.y) scale(zoom)
      // To bring canvas coordinate (targetCanvasX, targetCanvasY) to the center (0, 0):
      const targetOffsetX = -targetCanvasX * finalZoom;
      const targetOffsetY = -targetCanvasY * finalZoom;

      const duration = 750; // ms
      const startTime = performance.now();

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = easeOutCubic(progress);

        setOffset({
          x: startOffset.x + (targetOffsetX - startOffset.x) * eased,
          y: startOffset.y + (targetOffsetY - startOffset.y) * eased,
        });

        if (targetZoom !== undefined) {
          setZoom(startZoom + (finalZoom - startZoom) * eased);
        }

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate);
        } else {
          animFrameRef.current = null;
        }
      };

      animFrameRef.current = requestAnimationFrame(animate);
    },
    [offset, zoom, stopAnimation]
  );

  const resetCamera = useCallback(() => {
    panTo(0, 0, initialZoom);
  }, [initialZoom, panTo]);

  const zoomIn = useCallback(() => {
    stopAnimation();
    setZoom((prev) => Math.min(maxZoom, prev + zoomStep));
  }, [maxZoom, zoomStep, stopAnimation]);

  const zoomOut = useCallback(() => {
    stopAnimation();
    setZoom((prev) => Math.max(minZoom, prev - zoomStep));
  }, [minZoom, zoomStep, stopAnimation]);

  return {
    zoom,
    offset,
    isDragging,
    hasDragged,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    resetCamera,
    zoomIn,
    zoomOut,
    panTo,
  };
}
