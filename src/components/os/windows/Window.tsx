// ═══════════════════════════════════════════════════════════════════
// SECTION MAP
// Imports, types, and animation constants
// OSWindow: drag/resize, z-index focus, minimize/maximize, and title bar
// Body drag eligibility lives in ../utils/windowBodyDrag.
// ═══════════════════════════════════════════════════════════════════
'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { m, useDragControls, AnimatePresence, Transition, TargetAndTransition } from 'motion/react';
import { useWindowResize } from '../hooks/useWindowResize';
import { useWindowKeyboard } from '../hooks/useWindowKeyboard';
import { useJellyDrag } from '../hooks/useJellyDrag';
import { WindowTitleBar } from './components/WindowTitleBar';
import { WindowResizeHandles } from './components/WindowResizeHandles';
import { shouldStartWindowBodyDrag } from '../utils/windowBodyDrag';
import type { MissionTarget } from '../utils/missionControlLayout';

// Module-level constants to avoid re-creation per render
const SHELL_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.80)',
  filter: 'blur(0px) saturate(1)',
} as const;

const SHELL_STYLE_MAXIMIZED = {
  backgroundColor: 'rgba(255,255,255,0.88)',
  filter: 'blur(0px) saturate(1)',
} as const;

const MINIMIZED_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.62)',
  filter: 'blur(10px) saturate(0.9)',
} as const;

const WINDOW_OPEN_BOUNCE = {
  type: 'spring',
  stiffness: 260,
  damping: 16,
  mass: 0.86,
} as const;

const WINDOW_POSITION_SETTLE = {
  duration: 0.34,
  ease: [0.32, 0.72, 0, 1],
} as const;

const WINDOW_SIZE_BOUNCE = {
  type: 'spring',
  stiffness: 240,
  damping: 17,
  mass: 0.9,
} as const;

const WINDOW_EXIT_BOUNCE = {
  type: 'spring',
  stiffness: 330,
  damping: 18,
  mass: 0.78,
} as const;

const WINDOW_EXIT_POSITION_SETTLE = {
  duration: 0.24,
  ease: [0.4, 0, 0.2, 1],
} as const;

const WINDOW_ICON_MORPH_CLOSE = {
  duration: 0.28,
  ease: [0.4, 0, 0.2, 1],
} as const;

interface WindowProps {
  id: string;
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  isMinimized?: boolean;
  isMaximized?: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onFocus?: () => void;
  zIndex?: number;
  initialPosition?: { x: number; y: number }; // Default position
  minimizeTarget?: { x: number; y: number }; // Target for minimize animation
  noPadding?: boolean;
  onUpdatePosition?: (x: number, y: number) => void;
  width?: number;
  height?: number;
  onResize?: (width: number, height: number) => void;
  onResizeEnd?: (width: number, height: number) => void;
  isPinned?: boolean;
  onTogglePin?: () => void;
  isAdmin?: boolean;
  animationVariant?: 'genie' | 'scale' | 'tv' | 'snap';
  isFocused?: boolean;
  /** Origin rect from the icon that launched this window (for Apple-style morph) */
  originRect?: { x: number; y: number; width: number; height: number };
  /** Mission Control target position/size/scale */
  missionTarget?: MissionTarget | null;
  /** Called when window is clicked during Mission Control */
  onMissionControlSelect?: () => void;
}

export default function OSWindow({
  id,
  title,
  children,
  isOpen,
  isMinimized = false,
  isMaximized = false,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  zIndex = 10,
  initialPosition = { x: 100, y: 100 },
  noPadding = false,
  onUpdatePosition,
  width,
  height,
  onResize,
  onResizeEnd,
  isPinned = false,
  onTogglePin,
  isAdmin = false,
  isFocused = false,
  originRect,
  missionTarget,
  onMissionControlSelect,
}: WindowProps) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [isSnapped, setIsSnapped] = useState<'left' | 'right' | false>(false);
  const [dragSnapPreview, setDragSnapPreview] = useState<'left' | 'right' | 'maximize' | null>(
    null
  );
  const preSnapFrameRef = useRef<{ x: number; y: number; width: number; height: number } | null>(
    null
  );

  // ── Jelly Physics ──
  // Single source of truth lewat useJellyDrag (shared dengan DraggableStickyNote).
  // Setup hook + jellyEnabled computation di bawah, setelah isResizing/isSmallScreen
  // tersedia (lihat block "// Jelly drag setup" di body).

  // RESIZE FIX: viewport sekarang dynamic — rotate device / resize browser
  // akan me-recompute maximizedFrame + clamps agar window tidak keluar layar.
  const [viewport, setViewport] = useState(() => {
    if (typeof window !== 'undefined') {
      return { width: window.innerWidth, height: window.innerHeight };
    }
    return { width: 1440, height: 900 };
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId = 0;
    const onResize = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  const viewportWidth = viewport.width;
  const viewportHeight = viewport.height;

  const { isSmallScreen, winWidth } = useMemo(() => {
    const isMobile = viewportWidth < 768;
    const isTablet = viewportWidth >= 768 && viewportWidth < 1024;
    return {
      isSmallScreen: isMobile || isTablet,
      winWidth: isMobile ? viewportWidth : isTablet ? Math.min(viewportWidth - 32, 700) : 600,
    };
  }, [viewportWidth]);

  const dragControls = useDragControls();

  const handleMaximize = useCallback(() => {
    onMaximize?.();
  }, [onMaximize]);

  const { handleKeyDown } = useWindowKeyboard({ onClose, onMinimize, onMaximize: handleMaximize });
  const { dynamicSize, isResizing, handleResizeStart } = useWindowResize({
    initialWidth: width,
    initialHeight: height,
    onResize,
    onResizeEnd,
  });

  const measuredWidth = dynamicSize.width || width || winWidth;
  const measuredHeight = dynamicSize.height || height || 600;

  const handleWrappedResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent | React.PointerEvent, direction: 'e' | 's' | 'se') => {
      setIsSnapped(false);
      preSnapFrameRef.current = null;
      handleResizeStart(e, direction);
    },
    [handleResizeStart]
  );

  const handleSnap = useCallback(
    (layout: 'left' | 'right' | 'maximize') => {
      if (layout === 'maximize') {
        handleMaximize();
        return;
      }

      const vpW = viewportWidth;
      const vpH = viewportHeight;
      const snapW = Math.floor(vpW / 2);
      const snapH = vpH - 46;

      if (!isSnapped) {
        preSnapFrameRef.current = {
          x: initialPosition.x,
          y: initialPosition.y,
          width: measuredWidth,
          height: measuredHeight,
        };
      }

      if (isMaximized) {
        onMaximize?.();
      }

      setIsSnapped(layout);
      onUpdatePosition?.(layout === 'left' ? 0 : Math.floor(vpW / 2), 36);
      onResize?.(snapW, snapH);
      onResizeEnd?.(snapW, snapH);
    },
    [
      isSnapped,
      viewportWidth,
      viewportHeight,
      initialPosition,
      measuredWidth,
      measuredHeight,
      onUpdatePosition,
      onResize,
      onResizeEnd,
      handleMaximize,
      isMaximized,
      onMaximize,
    ]
  );

  // ── Jelly drag setup ──
  // Disable persis saat drag itu sendiri di-disable: maximized, resizing, mobile,
  // atau pinned non-admin. Hook akan abort jelly state mid-drag kalau enabled flip ke false
  // (cegah bug #6: jellyDragRef + idleInterval stuck saat resize handle ke-grab mid-drag).
  const isMissionControlActive = !!missionTarget;
  const jellyEnabled =
    !isMaximized &&
    !isSnapped &&
    !isResizing &&
    !isSmallScreen &&
    (!isPinned || isAdmin) &&
    !isMissionControlActive;
  const {
    attachRef: attachJellyRef,
    onDragStart: jellyOnDragStart,
    onDrag: jellyOnDrag,
    onDragEnd: jellyOnDragEnd,
    transformTemplate: jellyTransformTemplate,
  } = useJellyDrag({ enabled: jellyEnabled });

  // Wire jelly attachRef + windowRef ke single ref callback. Pattern ini sesuai
  // dengan react-hooks/refs (tidak akses .current di render) dan react-hooks/immutability
  // (tidak modify return value hook).
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      windowRef.current = el;
      attachJellyRef(el);
    },
    [attachJellyRef]
  );

  const handleWindowBodyPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (isMissionControlActive) return;
      if (!jellyEnabled || !shouldStartWindowBodyDrag(event, event.currentTarget)) return;

      dragControls.start(event);
    },
    [dragControls, jellyEnabled, isMissionControlActive]
  );

  // Handle auto-focus when window becomes active
  useEffect(() => {
    if (isFocused && windowRef.current) {
      windowRef.current.focus({ preventScroll: true });
    }
  }, [isFocused]);

  const normalFrame = useMemo(
    () => ({
      x: isSmallScreen ? 8 : initialPosition.x,
      y: isSmallScreen ? 44 : initialPosition.y, // 36px menubar + 8px gap
      width: isSmallScreen ? viewportWidth - 16 : measuredWidth,
      height: isSmallScreen ? viewportHeight - 146 : measuredHeight, // leaves room for dock + generous gap margins
    }),
    [
      isSmallScreen,
      initialPosition.x,
      initialPosition.y,
      measuredWidth,
      measuredHeight,
      viewportWidth,
      viewportHeight,
    ]
  );

  const maximizedFrame = useMemo(
    () => ({
      x: 10,
      y: 36,
      width: Math.max(viewportWidth - 20, 320),
      height: Math.max(viewportHeight - 46, 240),
    }),
    [viewportWidth, viewportHeight]
  );

  const snappedFrame = useMemo(() => {
    if (isSnapped === 'left') {
      return {
        x: 0,
        y: 36,
        width: Math.floor(viewportWidth / 2),
        height: viewportHeight - 46,
      };
    }
    if (isSnapped === 'right') {
      const w = Math.floor(viewportWidth / 2);
      return {
        x: w,
        y: 36,
        width: w,
        height: viewportHeight - 46,
      };
    }
    return null;
  }, [isSnapped, viewportWidth, viewportHeight]);

  const activeFrame = isMaximized ? maximizedFrame : snappedFrame || normalFrame;

  const shellStyle = useMemo(() => {
    const base = isMaximized ? SHELL_STYLE_MAXIMIZED : SHELL_STYLE;
    if (isSmallScreen) {
      return {
        ...base,
        backgroundColor: 'rgba(255, 255, 255, 0.94)', // More opaque fallback for mobile legibility
      };
    }
    return base;
  }, [isMaximized, isSmallScreen]);

  // ── Animation states based on originRect (icon position) ──
  // When originRect is available: window expands FROM icon and shrinks BACK to icon
  const hasOrigin = !!originRect;

  // Entry: start at icon's position and size, then expand to full window
  const entryState = hasOrigin
    ? {
        x: originRect!.x,
        y: originRect!.y,
        width: originRect!.width,
        height: originRect!.height,
        opacity: 0,
        scale: 1,
        borderRadius: 12, // Match iOS icon radius roughly
        backgroundColor: 'rgba(255,255,255,0.40)',
        filter: 'blur(6px) saturate(0.80)',
      }
    : {
        x: activeFrame.x,
        y: activeFrame.y,
        scale: 0.85,
        opacity: 0,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.70)',
        filter: 'blur(4px) saturate(0.92)',
      };

  // Minimized / Close target: shrink back into icon position
  const minimizedState = hasOrigin
    ? {
        x: originRect!.x,
        y: originRect!.y,
        width: originRect!.width,
        height: originRect!.height,
        scale: 1,
        opacity: 0,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.30)',
        filter: 'blur(10px) saturate(0.6)',
      }
    : {
        x: activeFrame.x,
        y: Math.min(activeFrame.y + 72, Math.max(viewportHeight - 80, activeFrame.y)),
        scale: 0.76,
        opacity: 0,
        borderRadius: 26,
        ...MINIMIZED_STYLE,
      };

  const activeState = {
    x: activeFrame.x,
    y: activeFrame.y,
    scale: 1,
    opacity: 1,
    width: activeFrame.width,
    height: activeFrame.height,
    borderRadius: isMaximized ? 14 : 22, // iOS-style window radius
    ...shellStyle,
  };

  // Bounce physics for open, maximize, restore, and unminimize.
  const standardTransition = {
    x: WINDOW_POSITION_SETTLE,
    y: WINDOW_POSITION_SETTLE,
    width: WINDOW_SIZE_BOUNCE,
    height: WINDOW_SIZE_BOUNCE,
    scale: WINDOW_OPEN_BOUNCE,
    opacity: { duration: 0.2, ease: 'easeOut' },
    borderRadius: { duration: 0.42, ease: [0.32, 0.72, 0, 1] },
    filter: { duration: 0.24, ease: 'easeOut' },
    backgroundColor: { duration: 0.24, ease: 'easeOut' },
  } as Transition;

  // Minimize/close snaps away with a visible rebound.
  const minimizeTransition = {
    x: WINDOW_EXIT_POSITION_SETTLE,
    y: WINDOW_EXIT_POSITION_SETTLE,
    width: WINDOW_EXIT_BOUNCE,
    height: WINDOW_EXIT_BOUNCE,
    scale: WINDOW_EXIT_BOUNCE,
    opacity: { duration: 0.26, ease: 'easeIn' },
    borderRadius: { duration: 0.28, ease: 'easeIn' },
    filter: { duration: 0.22, ease: 'easeIn' },
    backgroundColor: { duration: 0.22, ease: 'easeIn' },
  } as Transition;

  const iconMorphCloseTransition = {
    x: WINDOW_ICON_MORPH_CLOSE,
    y: WINDOW_ICON_MORPH_CLOSE,
    width: WINDOW_ICON_MORPH_CLOSE,
    height: WINDOW_ICON_MORPH_CLOSE,
    scale: { duration: 0.18, ease: 'easeOut' },
    opacity: { duration: 0.22, ease: 'easeIn' },
    borderRadius: { duration: 0.2, ease: 'easeIn' },
    filter: { duration: 0.2, ease: 'easeIn' },
    backgroundColor: { duration: 0.2, ease: 'easeIn' },
  } as Transition;

  // Exit: fly back into icon position
  const exitState = hasOrigin
    ? ({
        ...minimizedState,
        transition: iconMorphCloseTransition,
      } as TargetAndTransition)
    : ({
        y: Math.min(activeFrame.y + 44, Math.max(viewportHeight - 80, activeFrame.y)),
        scale: [1, 1.045, 0.82],
        opacity: [1, 1, 0],
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.66)',
        filter: 'blur(4px) saturate(0.92)',
        transition: {
          y: WINDOW_EXIT_BOUNCE,
          opacity: { duration: 0.26, times: [0, 0.45, 1] },
          scale: { duration: 0.3, times: [0, 0.24, 1], ease: [0.32, 0.72, 0, 1] },
          filter: { duration: 0.18 },
        },
      } as TargetAndTransition);

  return (
    <>
      <AnimatePresence>
        {isOpen && dragSnapPreview && (
          <m.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 0.35, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="pointer-events-none fixed rounded-2xl border border-white/50 bg-white/20 shadow-xl backdrop-blur-md transition-all duration-300 ease-out"
            style={{
              zIndex: zIndex - 1,
              left:
                dragSnapPreview === 'left'
                  ? 0
                  : dragSnapPreview === 'right'
                    ? Math.floor(viewportWidth / 2)
                    : 10,
              top: 36,
              width:
                dragSnapPreview === 'left' || dragSnapPreview === 'right'
                  ? Math.floor(viewportWidth / 2)
                  : viewportWidth - 20,
              height: viewportHeight - 46,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-medium tracking-wide text-white/95 backdrop-blur-sm">
                Lepas untuk membagi layar
              </span>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <m.div
            ref={setRefs}
            drag={
              !isMissionControlActive &&
              !isMaximized &&
              !isResizing &&
              (!isPinned || isAdmin) &&
              !isSmallScreen
            }
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            onDragStart={(e, info) => {
              jellyOnDragStart(e, info);
            }}
            onDrag={(e, info) => {
              jellyOnDrag(e, info);

              // Unsnap if dragging a snapped window
              if (isSnapped && preSnapFrameRef.current) {
                const restoredW = preSnapFrameRef.current.width;
                const restoredH = preSnapFrameRef.current.height;

                // Clear ref synchronously to prevent double execution in subsequent drag frames
                preSnapFrameRef.current = null;
                setIsSnapped(false);

                // Find the absolute pointer coordinates when drag started
                const startX = info.point.x - info.offset.x;
                const startY = info.point.y - info.offset.y;

                // Center the restored window horizontally under the cursor
                const newX = startX - restoredW / 2;
                const newY = startY - 16; // 16px is half of 32px title bar

                onUpdatePosition?.(newX, newY);
                onResize?.(restoredW, restoredH);
                onResizeEnd?.(restoredW, restoredH);
              }

              // Live preview silhouette calculation
              if (!isMaximized && (!isPinned || isAdmin) && !isSmallScreen) {
                const vpW = viewportWidth;
                const pointerX = info.point.x;
                const pointerY = info.point.y;
                const snapMarginX = Math.max(25, vpW * 0.02);
                const snapMarginY = 38;

                if (pointerX < snapMarginX) {
                  setDragSnapPreview('left');
                } else if (pointerX > vpW - snapMarginX) {
                  setDragSnapPreview('right');
                } else if (pointerY < snapMarginY) {
                  setDragSnapPreview('maximize');
                } else {
                  setDragSnapPreview(null);
                }
              }
            }}
            onDragEnd={(_, info) => {
              jellyOnDragEnd();
              setDragSnapPreview(null);
              if (isMissionControlActive) return;
              if (!isMaximized && !isMinimized && (!isPinned || isAdmin) && onUpdatePosition) {
                const newX = initialPosition.x + info.offset.x;
                const newY = initialPosition.y + info.offset.y;

                // ── Window Snapping ──
                // Priority: left/right half-snap > top maximize
                // supaya drag ke pojok gak trigger maximize duluan.
                const vpW = viewportWidth;
                const vpH = viewportHeight;
                const pointerX = info.point.x;
                const pointerY = info.point.y;
                const snapMarginX = Math.max(25, vpW * 0.02); // 2% of screen or min 25px
                const snapMarginY = 38; // Menu bar is 36px, trigger snap within 38px of the top edge

                if (pointerX < snapMarginX) {
                  const snapW = Math.floor(vpW / 2);
                  const snapH = vpH - 46;
                  if (!isSnapped) {
                    preSnapFrameRef.current = {
                      x: initialPosition.x,
                      y: initialPosition.y,
                      width: measuredWidth,
                      height: measuredHeight,
                    };
                    setIsSnapped('left');
                  }
                  onUpdatePosition?.(0, 36);
                  onResize?.(snapW, snapH);
                  onResizeEnd?.(snapW, snapH);
                  return;
                }

                if (pointerX > vpW - snapMarginX) {
                  const snapW = Math.floor(vpW / 2);
                  const snapH = vpH - 46;
                  if (!isSnapped) {
                    preSnapFrameRef.current = {
                      x: initialPosition.x,
                      y: initialPosition.y,
                      width: measuredWidth,
                      height: measuredHeight,
                    };
                    setIsSnapped('right');
                  }
                  onUpdatePosition?.(Math.floor(vpW / 2), 36);
                  onResize?.(snapW, snapH);
                  onResizeEnd?.(snapW, snapH);
                  return;
                }

                if (pointerY < snapMarginY) {
                  handleMaximize();
                  return;
                }

                onUpdatePosition(newX, newY);
              }
            }}
            transformTemplate={jellyTransformTemplate}
            initial={
              hasOrigin
                ? {
                    ...entryState,
                  }
                : {
                    ...entryState,
                    width: activeFrame.width,
                    height: activeFrame.height,
                  }
            }
            animate={
              isMissionControlActive && missionTarget
                ? {
                    x: missionTarget.x,
                    y: missionTarget.y,
                    scale: missionTarget.scale,
                    width: missionTarget.width,
                    height: missionTarget.height,
                    opacity: 1,
                    borderRadius: 18,
                    ...shellStyle,
                  }
                : isMinimized
                  ? minimizedState
                  : activeState
            }
            transition={
              isResizing
                ? { duration: 0 }
                : isMissionControlActive
                  ? standardTransition
                  : isMinimized
                    ? minimizeTransition
                    : standardTransition
            }
            exit={exitState}
            layout={false}
            onPointerDown={(_e) => {
              if (isMissionControlActive && onMissionControlSelect) {
                onMissionControlSelect();
              } else {
                onFocus?.();
              }
            }}
            onKeyDown={isMissionControlActive ? undefined : handleKeyDown}
            tabIndex={0}
            aria-modal="true"
            role="dialog"
            aria-label={title}
            data-window-id={id}
            data-testid="window-frame"
            style={{
              position: 'absolute',
              zIndex: zIndex,
              top: 0,
              left: 0,
              transformOrigin: '50% 50%',
              pointerEvents: isMinimized ? 'none' : 'auto',
              backdropFilter: isMinimized
                ? 'none'
                : isSmallScreen
                  ? 'none' // Disable GPU intensive backdrop filter on mobile
                  : isFocused
                    ? 'blur(24px) saturate(1.2)'
                    : 'blur(12px) saturate(1)',
              transition: 'backdrop-filter 0.3s ease',
            }}
            data-lenis-prevent
            className="flex flex-col overflow-hidden rounded-[18px] border border-white/45 outline-none will-change-transform"
          >
            {/* Title Bar */}
            <WindowTitleBar
              title={title}
              isMaximized={isMaximized}
              isPinned={isPinned}
              isAdmin={isAdmin}
              onClose={
                isMissionControlActive && onMissionControlSelect ? onMissionControlSelect : onClose
              }
              onMinimize={
                isMissionControlActive && onMissionControlSelect
                  ? onMissionControlSelect
                  : onMinimize
              }
              onMaximize={
                isMissionControlActive && onMissionControlSelect
                  ? onMissionControlSelect
                  : handleMaximize
              }
              onTogglePin={isMissionControlActive ? undefined : onTogglePin}
              onDragStart={(e) => dragControls.start(e)}
              onFocus={onFocus}
              onSnap={handleSnap}
            />

            {/* Window Content */}
            <div
              data-lenis-prevent
              onPointerDown={handleWindowBodyPointerDown}
              style={{ touchAction: 'auto' }}
              className={`relative w-full flex-1 overflow-hidden bg-white/50 ${noPadding ? '' : 'p-4'}`}
            >
              {children}

              {/* Safe Zone for Resize Overlays (Only if not maximized and resizable) */}
              {!isMissionControlActive && !isMaximized && !isSmallScreen && onResize && (
                <WindowResizeHandles onResizeStart={handleWrappedResizeStart} />
              )}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </>
  );
}
