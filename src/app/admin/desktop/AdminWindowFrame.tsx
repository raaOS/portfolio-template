'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import type { AdminWindowState, AdminDesktopActions } from './types';

interface AdminWindowFrameProps {
  state: AdminWindowState;
  actions: AdminDesktopActions;
  children: React.ReactNode;
}

/* ── Spring constants ─────────────────────────────────────────────
 * tension  → how hard the spring pulls back (higher = snappier)
 * friction → how much energy is lost per frame (lower = bouncier)
 *
 * With tension 0.08 and friction 0.82 the window will overshoot
 * its rest position ~3 times before settling — very Compiz-like.
 * ────────────────────────────────────────────────────────────── */
const SPRING_TENSION = 0.08;
const SPRING_FRICTION = 0.82;

// How much mouse velocity influences each axis
const SKEW_FACTOR = 6; // degrees per px/ms
const STRETCH_FACTOR = 0.025; // scale per px/ms

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

// ── Physics value: current, velocity, target ───────────────────
interface SpringState {
  skewX: number;
  scaleX: number;
  scaleY: number;
}

const SPRING_REST: SpringState = { skewX: 0, scaleX: 1, scaleY: 1 };

function springRest(): SpringState {
  return { ...SPRING_REST };
}

// ────────────────────────────────────────────────────────────────

export default function AdminWindowFrame({ state, actions, children }: AdminWindowFrameProps) {
  const windowRef = useRef<HTMLDivElement | null>(null);

  // Spring simulation state (mutable, never causes re-render)
  const springCur = useRef<SpringState>(springRest());
  const springVel = useRef<SpringState>(springRest()); // velocity — rest values don't matter, overwritten
  const springTgt = useRef<SpringState>(springRest());
  const rafId = useRef<number | null>(null);

  // Drag bookkeeping
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

  // Clean up on unmount
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      resizeCleanupRef.current?.();
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  /* ── Apply spring values to DOM ────────────────────────────── */
  const applySpring = useCallback(() => {
    const el = windowRef.current;
    if (!el) return;
    const c = springCur.current;
    el.style.setProperty('--jw-skew', `${c.skewX.toFixed(3)}deg`);
    el.style.setProperty('--jw-sx', c.scaleX.toFixed(4));
    el.style.setProperty('--jw-sy', c.scaleY.toFixed(4));
  }, []);

  /* ── Start / continue the RAF spring loop ──────────────────── */
  const ensureSpringLoop = useCallback(() => {
    if (rafId.current !== null) return; // already running

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
        // Snap to exact rest to avoid sub-pixel leftovers
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

  /* ═══════════════════════════════════════════════════════════════
     DRAG
     ═══════════════════════════════════════════════════════════════ */
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (state.isMaximized) return;
      e.preventDefault();
      actions.bringToFront(state.id);
      dragCleanupRef.current?.();

      const reduced = prefersReducedMotion();

      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: state.x,
        originY: state.y,
        lastX: e.clientX,
        lastY: e.clientY,
        lastTime: performance.now(),
        smoothVx: 0,
        smoothVy: 0,
        reducedMotion: reduced,
      };

      // Disable CSS transition — RAF takes over
      windowRef.current?.classList.add('admin-window-wobbling');

      // Reset velocity so previous bounce doesn't bleed in
      springVel.current = { skewX: 0, scaleX: 0, scaleY: 0 };
      springTgt.current = springRest();

      if (!reduced) ensureSpringLoop();

      /* ── mousemove ─────────────────────────────────────────── */
      const onMove = (ev: MouseEvent) => {
        const d = dragRef.current;
        if (!d) return;

        const dx = ev.clientX - d.startX;
        const dy = ev.clientY - d.startY;

        // Move window position (React state)
        actions.updatePosition(state.id, d.originX + dx, d.originY + dy);

        // Velocity (px/ms) with exponential smoothing
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

        // Set spring targets based on drag velocity
        const tgt = springTgt.current;
        tgt.skewX = clamp(vx * -SKEW_FACTOR, -12, 12);

        const speed = Math.hypot(vx, vy);
        const s = Math.min(speed, 4) * STRETCH_FACTOR;
        tgt.scaleX = 1 + s;
        tgt.scaleY = 1 - s * 0.5;
      };

      /* ── idle decay: relax targets when mouse stops ────────── */
      const idleInterval = setInterval(() => {
        const d = dragRef.current;
        if (!d) return;
        if (performance.now() - d.lastTime > 50) {
          springTgt.current = springRest();
          d.smoothVx = 0;
          d.smoothVy = 0;
        }
      }, 60);

      /* ── mouseup ───────────────────────────────────────────── */
      const onUp = () => {
        clearInterval(idleInterval);
        dragRef.current = null;

        // Spring targets back to rest — the RAF loop will animate the bounce
        springTgt.current = springRest();

        // If reduced motion, hard-reset everything now
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
    [state.id, state.x, state.y, state.isMaximized, actions, ensureSpringLoop, applySpring]
  );

  /* ═══════════════════════════════════════════════════════════════
     RESIZE (unchanged from original)
     ═══════════════════════════════════════════════════════════════ */
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (state.isMaximized) return;
      e.preventDefault();
      e.stopPropagation();
      actions.bringToFront(state.id);
      resizeCleanupRef.current?.();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        originW: state.width,
        originH: state.height,
      };

      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const dx = ev.clientX - resizeRef.current.startX;
        const dy = ev.clientY - resizeRef.current.startY;
        actions.updateSize(
          state.id,
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
    [state.id, state.width, state.height, state.isMaximized, actions]
  );

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */
  if (state.isMinimized) return null;

  const Icon = state.icon;
  const isMax = state.isMaximized;
  // Jendela zone (container `folder-<zone>`, v1.3.65): titik warna tetap
  // dirender tapi fungsinya dimatikan, drag & resize ikut mati — posisi 2×2
  // terkunci. Jendela CRUD app di dalamnya berperilaku normal.
  const isZone = state.appId.startsWith('folder-');

  const style: React.CSSProperties = isMax
    ? { inset: 0, width: '100%', height: '100%', zIndex: state.zIndex }
    : {
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
        zIndex: state.zIndex,
      };

  return (
    <div
      ref={windowRef}
      className={`admin-window ${isMax ? 'admin-window-maximized' : ''}`}
      style={style}
      onMouseDown={() => actions.bringToFront(state.id)}
    >
      {/* Title bar */}
      <div className="admin-window-titlebar" onMouseDown={isZone ? undefined : handleDragStart}>
        {/* macOS traffic light buttons */}
        <div className="admin-window-buttons group">
          <button
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
              actions.closeWindow(state.id);
            }}
            title={isZone ? undefined : 'Tutup'}
            disabled={isZone}
          >
            <svg
              viewBox="0 0 12 12"
              width={8}
              height={8}
              className={isZone ? 'opacity-0' : 'opacity-0 transition-opacity group-hover:opacity-100'}
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
              actions.minimizeWindow(state.id);
            }}
            title={isZone ? undefined : 'Minimize'}
            disabled={isZone}
          >
            <svg
              viewBox="0 0 12 12"
              width={8}
              height={8}
              className={isZone ? 'opacity-0' : 'opacity-0 transition-opacity group-hover:opacity-100'}
              style={{ color: 'rgba(0,0,0,0.6)' }}
            >
              <path d="M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button
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
              actions.toggleMaximize(state.id);
            }}
            title={isZone ? undefined : isMax ? 'Restore' : 'Maximize'}
            disabled={isZone}
          >
            <svg
              viewBox="0 0 12 12"
              width={8}
              height={8}
              className={isZone ? 'opacity-0' : 'opacity-0 transition-opacity group-hover:opacity-100'}
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

        {/* Title center */}
        <div className="admin-window-title">
          <Icon className={`h-4 w-4 ${state.iconColor}`} />
          <span>{state.title}</span>
        </div>

        {/* Spacer for centering */}
        <div className="admin-window-buttons-spacer" />
      </div>

      {/* Content area */}
      <div className="admin-window-content">{children}</div>

      {/* Resize handle */}
      {!isMax && !isZone && (
        <div className="admin-window-resize-handle" onMouseDown={handleResizeStart} />
      )}
    </div>
  );
}
