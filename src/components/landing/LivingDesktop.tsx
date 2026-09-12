'use client';

/**
 * LivingDesktop — mini macOS desktop yang "memainkan dirinya sendiri".
 *
 * Kursor palsu (spring-eased) bergerak sendiri: masuk → klik ikon dock
 * "Projects" → window Finder pop (jelly) berisi galeri karya → kursor
 * menutup window → diam. Loop dengan jeda.
 *
 * Saat pengunjung menyentuh mouse/pointer di dalam frame, choreography
 * berhenti dan kursor asli mereka mengambil alih: window bisa di-drag,
 * dock item bisa di-klik manual (pop window lain). Inilah "living demo"
 * — bukan video, komponen asli yang hidup.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion, AnimatePresence } from 'motion/react';
import Image from 'next/image';

const GALLERY = [
  { src: '/assets/projects/manipulasi-foto-musik-alam.jpg', label: 'Manipulasi Musik' },
  { src: '/assets/projects/tipografi-mekar-gotik.jpg', label: 'Tipografi Gotik' },
  { src: '/assets/projects/pastoral-kawanan-berhalo.jpg', label: 'Pastoral' },
  { src: '/assets/projects/kaleidoskop-tipografi-gradien.jpg', label: 'Kaleidoskop' },
  { src: '/assets/projects/belenggu-sandal-surgawi.jpg', label: 'Belenggu Sandal' },
  { src: '/assets/projects/efek-poster-bunga-berkerut.jpg', label: 'Poster Bunga' },
];

const DOCK_APPS = [
  { id: 'projects', label: 'Projects', emoji: '🗂️' },
  { id: 'about', label: 'About Me', emoji: '🙂' },
  { id: 'contact', label: 'Contact', emoji: '📮' },
  { id: 'notes', label: 'Notes', emoji: '📝' },
] as const;

type DockAppId = (typeof DOCK_APPS)[number]['id'];

interface WindowState {
  id: DockAppId | 'hero';
  x: number;
  y: number;
  z: number;
}

export default function LivingDesktop() {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // ---- fake cursor (spring) ----
  const cursorX = useMotionValue(-60);
  const cursorY = useMotionValue(-60);
  const springConfig = { stiffness: 350, damping: 28, mass: 0.6 };
  const smoothX = useSpring(cursorX, springConfig);
  const smoothY = useSpring(cursorY, springConfig);

  const [autoPlaying, setAutoPlaying] = useState(!reducedMotion);  const [showFakeCursor, setShowFakeCursor] = useState(false);
  const [dockHovered, setDockHovered] = useState<string | null>(null);
  const [windows, setWindows] = useState<WindowState[]>([]);
  const zCounter = useRef(10);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasInteracted = useRef(false);
  const [userTookOver, setUserTookOver] = useState(false);

  const focusWindow = useCallback((id: WindowState['id']) => {
    zCounter.current += 1;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, z: zCounter.current } : w)));
  }, []);

  const openWindow = useCallback((id: WindowState['id']) => {
    setWindows((prev) => {
      if (prev.some((w) => w.id === id)) return prev;
      zCounter.current += 1;
      const base: Record<string, { x: number; y: number }> = {
        projects: { x: 8, y: 14 },
        about: { x: 52, y: 16 },
        contact: { x: 14, y: 42 },
        notes: { x: 56, y: 46 },
      };
      const pos = base[id] ?? { x: 20, y: 20 };
      return [...prev, { id, x: pos.x, y: pos.y, z: zCounter.current }];
    });
  }, []);

  const closeWindow = useCallback((id: WindowState['id']) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
  }, []);

  // ---- choreography ----
  // Choreography coordinates are PERCENT of the stage; converted to px
  // against the live container size so they stay correct on resize.
  const pctToPx = useCallback((xp: number, yp: number): [number, number] => {
    const rect = containerRef.current?.getBoundingClientRect();
    const w = rect?.width ?? 800;
    const h = rect?.height ?? 500;
    return [(xp / 100) * w, (yp / 100) * h];
  }, []);

  const moveTo = useCallback(
    (xPct: number, yPct: number, delay: number, duration = 900) => {
      const timer = setTimeout(() => {
        const [targetX, targetY] = pctToPx(xPct, yPct);
        const startX = cursorX.get();
        const startY = cursorY.get();
        const startTime = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - startTime) / duration);
          // ease-out cubic for natural cursor glide
          const e = 1 - Math.pow(1 - t, 3);
          cursorX.set(startX + (targetX - startX) * e);
          cursorY.set(startY + (targetY - startY) * e);
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, delay);
      timersRef.current.push(timer);
      return timer;
    },
    [cursorX, cursorY, pctToPx]
  );

  const stopChoreography = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setShowFakeCursor(false);
    setAutoPlaying(false);
  }, []);

  // Restart choreography loop.
  const runChoreography = useCallback(() => {
    if (reducedMotion || hasInteracted.current) return;
    setAutoPlaying(true);
    setShowFakeCursor(true);
    setWindows([]);

    const run = () => {
      if (hasInteracted.current) return;
      // 1. cursor glides in from left
      const [sx, sy] = pctToPx(-8, 70);
      cursorX.set(sx);
      cursorY.set(sy);
      moveTo(50, 88, 500, 1000);
      // 2. hover dock "projects"
      moveTo(28, 86, 1600, 700);
      // 3. click → open window
      const clickTimer = setTimeout(() => {
        if (!hasInteracted.current) {
          openWindow('projects');
        }
      }, 2350);
      timersRef.current.push(clickTimer);
      // 4. hover first gallery card
      moveTo(24, 36, 3200, 900);
      // 5. glide to close button
      moveTo(60, 19, 4500, 1000);
      // 6. close window
      const closeTimer = setTimeout(() => {
        if (!hasInteracted.current) {
          closeWindow('projects');
        }
      }, 5600);
      timersRef.current.push(closeTimer);
      // 7. cursor exits, pause, loop
      moveTo(108, 78, 6000, 900);
      const endTimer = setTimeout(() => {
        if (!hasInteracted.current) {
          run();
        }
      }, 7600);
      timersRef.current.push(endTimer);
    };
    run();
  }, [closeWindow, cursorX, cursorY, moveTo, openWindow, pctToPx, reducedMotion]);

  useEffect(() => {
    runChoreography();
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- user takeover ----
  const handleUserIntent = useCallback(() => {
    if (hasInteracted.current) return;
    hasInteracted.current = true;
    setUserTookOver(true);
    stopChoreography();
  }, [stopChoreography]);

  // Manual dock click.
  const handleDockClick = useCallback(
    (id: DockAppId) => {
      handleUserIntent();
      if (windows.some((w) => w.id === id)) {
        focusWindow(id);
      } else {
        openWindow(id);
        focusWindow(id);
      }
    },
    [focusWindow, handleUserIntent, openWindow, windows]
  );

  // Window drag state.
  const dragState = useRef<{ id: WindowState['id']; startX: number; startY: number; winX: number; winY: number } | null>(null);

  const onPointerDownWindow = useCallback(
    (e: React.PointerEvent, win: WindowState) => {
      handleUserIntent();
      focusWindow(win.id);
      // Don't hijack the close button: let its click pass through.
      if ((e.target as HTMLElement).closest('.ld-traffic-close')) return;
      dragState.current = {
        id: win.id,
        startX: e.clientX,
        startY: e.clientY,
        winX: win.x,
        winY: win.y,
      };
      // Capture on the titlebar (currentTarget) so pointermove keeps
      // firing even when the pointer travels over child nodes.
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [focusWindow, handleUserIntent]
  );

  const onPointerMoveWindow = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - ds.startX) / rect.width) * 100;
    const dy = ((e.clientY - ds.startY) / rect.height) * 100;
    setWindows((prev) =>
      prev.map((w) =>
        w.id === ds.id
          ? { ...w, x: Math.min(72, Math.max(-2, ds.winX + dx)), y: Math.min(74, Math.max(2, ds.winY + dy)) }
          : w
      )
    );
  }, []);

  const onPointerUpWindow = useCallback(() => {
    dragState.current = null;
  }, []);

  const getWindowContent = (id: WindowState['id']) => {
    switch (id) {
      case 'projects':
        return (
          <div className="ld-window-body">
            <div className="ld-finder-sidebar">
              <span className="ld-sidebar-item">📁 Karya</span>
              <span className="ld-sidebar-item">🎬 Video</span>
              <span className="ld-sidebar-item">🖼️ Poster</span>
              <span className="ld-sidebar-item">✏️ Sketsa</span>
            </div>
            <div className="ld-finder-grid">
              {GALLERY.map((g) => (
                <figure key={g.src} className="ld-finder-item">
                  <Image src={g.src} alt={g.label} width={160} height={120} className="ld-finder-thumb" />
                  <figcaption>{g.label}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        );
      case 'about':
        return (
          <div className="ld-window-body ld-about">
            <div className="ld-about-avatar">R</div>
            <div>
              <strong>Ramos — Graphic Designer</strong>
              <p>
                14 tahun merancang identitas visual. Sekarang portofolionya hidup di sini —
                bukan di PDF yang nggak pernah dibuka orang.
              </p>
            </div>
          </div>
        );
      case 'contact':
        return (
          <div className="ld-window-body ld-contact">
            <p>📮 ramos@studio.design</p>
            <p>📍 Jakarta, Indonesia</p>
            <p>💬 Balasan &lt; 24 jam</p>
          </div>
        );
      case 'notes':
        return (
          <div className="ld-window-body ld-notes">
            <p>
              ✅ Beli domain 2 tahun lalu
              <br />
              ✅ Masih kosong sampai hari ini
              <br />
              <span>→ Saatnya beresin.</span>
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const getWindowTitle = (id: WindowState['id']) =>
    ({ projects: 'Finder — Karya', about: 'Tentang Saya', contact: 'Kontak', notes: 'Catatan', hero: '' })[id] ?? '';

  return (
    <div
      ref={containerRef}
      className={`ld-stage ${autoPlaying ? 'ld-autoplay' : ''}`}
      onPointerMove={(e) => {
        // Any pointer movement inside the stage = intent (threshold via move distance
        // is overkill here; a single meaningful move is enough to stop the show).
        if (e.movementX !== 0 || e.movementY !== 0) handleUserIntent();
      }}
    >
      {/* wallpaper */}
      <div className="ld-wallpaper" aria-hidden />

      {/* menubar */}
      <div className="ld-menubar" aria-hidden>
        <span className="ld-menubar-logo"></span>
        <span className="ld-menubar-app">Finder</span>
        <span className="ld-menubar-space" />
        <span className="ld-menubar-item">100% 🔋</span>
        <span className="ld-menubar-item">Sen 13 Sep</span>
        <span className="ld-menubar-item">21:04</span>
      </div>

      {/* windows */}
      <AnimatePresence>
        {windows.map((w) => (
          <motion.div
            key={w.id}
            className="ld-window"
            style={{ left: `${w.x}%`, top: `${w.y}%`, zIndex: w.z }}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
          >
            <div
              className="ld-window-titlebar"
              onPointerDown={(e) => onPointerDownWindow(e, w)}
              onPointerMove={onPointerMoveWindow}
              onPointerUp={onPointerUpWindow}
              onPointerCancel={onPointerUpWindow}
            >
              <button
                type="button"
                className="ld-traffic ld-traffic-close"
                aria-label="Tutup jendela"
                onClick={() => closeWindow(w.id)}
              />
              <span className="ld-traffic ld-traffic-min" />
              <span className="ld-traffic ld-traffic-max" />
              <span className="ld-window-title">{getWindowTitle(w.id)}</span>
            </div>
            {getWindowContent(w.id)}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* dock */}
      <div className="ld-dock" role="toolbar" aria-label="Dock">
        {DOCK_APPS.map((app) => {
          const isOpen = windows.some((w) => w.id === app.id);
          return (
            <button
              key={app.id}
              type="button"
              className={`ld-dock-item ${isOpen ? 'ld-dock-open' : ''}`}
              aria-label={`Buka ${app.label}`}
              onClick={() => handleDockClick(app.id)}
              onMouseEnter={() => setDockHovered(app.id)}
              onMouseLeave={() => setDockHovered(null)}
              onFocus={() => setDockHovered(app.id)}
              onBlur={() => setDockHovered(null)}
            >
              <span className="ld-dock-emoji" aria-hidden>{app.emoji}</span>
              {dockHovered === app.id && <span className="ld-dock-tooltip">{app.label}</span>}
              {isOpen && <span className="ld-dock-dot" aria-hidden />}
            </button>
          );
        })}
      </div>

      {/* fake cursor */}
      {showFakeCursor && !reducedMotion && (
        <motion.div className="ld-cursor" style={{ x: smoothX, y: smoothY }} aria-hidden />
      )}

      {/* hint pill */}
      {!userTookOver && autoPlaying && (
        <div className="ld-hint" aria-hidden>
          ← ini bukan video. gerakkan kursormu.
        </div>
      )}
    </div>
  );
}
