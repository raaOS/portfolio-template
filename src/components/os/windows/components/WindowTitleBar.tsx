import React from 'react';
import { X, Minus, Plus, Pin, Lock } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

interface WindowTitleBarProps {
  title: string;
  isMaximized: boolean;
  isPinned: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onTogglePin?: () => void;
  onDragStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onFocus?: () => void;
  onSnap?: (layout: 'left' | 'right' | 'maximize') => void;
}

export function WindowTitleBar({
  title,
  isMaximized,
  isPinned,
  isAdmin,
  onClose,
  onMinimize,
  onMaximize,
  onTogglePin,
  onDragStart,
  onFocus,
  onSnap,
}: WindowTitleBarProps) {
  const [showSnapMenu, setShowSnapMenu] = React.useState(false);
  const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setShowSnapMenu(true);
    }, 450);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setShowSnapMenu(false);
  };

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const buttonTransition = {
    type: 'spring' as const,
    stiffness: 500,
    damping: 15,
    mass: 0.5,
  };

  const handleActionFocus = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (onFocus) onFocus();
  };

  return (
    <div
      onPointerDown={(e) => {
        if (!isMaximized && (!isPinned || isAdmin)) {
          onDragStart(e);
        }
      }}
      onDoubleClick={() => {
        if (isPinned && !isAdmin) return;
        onMaximize?.();
      }}
      data-testid="window-title-bar"
      className="relative z-50 flex h-8 shrink-0 cursor-default select-none items-center justify-between border-b border-[#D1D1D1] bg-[#EFEFEF] px-3 sm:h-7"
    >
      {/* Traffic Lights */}
      <div className="group mr-3 flex items-center gap-[8px]">
        {/* Close Button (Red) */}
        <m.button
          whileTap={{ scale: 0.85 }}
          transition={buttonTransition}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onPointerDown={handleActionFocus}
          onDoubleClick={(e) => e.stopPropagation()}
          className="relative flex h-6 min-h-[24px] w-6 min-w-[24px] items-center justify-center rounded-full p-0 outline-none transition-colors focus:outline-none focus:ring-0 active:outline-none"
          aria-label="Close window"
        >
          <div className="relative flex h-3 w-3 items-center justify-center rounded-full border border-[#E0443E] bg-[#FF5F57] transition-all hover:brightness-95 active:brightness-90">
            <X
              size={8}
              className="text-black/60 opacity-0 transition-opacity group-hover:opacity-100"
              strokeWidth={4}
            />
          </div>
        </m.button>

        {/* Minimize Button (Yellow) */}
        <m.button
          whileTap={{ scale: 0.85 }}
          transition={buttonTransition}
          onClick={(e) => {
            e.stopPropagation();
            if (onMinimize) onMinimize();
          }}
          onPointerDown={handleActionFocus}
          onDoubleClick={(e) => e.stopPropagation()}
          className="relative flex h-6 min-h-[24px] w-6 min-w-[24px] items-center justify-center rounded-full p-0 outline-none transition-colors focus:outline-none focus:ring-0 active:outline-none"
          aria-label="Minimize window"
        >
          <div className="relative flex h-3 w-3 items-center justify-center rounded-full border border-[#DDA335] bg-[#FEBC2E] transition-all hover:brightness-95 active:brightness-90">
            <Minus
              size={8}
              className="text-black/60 opacity-0 transition-opacity group-hover:opacity-100"
              strokeWidth={4}
            />
          </div>
        </m.button>

        {/* Maximize Button (Green) wrapped with Snap Layout Menu */}
        <div
          className="relative flex items-center justify-center"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <m.button
            whileTap={{ scale: 0.85 }}
            transition={buttonTransition}
            onClick={(e) => {
              e.stopPropagation();
              if (onMaximize) onMaximize();
            }}
            onPointerDown={handleActionFocus}
            onDoubleClick={(e) => e.stopPropagation()}
            className="relative flex h-6 min-h-[24px] w-6 min-w-[24px] items-center justify-center rounded-full p-0 outline-none transition-colors focus:outline-none focus:ring-0 active:outline-none"
            aria-label="Maximize window"
          >
            <div className="relative flex h-3 w-3 items-center justify-center rounded-full border border-[#22AA32] bg-[#28C840] transition-all hover:brightness-95 active:brightness-90">
              <Plus
                size={8}
                className="text-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                strokeWidth={4}
              />
            </div>
          </m.button>

          <AnimatePresence>
            {showSnapMenu && (
              <m.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                style={{ zIndex: 99999 }}
                className="pointer-events-auto absolute left-0 top-6 flex w-36 flex-col gap-1 rounded-xl border border-black/10 bg-white/95 p-1.5 shadow-xl backdrop-blur-md"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="select-none px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-400">
                  Tata Letak Snap
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSnap?.('left');
                    setShowSnapMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-black/5 active:bg-black/10"
                >
                  <span className="flex h-3.5 w-5 shrink-0 overflow-hidden rounded border border-gray-400 bg-white">
                    <span className="w-1/2 border-r border-gray-400 bg-blue-500/40" />
                    <span className="w-1/2 bg-transparent" />
                  </span>
                  Snap Kiri
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSnap?.('right');
                    setShowSnapMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-black/5 active:bg-black/10"
                >
                  <span className="flex h-3.5 w-5 shrink-0 overflow-hidden rounded border border-gray-400 bg-white">
                    <span className="w-1/2 border-r border-gray-400 bg-transparent" />
                    <span className="w-1/2 bg-blue-500/40" />
                  </span>
                  Snap Kanan
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSnap?.('maximize');
                    setShowSnapMenu(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1 text-left text-xs font-medium text-gray-700 transition-colors hover:bg-black/5 active:bg-black/10"
                >
                  <span className="flex h-3.5 w-5 shrink-0 rounded border border-gray-400 bg-blue-500/40" />
                  Penuhi Layar
                </button>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Title Indicator */}
      <div className="pointer-events-none absolute left-1/2 flex w-[60%] -translate-x-1/2 items-center justify-center gap-1.5 opacity-80">
        <span className="block w-full truncate text-center text-xs font-semibold tracking-wide text-gray-700">
          {title}
        </span>
      </div>

      {/* Top Right Pin/Lock Button - Admin Only */}
      {isAdmin && onTogglePin && (
        <div className="flex items-center gap-2">
          <m.button
            whileTap={{ scale: 0.85 }}
            transition={buttonTransition}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            onPointerDown={handleActionFocus}
            onDoubleClick={(e) => e.stopPropagation()}
            className={`rounded p-1 outline-none transition-colors focus:outline-none focus:ring-0 ${isPinned ? 'text-orange-600' : 'text-gray-400'}`}
            title={isPinned ? 'Unlock Position' : 'Pin/Lock Position'}
          >
            {isPinned ? <Lock size={12} /> : <Pin size={12} />}
          </m.button>
        </div>
      )}
    </div>
  );
}
