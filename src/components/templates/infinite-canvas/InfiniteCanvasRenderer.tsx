'use client';

import React, { useState } from 'react';
import type { TemplateRendererProps } from '@/types/template';
import type { Project } from '@/types/projects';
import { Languages } from 'lucide-react';
import LanguageSwitch from '@/components/shared/LanguageSwitch';
import { HelloIntro } from '@/components/shared/HelloIntro';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useCanvasControls } from './hooks/useCanvasControls';
import { CornerBrackets } from './components/CornerBrackets';
import { CanvasControls, type CanvasGridStyle } from './components/CanvasControls';
import { CanvasProject } from './components/CanvasProject';
import { CanvasProjectSlideOver } from './components/CanvasProjectSlideOver';
import { CanvasLeftDrawer, type CanvasLeftPanelType } from './components/CanvasLeftDrawer';
import { CanvasDock } from './components/CanvasDock';
import { CanvasAdminBar } from './components/CanvasAdminBar';

/**
 * Formasi koordinat 10 aset proyek yang berpencar ke 4 penjuru (Atas, Bawah, Kanan, Kiri)
 * mengelilingi pusat kanvas (0, 0) dengan rotasi artistik dan garansi bebas tabrakan (zero collision).
 *
 * - Atas (North): 3 proyek
 * - Bawah (South): 3 proyek
 * - Kiri (West): 2 proyek
 * - Kanan (East): 2 proyek
 */
const SCATTERED_PROJECT_POSITIONS: Array<{ offsetX: number; offsetY: number; rotate: number }> = [
  // ── ATAS (North) ──
  { offsetX: -320, offsetY: -540, rotate: -2 },
  { offsetX: 0, offsetY: -740, rotate: 1 },
  { offsetX: 320, offsetY: -520, rotate: -1.5 },

  // ── BAWAH (South) ──
  { offsetX: -300, offsetY: 540, rotate: 1.5 },
  { offsetX: 0, offsetY: 740, rotate: -2 },
  { offsetX: 300, offsetY: 560, rotate: 2 },

  // ── KIRI (West) ──
  { offsetX: -720, offsetY: -160, rotate: -2.5 },
  { offsetX: -740, offsetY: 220, rotate: 1.5 },

  // ── KANAN (East) ──
  { offsetX: 720, offsetY: -160, rotate: 2 },
  { offsetX: 740, offsetY: 220, rotate: -1.8 },
];

function getProjectPosition(index: number): { offsetX: number; offsetY: number; rotate: number } {
  return (
    SCATTERED_PROJECT_POSITIONS[index % SCATTERED_PROJECT_POSITIONS.length] || {
      offsetX: 0,
      offsetY: 0,
      rotate: 0,
    }
  );
}

/**
 * InfiniteCanvasRenderer — Template portofolio interaktif Infinite Canvas.
 *
 * Fitur Utama:
 * 1. 10 aset karya terpilih berpencar ke 4 arah (North, South, East, West) di permukaan kanvas.
 * 2. Klik kartu proyek membuka Right Slide-Over Drawer bergaya jendela macOS (bukan modal popup).
 * 3. Bidang gerak kanvas bersih dari widget statis.
 * 4. Dock bawah interaktif dengan 5 ikon (About Me, WA, Project, Hubungi Saya, Noted).
 * 5. Ketika ikon dock diklik, panel meluncur dari sisi KIRI (Left Slide-Over Drawer).
 * 6. Mode Admin & Visitor: Admin dapat men-drag kartu proyek dan menyimpan posisinya ke database D1.
 */
export default function InfiniteCanvasRenderer({ data }: TemplateRendererProps) {
  const { about, projects, hardSkills, experiences, contact, testimonials, site } = data;

  // Batasi tepat 10 aset proyek dari 21 proyek yang tersedia
  const displayProjects = projects ? projects.slice(0, 10) : [];

  // CRUD "Intro Animasi" (v1.3.42): gaya intro dari aboutData.introConfig,
  // default 'hello-orange' (perilaku v1.3.36). 'none' = tanpa intro.
  const introStyle = about?.introConfig?.['infinite-canvas'] ?? 'hello-orange';

  // Deteksi sesi admin dan CSRF token
  const { isAdmin, csrfToken } = useAdminAuth();

  // State mode pratinjau visitor untuk admin
  const [isVisitorPreview, setIsVisitorPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // State untuk project detail (slide-over kanan bergaya macOS)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // State untuk panel slide-over kiri on-demand
  const [activeLeftPanel, setActiveLeftPanel] = useState<CanvasLeftPanelType | null>(null);

  // State gaya grid latar belakang kanvas (dots, blueprint grid, blank) dengan localStorage
  const [gridStyle, setGridStyle] = useState<CanvasGridStyle>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('canvas_grid_style');
        if (saved === 'dots' || saved === 'grid' || saved === 'blank') {
          return saved;
        }
      } catch {
        // ignore
      }
    }
    return 'dots';
  });

  // Inisialisasi posisi: baca dari database Cloudflare D1 (about.desktopPreferences.iconPositions),
  // lalu cache lokal, lalu fallback ke SCATTERED_PROJECT_POSITIONS
  const [projectPositions, setProjectPositions] = useState<
    Record<string, { offsetX: number; offsetY: number; rotate: number }>
  >(() => {
    const initial: Record<string, { offsetX: number; offsetY: number; rotate: number }> = {};
    const savedInDb = about?.desktopPreferences?.iconPositions || {};

    let savedInLocal: Record<string, { x: number; y: number }> = {};
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('infinite_canvas_admin_positions');
        if (raw) savedInLocal = JSON.parse(raw);
      } catch {
        // ignore
      }
    }

    displayProjects.forEach((p, index) => {
      const defaultPos = getProjectPosition(index);
      const localKey = `canvas-${p.id}`;
      const localPos = savedInLocal[localKey];
      const rawDbPos = savedInDb[localKey];
      const dbPos = (rawDbPos && typeof rawDbPos.x === 'number' && typeof rawDbPos.y === 'number')
        ? rawDbPos
        : undefined;

      if (localPos && typeof localPos.x === 'number') {
        initial[p.id] = { offsetX: localPos.x, offsetY: localPos.y, rotate: defaultPos.rotate };
      } else if (dbPos) {
        initial[p.id] = { offsetX: dbPos.x, offsetY: dbPos.y, rotate: defaultPos.rotate };
      } else {
        initial[p.id] = defaultPos;
      }
    });

    return initial;
  });

  const {
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
  } = useCanvasControls({
    minZoom: 0.25,
    maxZoom: 2.5,
    zoomStep: 0.1,
    initialZoom: 0.85,
  });

  // Handler update posisi saat kartu proyek di-drag di Mode Admin
  const handlePositionChange = (id: string, newOffsetX: number, newOffsetY: number) => {
    setProjectPositions((prev) => {
      const current = prev[id];
      return {
        ...prev,
        [id]: {
          offsetX: newOffsetX,
          offsetY: newOffsetY,
          rotate: current?.rotate ?? 0,
        },
      };
    });
    setHasUnsavedChanges(true);
    setIsSaved(false);

    // Cache lokal instan di browser admin
    if (typeof window !== 'undefined') {
      try {
        const existing = JSON.parse(
          localStorage.getItem('infinite_canvas_admin_positions') || '{}'
        );
        existing[id] = { x: newOffsetX, y: newOffsetY };
        localStorage.setItem(
          'infinite_canvas_admin_positions',
          JSON.stringify(existing)
        );
      } catch {
        // ignore
      }
    }
  };

  // Simpan posisi ke Cloudflare D1 via PUT /api/about
  const handleSavePositions = async () => {
    setIsSaving(true);
    try {
      const iconPositions: Record<string, { x: number; y: number }> = {};
      displayProjects.forEach((p) => {
        const pos = projectPositions[p.id];
        if (pos) {
          iconPositions[`canvas-${p.id}`] = {
            x: Math.round(pos.offsetX),
            y: Math.round(pos.offsetY),
          };
        }
      });

      const res = await fetch('/api/about', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
        },
        credentials: 'include',
        body: JSON.stringify({
          desktopPreferences: {
            iconPositions,
          },
          siteId: site?.id || 'default-site',
        }),
      });

      if (res.ok) {
        setHasUnsavedChanges(false);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
      } else {
        console.error('[InfiniteCanvas] Failed to save positions, status:', res.status);
      }
    } catch (err) {
      console.error('[InfiniteCanvas] Failed to save positions:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset posisi ke formasi seimbang 4 kuadran
  const handleResetPositions = () => {
    const reset: Record<string, { offsetX: number; offsetY: number; rotate: number }> = {};
    displayProjects.forEach((p, index) => {
      reset[p.id] = getProjectPosition(index);
    });
    setProjectPositions(reset);
    setHasUnsavedChanges(true);
    setIsSaved(false);

    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('infinite_canvas_admin_positions');
      } catch {
        // ignore
      }
    }
  };

  // Logout admin
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.reload();
    }
  };

  // Aksi tombol Project di dock: tutup panel kiri dan fokuskan kamera ke ikhtisar seluruh karya
  const handleFocusProjects = () => {
    setActiveLeftPanel(null);
    panTo(0, 0, 0.75);
  };

  const isAdminActive = isAdmin && !isVisitorPreview;

  // Background pattern dinamis sesuai gaya grid yang dipilih (bergerak selaras dengan drag kanvas)
  const getGridBackgroundStyle = (): React.CSSProperties => {
    const pos = `${offset.x}px ${offset.y}px`;

    if (gridStyle === 'grid') {
      return {
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundImage:
          'linear-gradient(to right, var(--canvas-grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--canvas-grid-line) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        backgroundPosition: pos,
      };
    }

    if (gridStyle === 'blank') {
      return {
        cursor: isDragging ? 'grabbing' : 'grab',
        backgroundImage: 'none',
      };
    }

    // Default 'dots'
    return {
      cursor: isDragging ? 'grabbing' : 'grab',
      backgroundImage: 'radial-gradient(var(--canvas-grid-dot) 1.15px, transparent 1.15px)',
      backgroundSize: '24px 24px',
      backgroundPosition: pos,
    };
  };

  return (
    <div
      className="relative h-screen w-full overflow-hidden bg-[#f8f9fa] dark:bg-[#0c0d0e] text-neutral-900 dark:text-neutral-100 select-none [--canvas-grid-dot:#d4d4d8] dark:[--canvas-grid-dot:rgba(255,255,255,0.15)] [--canvas-grid-line:rgba(0,0,0,0.07)] dark:[--canvas-grid-line:rgba(255,255,255,0.08)]"
      style={getGridBackgroundStyle()}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Intro HELLO (v1.3.36): animasi diputar sampai selesai satu putaran
          penuh, baru fade-out menampilkan kanvas. Gaya ('hello-orange' /
          'hello-black') & penyematan ('none' = tanpa intro) diatur lewat CRUD
          Intro Animasi (v1.3.42). */}
      {introStyle !== 'none' && <HelloIntro style={introStyle} />}

      {/* Corner decorative brackets */}
      <CornerBrackets />

      {/* Top Right Floating Language Switcher (ID / EN) — Identik macOS Template */}
      <div
        data-testid="canvas-language-switch"
        className="fixed top-4 sm:top-5 right-12 sm:right-14 z-20 flex items-center gap-1.5 p-1 rounded-full bg-white/95 dark:bg-neutral-900/90 backdrop-blur-md border border-neutral-250 dark:border-white/10 select-none transition-all duration-300"
      >
        <div className="pl-1.5 pr-0.5 text-neutral-500 dark:text-neutral-400">
          <Languages className="w-3.5 h-3.5" />
        </div>
        <LanguageSwitch />
      </div>

      {/* Floating Admin Control Bar (Mode Admin & Visitor Switcher) */}
      {isAdmin && (
        <CanvasAdminBar
          isVisitorPreview={isVisitorPreview}
          onToggleVisitorPreview={() => setIsVisitorPreview((prev) => !prev)}
          onSavePositions={handleSavePositions}
          onResetPositions={handleResetPositions}
          onLogout={handleLogout}
          isSaving={isSaving}
          isSaved={isSaved}
          hasUnsavedChanges={hasUnsavedChanges}
        />
      )}

      {/* Top Camera Zoom & Reset Controls */}
      <CanvasControls
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetCamera}
        zoom={zoom}
        isAdmin={isAdmin}
        className={isAdmin ? 'top-18 sm:top-20' : 'top-6'}
        gridStyle={gridStyle}
        onSetGridStyle={(style) => {
          setGridStyle(style);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('canvas_grid_style', style);
            } catch {
              // ignore
            }
          }
        }}
      />

      {/* Modern macOS Dock (5 Ikon: About Me, WA, Project, Hubungi Saya, Noted) */}
      <CanvasDock
        activeLeftPanel={activeLeftPanel}
        onSelectLeftPanel={(panel) =>
          setActiveLeftPanel((prev) => (prev === panel ? null : panel))
        }
        onProjectClick={handleFocusProjects}
      />

      {/* Canvas Layer — Bergerak saat drag & zoom */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: 'center center',
          willChange: 'transform',
        }}
      >
        {/* 10 Aset Proyek Berpencar 4 Arah (North, South, East, West) */}
        {displayProjects.map((project, index) => {
          const pos = projectPositions[project.id] || getProjectPosition(index);

          return (
            <CanvasProject
              key={project.id}
              project={project}
              hasDragged={hasDragged}
              isAdminMode={isAdminActive}
              zoom={zoom}
              currentOffsetX={pos.offsetX}
              currentOffsetY={pos.offsetY}
              eager={index < 4}
              onPositionChange={handlePositionChange}
              onSelect={(p) => setSelectedProject(p)}
              style={{
                left: `calc(50% + ${pos.offsetX}px)`,
                top: `calc(50% + ${pos.offsetY}px)`,
                transform: `rotate(${pos.rotate}deg)`,
              }}
            />
          );
        })}
      </div>

      {/* On-Demand Left Slide Drawer (About Me, WA, Hubungi Saya, Noted) */}
      <CanvasLeftDrawer
        activePanel={activeLeftPanel}
        onClose={() => setActiveLeftPanel(null)}
        about={about}
        hardSkills={hardSkills}
        experiences={experiences}
        contact={contact}
        testimonials={testimonials}
        site={site}
      />

      {/* Right Slide-Over Project Detail Drawer (Layout Identik Jendela macOS) */}
      <CanvasProjectSlideOver
        project={selectedProject}
        projects={projects || []}
        siteId={site?.id}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
}
