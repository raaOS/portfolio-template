'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

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
  handleWheel: (e: React.WheelEvent) => void;
  handlePointerDown: (e: React.PointerEvent) => void;
  handlePointerMove: (e: React.PointerEvent) => void;
  handlePointerUp: () => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

/**
 * Hook untuk mengontrol canvas: drag (pointer) dan zoom (wheel).
 *
 * @example
 * const { zoom, offset, isDragging, handleWheel, handlePointerDown, ... } = useCanvasControls();
 * <div onWheel={handleWheel} onPointerDown={handlePointerDown} ... />
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

  const dragStart = useRef<CanvasOffset>({ x: 0, y: 0 });
  const offsetStart = useRef<CanvasOffset>({ x: 0, y: 0 });

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -zoomStep : zoomStep;
      setZoom((prev) => Math.min(maxZoom, Math.max(minZoom, prev + delta)));
    },
    [minZoom, maxZoom, zoomStep]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY };
      offsetStart.current = { ...offset };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offset]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
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

  const resetCamera = useCallback(() => {
    setZoom(initialZoom);
    setOffset({ x: 0, y: 0 });
  }, [initialZoom]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(maxZoom, prev + zoomStep));
  }, [maxZoom, zoomStep]);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(minZoom, prev - zoomStep));
  }, [minZoom, zoomStep]);

  return {
    zoom,
    offset,
    isDragging,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    resetCamera,
    zoomIn,
    zoomOut,
  };
}
