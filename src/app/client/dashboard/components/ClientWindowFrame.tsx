'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { FolderKanban } from 'lucide-react';

export interface ClientWindowState {
  id: string;
  moduleId: 'projects' | 'content' | 'system' | 'communication' | 'analytics';
  title: string;
  icon: typeof FolderKanban;
  iconColor: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const SPRING_TENSION = 0.08;
const SPRING_FRICTION = 0.82;
const SKEW_FACTOR = 6;
const STRETCH_FACTOR = 0.025;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

interface SpringState {
  skewX: number;
  scaleX: number;
  scaleY: number;
}

const SPRING_REST: SpringState = { skewX: 0, scaleX: 1, scaleY: 1 };

function springRest(): SpringState {
  return { ...SPRING_REST };
}

export function ClientWindowFrame({
  win,
  onClose,
  onMinimize,
  onToggleMaximize,
  onBringToFront,
  onUpdatePosition,
  onUpdateSize,
  children,
}: {
  win: ClientWindowState;
  onClose: (id: string) => void;
  onMinimize: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  onBringToFront: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateSize: (id: string, w: number, h: number) => void;
  children: React.ReactNode;
}) {
  const windowRef = useRef<HTMLDivElement | null>(null);

  const springCur = useRef<SpringState>(springRest());
  const springVel = useRef<SpringState>(springRest());
  const springTgt = useRef<SpringState>(springRest());
  const rafId = useRef<number | null>(null);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    lastX: number;
    lastY: number;
    lastTime: number;
    smoothVx: number;
    smoothVy: number;
    reducedMotion: boolean;
  } | null>(null);

  const resizeRef = useRef<{
    startX: number;
    startY: number;
    originW: number;
    originH: number;
  } | null>(null);

  const dragCleanupRef = useRef<(() => void) | null>(null);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      resizeCleanupRef.current?.();
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  const applySpring = useCallback(() => {
    const el = windowRef.current;
    if (!el) return;
    const c = springCur.current;
    el.style.setProperty('--jw-skew', `${c.skewX.toFixed(3)}deg`);
    el.style.setProperty('--jw-sx', c.scaleX.toFixed(4));
    el.style.setProperty('--jw-sy', c.scaleY.toFixed(4));
  }, []);

  const ensureSpringLoop = useCallback(() => {
    if (rafId.current !== null) return;

    const tick = () => {
      const cur = springCur.current;
      const vel = springVel.current;
      const tgt = springTgt.current;

      let settled = true;

      for (const k of ['skewX', 'scaleX', 'scaleY'] as const) {
        const force = (tgt[k] - cur[k]) * SPRING_TENSION;
        vel[k] = (vel[k] + force) * SPRING_FRICTION;
        cur[k] += vel[k];

        if (Math.abs(vel[k]) > 0.001 || Math.abs(tgt[k] - cur[k]) > 0.001) {
          settled = false;
        }
      }

      applySpring();

      if (settled && !dragRef.current) {
        Object.assign(cur, springRest());
        applySpring();
        windowRef.current?.classList.remove('admin-window-wobbling');
        rafId.current = null;
      } else {
        rafId.current = requestAnimationFrame(tick);
      }
    };

    rafId.current = requestAnimationFrame(tick);
  }, [applySpring]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (win.isMaximized) return;
      e.preventDefault();
      onBringToFront(win.id);
      dragCleanupRef.current?.();

      const reduced = prefersReducedMotion();

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: win.x,
        originY: win.y,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: performance.now(),
        smoothVx: 0,
        smoothVy: 0,
        reducedMotion: reduced,
      };

      windowRef.current?.classList.add('admin-window-wobbling');
      springVel.current = { skewX: 0, scaleX: 0, scaleY: 0 };
      springTgt.current = springRest();

      if (!reduced) ensureSpringLoop();

      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (!d) return;

        const dx = ev.clientX - d.startX;
        const dy = ev.clientY - d.startY;

        onUpdatePosition(win.id, d.originX + dx, d.originY + dy);

        const now = performance.now();
        const dt = Math.max(1, now - d.lastTime);
        const rawVx = (ev.clientX - d.lastX) / dt;
        const rawVy = (ev.clientY - d.lastY) / dt;
        d.smoothVx = d.smoothVx * 0.6 + rawVx * 0.4;
        d.smoothVy = d.smoothVy * 0.6 + rawVy * 0.4;

        d.lastX = ev.clientX;
        d.lastY = ev.clientY;
        d.lastTime = now;

        if (d.reducedMotion) return;

        const vx = clamp(d.smoothVx, -6, 6);
        const vy = clamp(d.smoothVy, -6, 6);

        const tgt = springTgt.current;
        tgt.skewX = clamp(vx * -SKEW_FACTOR, -12, 12);

        const speed = Math.hypot(vx, vy);
        const s = Math.min(speed, 4) * STRETCH_FACTOR;
        tgt.scaleX = 1 + s;
        tgt.scaleY = 1 - s * 0.5;
      };

      const idleInterval = setInterval(() => {
        const d = dragRef.current;
        if (!d) return;
        if (performance.now() - d.lastTime > 50) {
          springTgt.current = springRest();
          d.smoothVx = 0;
          d.smoothVy = 0;
        }
      }, 60);

      const onUp = () => {
        clearInterval(idleInterval);
        dragRef.current = null;

        springTgt.current = springRest();

        if (reduced) {
          springCur.current = springRest();
          springVel.current = { skewX: 0, scaleX: 0, scaleY: 0 };
          applySpring();
          windowRef.current?.classList.remove('admin-window-wobbling');
        }

        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        dragCleanupRef.current = null;
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      dragCleanupRef.current = onUp;
    },
    [win.id, win.x, win.y, win.isMaximized, onBringToFront, onUpdatePosition, ensureSpringLoop, applySpring]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (win.isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      onBringToFront(win.id);
      resizeCleanupRef.current?.();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originW: win.width,
        originH: win.height,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const dx = ev.clientX - resizeRef.current.startX;
        const dy = ev.clientY - resizeRef.current.startY;
        onUpdateSize(
          win.id,
          Math.max(480, resizeRef.current.originW + dx),
          Math.max(320, resizeRef.current.originH + dy)
        );
      };

      const cleanupResize = () => {
        resizeRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', cleanupResize);
        resizeCleanupRef.current = null;
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', cleanupResize);
      resizeCleanupRef.current = cleanupResize;
    },
    [win.id, win.width, win.height, win.isMaximized, onBringToFront, onUpdateSize]
  );

  if (win.isMinimized) return null;

  const Icon = win.icon;
  const isMax = win.isMaximized;

  const style: React.CSSProperties = isMax
    ? { inset: 0, width: '100%', height: '100%', zIndex: win.zIndex }
    : {
        left: win.x,
        top: win.y,
        width: win.width,
        height: win.height,
        zIndex: win.zIndex,
      };

  return (
    <div
      ref={windowRef}
      className={`admin-window ${isMax ? 'admin-window-maximized' : ''}`}
      style={style}
      onMouseDown={() => onBringToFront(win.id)}
    >
      {/* Title bar */}
      <div className="admin-window-titlebar" onMouseDown={handleDragStart}>
        {/* macOS traffic light buttons */}
        <div className="admin-window-buttons group">
          <button
            type="button"
            className="admin-window-btn admin-window-btn-close"
            style={{
              width: 12,
              height: 12,
              minWidth: 12,
              minHeight: 12,
              padding: 0,
              border: '1px solid #e0443e',
              background: '#ff5f57',
              borderRadius: '9999px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'transparent',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onClose(win.id);
            }}
            title="Tutup"
          >
            <svg
              viewBox="0 0 12 12"
              width={8}
              height={8}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'rgba(0,0,0,0.6)' }}
            >
              <path
                d="M3.5 3.5l5 5M8.5 3.5l-5 5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="admin-window-btn admin-window-btn-minimize"
            style={{
              width: 12,
              height: 12,
              minWidth: 12,
              minHeight: 12,
              padding: 0,
              border: '1px solid #dda335',
              background: '#febc2e',
              borderRadius: '9999px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'transparent',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onMinimize(win.id);
            }}
            title="Minimize"
          >
            <svg
              viewBox="0 0 12 12"
              width={8}
              height={8}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'rgba(0,0,0,0.6)' }}
            >
              <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            className="admin-window-btn admin-window-btn-maximize"
            style={{
              width: 12,
              height: 12,
              minWidth: 12,
              minHeight: 12,
              padding: 0,
              border: '1px solid #22aa32',
              background: '#28c840',
              borderRadius: '9999px',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'transparent',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMaximize(win.id);
            }}
            title={isMax ? 'Restore' : 'Maximize'}
          >
            <svg
              viewBox="0 0 12 12"
              width={8}
              height={8}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: 'rgba(0,0,0,0.6)' }}
            >
              {isMax ? (
                <path
                  d="M3 3l6 6M9 3l-6 6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              ) : (
                <>
                  <path
                    d="M2 4.5L6 2l4 2.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M2 7.5L6 10l4-2.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </>
              )}
            </svg>
          </button>
        </div>

        <div className="admin-window-title">
          <Icon className={`h-4 w-4 ${win.iconColor}`} />
          <span>{win.title}</span>
        </div>

        <div style={{ width: 52 }} />
      </div>

      {/* Body */}
      <div className="admin-window-body">{children}</div>

      {/* Resize handle */}
      {!isMax && (
        <div
          className="admin-window-resize-handle"
          onMouseDown={handleResizeStart}
          title="Tarik untuk mengubah ukuran"
        />
      )}
    </div>
  );
}
