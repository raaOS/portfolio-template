// ═══════════════════════════════════════════════════════════════════
// SECTION MAP
// Imports, dynamic imports, and entrance timing constants
// DesktopEnvironment: data preparation, boot skeleton, and providers
// DesktopMainWithLogout: logout wrapper
// DesktopMain: window management, visitor session, layout persistence,
// keyboard shortcuts, wallpaper transitions, and layer rendering
// Mission Control layout math lives in ../utils/missionControlLayout.
// ═══════════════════════════════════════════════════════════════════
'use client';

import React, { startTransition, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, m, LazyMotion, domMax } from 'motion/react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useClientSiteAuth } from '@/hooks/useClientSiteAuth';
import { useLayoutPersistence } from '../contexts/LayoutPersistenceContext';
import { useDesktopWindowContext } from '../context/DesktopWindowContext';
import { useStickyNotes } from '../hooks/useStickyNotes';
import { useDesktopLock } from '../hooks/useDesktopLock';
import { useBootSequence } from '../hooks/useBootSequence';
import { useDesktopShortcuts } from '../hooks/useDesktopShortcuts';
import { useChatContacts } from '../hooks/useChatContacts';
import { useDesktopLayout } from '../hooks/useDesktopLayout';
import { useDesktopIcons } from '../hooks/useDesktopIcons';
import { useDesktopNavigation } from '../hooks/useDesktopNavigation';
import { useOSOverlays, useOSBoot } from '../context/OSSystemContext';
import type { AboutData } from '@/types/about';
import type { ExperienceData } from '@/types/experience';
import type { HardSkillsData } from '@/types/hardSkill';
import type { Project } from '@/types/projects';
import type { TestimonialData } from '@/types/testimonial';
import type { ContactData } from '@/types/contact';
import type { WindowState } from '@/components/os/hooks/useWindowManager';
import { createInitialWindows } from '../utils/windowFactory';
import { clearVisitorPositions } from '../utils/positionSync';
import {
  applyVisitorNoteSnapshots,
  applyVisitorWindowSnapshot,
  loadVisitorDesktopSession,
  saveVisitorNoteSnapshots,
  saveVisitorWindowSnapshots,
} from '../utils/visitorSessionState';
import { Z_LAYERS } from '../utils/zIndexLayers';
import type { ContactProfile } from '../data/mockChats';
import DesktopProviders from './DesktopProviders';
import DesktopSkeleton from '../ui/DesktopSkeleton';
import { useBackgroundEffect } from '@/components/home/BackgroundEffectContext';
import { computeMissionTargets, type MissionTarget } from '../utils/missionControlLayout';

const DesktopIconsLayer = dynamic(() => import('../layers/DesktopIconsLayer'), { ssr: false });
const UnifiedLayer = dynamic(() => import('../layers/UnifiedLayer'), { ssr: false });
const UIOverlaysLayer = dynamic(() => import('../layers/UIOverlaysLayer'), { ssr: false });
const ChatWindow = dynamic(() => import('../windows/ChatWindow'), {
  loading: () => <div className="h-full w-full animate-pulse rounded bg-gray-100" />,
  ssr: false,
});
const ProjectDetailWrapper = dynamic(() => import('../ui/ProjectDetailWrapper'), {
  loading: () => (
    <div className="h-full w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
  ),
  ssr: false,
});
const StartScreen = dynamic(() => import('../ui/StartScreen'), {
  ssr: false,
  loading: () => (
    <div
      className="fixed inset-0 h-full w-full bg-black print:hidden"
      style={{ zIndex: Z_LAYERS.BOOT }}
    />
  ),
});

const DESKTOP_ENTRANCE_AFTER_REVEAL_MS = 520;
const DESKTOP_ENTRANCE_AFTER_SKIPPED_BOOT_MS = 160;
const WINDOWS_ENTRANCE_AFTER_ICONS_MS = 120;
const NOTES_ENTRANCE_AFTER_WINDOWS_MS = 220;

export interface DesktopEnvironmentProps {
  children?: React.ReactNode;
  /**
   * Loader homepage aktif (dikirim server-side dari page.tsx): boot native
   * os-desktop (StartScreen HELLO) dipaksa skip supaya tidak dobel dengan
   * overlay DeckReveal/HelloIntro. Default false → perilaku native apa adanya.
   */
  suppressIntro?: boolean;
  siteId?: string;
  aboutData?: AboutData | null;
  experienceData?: ExperienceData | null;
  hardSkillsData?: HardSkillsData | null;
  projects: Project[];
  testimonialsData?: TestimonialData | null;
  contactData?: ContactData | null;
}

interface DesktopMainBaseProps {
  siteId: string;
  aboutData?: AboutData | null;
  experienceData?: ExperienceData | null;
  hardSkillsData?: HardSkillsData | null;
  contactData?: ContactData | null;
  isMobile: boolean;
  isAdmin: boolean;
  csrfToken: string | null;
  commercialProjects: Project[];
  projects: Project[];
  dynamicContacts: Record<string, ContactProfile>;
  testimonialContacts: ContactProfile[];
  isAuthLoading: boolean;
  isWhatsAppEnabled: boolean;
}

interface DesktopMainWithLogoutProps extends DesktopMainBaseProps {
  originalLogout: () => Promise<void>;
  bootSequence: ReturnType<typeof useBootSequence>;
}

interface DesktopMainProps extends DesktopMainBaseProps {
  logout: () => void | Promise<void>;
  bootSequence: ReturnType<typeof useBootSequence>;
}

export default function DesktopEnvironment({
  siteId = 'default-site',
  aboutData,
  experienceData,
  hardSkillsData,
  projects,
  testimonialsData,
  contactData,
  suppressIntro = false,
}: DesktopEnvironmentProps) {
  const { mounted, isMobile } = useDesktopLock();
  const bootSequence = useBootSequence({ forceSkip: suppressIntro });
  const { needsPowerOn, isBooting } = bootSequence;
  const { isAdmin, csrfToken, logout: originalLogout, isLoading: isAuthLoading } = useClientSiteAuth(siteId);
  const isWhatsAppEnabled = aboutData?.dockConfig?.whatsapp?.isHidden !== true;
  const { dynamicContacts, testimonialContacts } = useChatContacts(testimonialsData);

  const commercialProjects = useMemo(() => {
    const visibleIds = aboutData?.desktopPreferences?.visibleProjectIds;
    if (visibleIds && visibleIds.length > 0) {
      const filtered = projects.filter((p) => visibleIds.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    return projects;
  }, [projects, aboutData]);

  const initialWindows = useMemo(
    () =>
      createInitialWindows({
        aboutData,
        experienceData,
        hardSkillsData,
        contactData,
        siteId,
        projects,
        dynamicContacts,
        isAdmin,
        isMobile,
      }),
    [
      aboutData,
      experienceData,
      hardSkillsData,
      contactData,
      siteId,
      projects,
      dynamicContacts,
      isAdmin,
      isMobile,
    ]
  );

  if (!mounted) {
    return <DesktopSkeleton isBooting={needsPowerOn || isBooting} />;
  }

  return (
    <DesktopProviders
      initialWindows={initialWindows}
      aboutData={aboutData}
      siteId={siteId}
      csrfToken={csrfToken || undefined}
      isAdmin={isAdmin}
    >
      <DesktopMainWithLogout
        siteId={siteId}
        aboutData={aboutData}
        experienceData={experienceData}
        hardSkillsData={hardSkillsData}
        contactData={contactData}
        isMobile={isMobile}
        commercialProjects={commercialProjects}
        projects={projects}
        isAdmin={isAdmin}
        csrfToken={csrfToken ?? null}
        originalLogout={originalLogout}
        dynamicContacts={dynamicContacts}
        testimonialContacts={testimonialContacts}
        isAuthLoading={isAuthLoading}
        isWhatsAppEnabled={isWhatsAppEnabled}
        bootSequence={bootSequence}
      />
    </DesktopProviders>
  );
}

function DesktopMainWithLogout({ originalLogout, ...props }: DesktopMainWithLogoutProps) {
  const { flushAll } = useLayoutPersistence();
  const handleLogout = async () => {
    const flushTimeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 700);
    });

    try {
      await Promise.race([flushAll(), flushTimeout]);
    } catch (error) {
      console.warn('[DesktopEnvironment] Layout flush skipped before admin exit:', error);
    } finally {
      clearVisitorPositions();
      await originalLogout();
    }
  };
  return <DesktopMain {...props} logout={handleLogout} />;
}

function DesktopMain({
  siteId,
  aboutData,
  experienceData: _experienceData,
  hardSkillsData: _hardSkillsData,
  contactData: _contactData,
  isMobile,
  isAdmin,
  logout,
  csrfToken,
  commercialProjects,
  projects,
  dynamicContacts,
  testimonialContacts,
  isAuthLoading,
  isWhatsAppEnabled,
  bootSequence,
}: DesktopMainProps) {
  const { needsPowerOn, isBooting, finishBooting } = bootSequence;
  const { startScreenReady, setStartScreenReady, isRevealed, setIsRevealed } = useOSBoot();
  const {
    notesVisible,
    setNotesVisible,
    hiddenNoteIds,
    restoreHiddenNoteIds,
    showMissionControl,
    setShowMissionControl,
  } = useOSOverlays();
  const wasBootSkipped = !needsPowerOn && !isBooting;
  const [desktopEntranceReady, setDesktopEntranceReady] = React.useState(false);
  const [windowsEntranceReady, setWindowsEntranceReady] = React.useState(false);
  const [notesEntranceReady, setNotesEntranceReady] = React.useState(false);

  const [, setActiveIconIds] = React.useState<Set<string>>(new Set());

  // Listen to viewport resizing for responsive Mission Control positioning.
  // Throttled via rAF to avoid layout thrashing during rapid resize events.
  const [viewport, setViewport] = React.useState({ width: 1440, height: 900 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId: number | undefined;

    const handleResize = () => {
      if (rafId) return; // Already scheduled
      rafId = requestAnimationFrame(() => {
        rafId = undefined;
        setViewport({ width: window.innerWidth, height: window.innerHeight });
      });
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial compute
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  useDesktopShortcuts();

  const handleGoHome = useCallback(() => {
    window.location.href = '/';
  }, []);

  const {
    openWindow,
    resetWindows,
    requestNextZIndex,
    windows,
    closeWindow,
    minimizeWindow,
    maximizeWindow,
    focusWindow,
    setWindows,
    updateWindowPosition,
    handleWindowResize,
    handleWindowResizeEnd,
    togglePin,
  } = useDesktopWindowContext();

  const missionTargets = React.useMemo(() => {
    if (!showMissionControl) return new Map<string, MissionTarget>();
    return computeMissionTargets(windows, viewport.width, viewport.height);
  }, [showMissionControl, windows, viewport]);

  const {
    notes,
    addNote,
    updateNote,
    deleteNote,
    permanentDeleteNote,
    restoreNote,
    bringToFrontNote,
    setNotes,
    hasLoaded: notesLoaded,
  } = useStickyNotes(
    true,
    isAdmin,
    csrfToken ?? undefined,
    requestNextZIndex,
    isAuthLoading,
    siteId
  );
  const {
    openProjectWindow: baseOpenProjectWindow,
    navToChat,
    openWhatsAppList,
    toggleNotesVisibility,
    showNotes,
  } = useDesktopNavigation({
    openWindow,
    resetWindows,
    dynamicContacts,
    ChatWindow,
    _notes: notes,
    projects,
    siteId,
    _restoreNote: restoreNote,
    _addNote: addNote,
    _isAdmin: isAdmin,
    setNotesDockBouncing: () => {},
    isWhatsAppEnabled,
  });

  // Wrap openProjectWindow to also track which icons are morphing
  const openProjectWindow = useCallback(
    (project: Project, originRect?: { x: number; y: number; width: number; height: number }) => {
      setActiveIconIds((prev) => new Set([...prev, project.id]));
      baseOpenProjectWindow(project, originRect);
    },
    [baseOpenProjectWindow]
  );
  const { iconPositions, handleIconPositionChange, handleIconZIndexChange, handleIconSizeChange } =
    useDesktopLayout({
      aboutData,
      isAdmin,
      csrfToken,
      siteId,
    });
  const { projectIcons } = useDesktopIcons({
    mounted: true,
    commercialProjects,
    aboutData,
    handleGoHome,
    onOpenExplorer: () => openWindow('explorer'),
    iconPositions,
  });
  const restoredVisitorWindowsRef = React.useRef(false);
  const restoredVisitorNotesRef = React.useRef(false);
  const [visitorWindowsReady, setVisitorWindowsReady] = React.useState(isAdmin);
  const [visitorNotesReady, setVisitorNotesReady] = React.useState(isAdmin);
  const markVisitorWindowsReady = React.useCallback(() => {
    window.setTimeout(() => setVisitorWindowsReady(true), 0);
  }, []);
  const markVisitorNotesReady = React.useCallback(() => {
    window.setTimeout(() => setVisitorNotesReady(true), 0);
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAdmin) {
      markVisitorWindowsReady();
      return;
    }

    if (restoredVisitorWindowsRef.current) return;
    const session = loadVisitorDesktopSession();
    const snapshots = session?.windows ?? {};
    const projectById = new Map(projects.map((project) => [project.id, project]));

    setWindows((prev) => {
      let changed = false;
      const existingIds = new Set(prev.map((windowState) => windowState.id));
      const restoredExisting = prev.map((windowState) => {
        const snapshot = snapshots[windowState.id];
        if (!snapshot) return windowState;
        changed = true;
        return applyVisitorWindowSnapshot(windowState, snapshot);
      });

      const restoredProjects = Object.values(snapshots)
        .filter((snapshot) => snapshot.kind === 'project' && snapshot.isOpen && snapshot.projectId)
        .filter((snapshot) => !existingIds.has(snapshot.id))
        .map((snapshot) => {
          const project = projectById.get(snapshot.projectId!);
          if (!project) return null;

          changed = true;
          return applyVisitorWindowSnapshot(
            {
              id: snapshot.id,
              title: snapshot.title ?? `Portfolio: ${project.title}`,
              isOpen: true,
              isMinimized: snapshot.isMinimized ?? false,
              isMaximized: snapshot.isMaximized ?? false,
              zIndex: snapshot.zIndex ?? 30,
              noPadding: true,
              initialPosition: snapshot.initialPosition,
              width: snapshot.width ?? 900,
              height: snapshot.height ?? 620,
              content: null,
              contentFactory: () => (
                <ProjectDetailWrapper project={project} projects={projects} siteId={siteId} />
              ),
            },
            snapshot
          );
        })
        .filter((windowState): windowState is WindowState => windowState !== null);

      return changed ? [...restoredExisting, ...restoredProjects] : prev;
    });

    restoredVisitorWindowsRef.current = true;
    markVisitorWindowsReady();
  }, [
    isAdmin,
    isAuthLoading,
    markVisitorNotesReady,
    markVisitorWindowsReady,
    projects,
    setWindows,
    siteId,
  ]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAdmin) {
      markVisitorNotesReady();
      return;
    }
    if (restoredVisitorNotesRef.current || !notesLoaded) return;

    const session = loadVisitorDesktopSession();
    if (session) {
      setNotes((prev) => applyVisitorNoteSnapshots(prev, session.notes));
      if (typeof session.notesVisible === 'boolean') {
        setNotesVisible(session.notesVisible);
      }
      restoreHiddenNoteIds(session.hiddenNoteIds ?? []);
    }

    restoredVisitorNotesRef.current = true;
    markVisitorNotesReady();
  }, [
    isAdmin,
    isAuthLoading,
    markVisitorNotesReady,
    notesLoaded,
    restoreHiddenNoteIds,
    setNotes,
    setNotesVisible,
  ]);

  useEffect(() => {
    if (isAdmin || isAuthLoading || !visitorWindowsReady) return;

    const timer = window.setTimeout(() => {
      saveVisitorWindowSnapshots(windows);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isAdmin, isAuthLoading, visitorWindowsReady, windows]);

  useEffect(() => {
    if (isAdmin || isAuthLoading || !visitorNotesReady || !notesLoaded) return;

    const timer = window.setTimeout(() => {
      saveVisitorNoteSnapshots(notes, notesVisible, hiddenNoteIds);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [hiddenNoteIds, isAdmin, isAuthLoading, notes, notesLoaded, notesVisible, visitorNotesReady]);

  const handleBootComplete = useCallback(() => {
    startTransition(() => setIsRevealed(true));
    finishBooting();
  }, [finishBooting, setIsRevealed]);

  const releaseBootCover = useCallback(() => {
    document.documentElement.removeAttribute('data-os-needs-boot');
  }, []);

  // Synchronize OS states for skipped boot to ensure immediate visibility on refresh
  useEffect(() => {
    if (wasBootSkipped && (!isRevealed || !startScreenReady)) {
      startTransition(() => {
        setIsRevealed(true);
        setStartScreenReady(true);
      });
    }
  }, [wasBootSkipped, isRevealed, startScreenReady, setIsRevealed, setStartScreenReady]);

  const searchParams = useSearchParams();

  // URL PARAM FIX: Ref-based guard agar kombinasi `app` param hanya
  // di-handle sekali. Sebelumnya effect bisa re-fire saat context
  // mengupdate `openWindow` reference sementara `replaceState` belum
  // propagate → `openWindow(app)` terpanggil dua kali.
  const handledAppParamRef = React.useRef<string | null>(null);

  useEffect(() => {
    const rawApp = searchParams.get('app');
    if (!rawApp) {
      handledAppParamRef.current = null;
      return;
    }
    if (handledAppParamRef.current === rawApp) return;
    handledAppParamRef.current = rawApp;

    const app = rawApp === 'mail' ? 'contact' : rawApp;
    if (app === 'whatsapp') {
      if (isWhatsAppEnabled) {
        openWhatsAppList();
      }
    } else if (app === 'notes') {
      showNotes();
    } else if (app === 'mission-control') {
      setShowMissionControl(true);
    } else {
      openWindow(app);
    }

    // Cleanup URL setelah handled
    if (typeof window !== 'undefined') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('app');
      window.history.replaceState({}, '', nextUrl.pathname + nextUrl.search + window.location.hash);
    }
  }, [
    searchParams,
    openWindow,
    openWhatsAppList,
    showNotes,
    setShowMissionControl,
    isWhatsAppEnabled,
  ]);

  const isDesktopReady = wasBootSkipped || startScreenReady;
  const isDesktopRevealed = wasBootSkipped || isRevealed;

  useEffect(() => {
    if (!isDesktopRevealed || desktopEntranceReady) {
      return;
    }

    const delay = wasBootSkipped
      ? DESKTOP_ENTRANCE_AFTER_SKIPPED_BOOT_MS
      : DESKTOP_ENTRANCE_AFTER_REVEAL_MS;
    const timer = window.setTimeout(() => {
      setDesktopEntranceReady(true);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [desktopEntranceReady, isDesktopRevealed, wasBootSkipped]);

  useEffect(() => {
    if (!desktopEntranceReady) return;

    const windowsTimer = window.setTimeout(() => {
      setWindowsEntranceReady(true);
    }, WINDOWS_ENTRANCE_AFTER_ICONS_MS);
    const notesTimer = window.setTimeout(() => {
      setNotesEntranceReady(true);
    }, WINDOWS_ENTRANCE_AFTER_ICONS_MS + NOTES_ENTRANCE_AFTER_WINDOWS_MS);

    return () => {
      window.clearTimeout(windowsTimer);
      window.clearTimeout(notesTimer);
    };
  }, [desktopEntranceReady]);

  // Bridge ke `BackgroundEffectContext` (provider hidup di HomeOSWrapper).
  // DesktopBackground sekarang di-render di level wrapper supaya `<video>`
  // tidak ke-remount; tapi efek blur+scale saat project window terbuka
  // tetap perlu trigger dari sini karena state `windows` lokal ke
  // DesktopMain.
  const { setIsWindowOpen, setIsDesktopRevealed } = useBackgroundEffect();
  const isProjectWindowOpen = useMemo(
    () => windows.some((w) => w.id.startsWith('project-') && w.isOpen && !w.isMinimized),
    [windows]
  );
  useEffect(() => {
    setIsWindowOpen(isProjectWindowOpen);
  }, [isProjectWindowOpen, setIsWindowOpen]);
  useEffect(() => {
    setIsDesktopRevealed(isDesktopRevealed);
  }, [isDesktopRevealed, setIsDesktopRevealed]);
  useEffect(() => {
    // Pastikan saat DesktopMain unmount (mis. logout / route change),
    // background effect kembali ke neutral. Kalau dibiarkan true,
    // wallpaper sisa-blur saat user balik ke desktop.
    return () => {
      setIsWindowOpen(false);
      setIsDesktopRevealed(false);
    };
  }, [setIsWindowOpen, setIsDesktopRevealed]);

  // Pre-mount desktop layers as soon as StartScreen is mounted. Tujuannya:
  // chunk JS untuk DesktopIconsLayer / UnifiedLayer / UIOverlaysLayer sudah
  // selesai di-import dan sticky-notes sudah ter-fetch saat user pertama kali
  // melihat desktop. Tanpa pre-mount, semua chunk + API request baru kicked-off
  // saat reveal, dan user melihat wallpaper kosong selama beberapa ratus ms.
  //
  // Layers yang di-mount tetap invisible secara visual sampai `isRevealed`
  // true (lihat opacity wrapper di JSX bawah), dan StartScreen di
  // `Z_LAYERS.BOOT` menutupi semuanya — jadi tidak ada flash.
  const isDesktopMounted = wasBootSkipped || startScreenReady;

  // Preload NonOSChrome dynamically so navigation to /projects is instant and dock doesn't slide
  useEffect(() => {
    if (isDesktopRevealed) {
      let idleId: number | undefined;
      let timerId: ReturnType<typeof setTimeout> | undefined;
      const preload = () => {
        import('@/components/layout/NonOSChrome').catch(() => {});
      };
      if (typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
          idleId = window.requestIdleCallback(preload);
        } else {
          timerId = setTimeout(preload, 1000);
        }
      }
      return () => {
        if (idleId !== undefined && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleId);
        }
        if (timerId !== undefined) clearTimeout(timerId);
      };
    }
  }, [isDesktopRevealed]);

  return (
    <LazyMotion features={domMax}>
      <>
        {(needsPowerOn || isBooting) && (
          <AnimatePresence>
            <StartScreen
              key="start-screen"
              onStart={handleBootComplete}
              isActive={needsPowerOn || isBooting}
              onReady={() => {
                // `body::before` only protects the SSR gap before
                // StartScreen mounts. Keeping it during the Lottie boot
                // would hide the desktop after the reveal starts.
                releaseBootCover();
                setStartScreenReady(true);
              }}
              onReveal={() => {
                // Reveal desktop layers while the Lottie boot fades out so
                // user langsung lihat
                // wallpaper, icons, dock, menubar — bukan layar kosong.
                startTransition(() => setIsRevealed(true));
              }}
            />
          </AnimatePresence>
        )}
        <m.div
          className="desktop-main-container relative h-full w-full select-none overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: isDesktopReady ? 1 : 0 }}
          transition={{
            duration: wasBootSkipped ? 0.4 : 0.2,
            ease: wasBootSkipped ? [0.32, 0.72, 0, 1] : 'easeOut',
          }}
        >
          {/*
           * DesktopBackground TIDAK lagi di-render di sini. Wallpaper
           * hidup di `HomeOSWrapper` supaya `<video>` element stable
           * lintas transisi skeleton -> DesktopOS dan mounted flip,
           * sehingga browser cuma fetch sekali (lihat header
           * BackgroundEffectContext untuk konteks). Efek blur+scale
           * saat project window terbuka di-bridge lewat
           * `BackgroundEffectContext` — effect di bawah memantau
           * `windows` dan push state ke context.
           *
           * Layer di bawah pre-mount segera setelah StartScreen siap
           * (`isDesktopMounted`) supaya chunk JS DesktopIconsLayer /
           * UnifiedLayer / UIOverlaysLayer dan sticky-notes API
           * sudah siap saat user pertama kali melihat desktop. Tanpa
           * pre-mount, semua chunk + API request baru kicked-off
           * saat reveal -> wallpaper kosong selama beberapa ratus ms
           * di belakang lubang. Visibility di-gate via opacity —
           * StartScreen di z=BOOT menutupi semuanya sampai reveal dimulai.
           * `pointer-events-none` saat belum revealed wajib
           * supaya icon/dock di belakang StartScreen tidak menerima
           * klik yang seharusnya men-trigger boot.
           */}
          {isDesktopMounted && (
            <div
              className="absolute inset-0"
              data-desktop-entrance-ready={desktopEntranceReady ? 'true' : 'false'}
              style={{
                opacity: isDesktopRevealed ? 1 : 0,
                pointerEvents: isDesktopRevealed ? 'auto' : 'none',
                // Tidak transition opacity — layer harus instan visible
                // bersamaan dengan boot reveal. Animasi entrance
                // (icons stagger, notes fade) tetap di-handle di masing-masing
                // layer, tapi dipicu sedikit setelah reveal mulai supaya
                // tidak selesai saat masih tertutup StartScreen.
              }}
              aria-hidden={!isDesktopRevealed}
            >
              <React.Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                  </div>
                }
              >
                <DesktopIconsLayer
                  projectIcons={projectIcons}
                  isMobile={isMobile}
                  isAdmin={isAdmin}
                  isReady={desktopEntranceReady}
                  handleIconPositionChange={handleIconPositionChange}
                  handleIconZIndexChange={handleIconZIndexChange}
                  handleIconSizeChange={handleIconSizeChange}
                  openProjectWindow={openProjectWindow}
                  isDimmed={showMissionControl}
                />
              </React.Suspense>
              <React.Suspense
                fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                  </div>
                }
              >
                <UnifiedLayer
                  windows={windows}
                  notes={notes}
                  isAdmin={isAdmin}
                  isRevealed={desktopEntranceReady}
                  windowsReady={windowsEntranceReady && visitorWindowsReady}
                  notesReady={notesEntranceReady && visitorNotesReady}
                  closeWindow={closeWindow}
                  minimizeWindow={minimizeWindow}
                  maximizeWindow={maximizeWindow}
                  focusWindow={focusWindow}
                  updateWindowPosition={updateWindowPosition}
                  handleWindowResize={handleWindowResize}
                  handleWindowResizeEnd={handleWindowResizeEnd}
                  togglePin={togglePin}
                  updateNote={updateNote}
                  bringToFrontNote={bringToFrontNote}
                  deleteNote={deleteNote}
                  permanentDeleteNote={permanentDeleteNote}
                  restoreNote={restoreNote}
                  addNote={addNote}
                  onWindowClosed={(id) => {
                    if (id.startsWith('project-')) {
                      const projectId = id.replace('project-', '');
                      setActiveIconIds((prev) => {
                        const next = new Set(prev);
                        next.delete(projectId);
                        return next;
                      });
                    }
                  }}
                  showMissionControl={showMissionControl}
                  missionTargets={missionTargets}
                  onMissionControlDismiss={() => setShowMissionControl(false)}
                />
              </React.Suspense>
              <UIOverlaysLayer
                siteId={siteId}
                navToChat={navToChat}
                openWhatsAppList={openWhatsAppList}
                testimonialContacts={testimonialContacts}
                aboutData={aboutData}
                isWhatsAppEnabled={isWhatsAppEnabled}
                isAdmin={isAdmin}
                logout={logout}
                toggleNotesVisibility={toggleNotesVisibility}
                isMobile={isMobile}
                commercialProjects={commercialProjects}
                openProjectWindow={openProjectWindow}
                needsPowerOn={needsPowerOn}
                isBooting={isBooting}
                showMissionControl={showMissionControl}
                onMissionControlDismiss={() => setShowMissionControl(false)}
              />
            </div>
          )}
        </m.div>
      </>
    </LazyMotion>
  );
}
