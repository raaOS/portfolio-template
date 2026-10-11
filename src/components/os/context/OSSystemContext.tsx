'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Granular context types
// ---------------------------------------------------------------------------

interface OSOverlaysContextType {
  showSpotlight: boolean;
  setShowSpotlight: (show: boolean) => void;
  toggleSpotlight: () => void;
  notesVisible: boolean;
  setNotesVisible: (visible: boolean) => void;
  toggleNotes: () => void;
  hiddenNoteIds: ReadonlySet<string>;
  hideNote: (id: string) => void;
  unhideAllNotes: () => void;
  restoreHiddenNoteIds: (ids: string[]) => void;
  showControlCenter: boolean;
  setShowControlCenter: (show: boolean) => void;
  showCalendar: boolean;
  setShowCalendar: (show: boolean) => void;
  showMissionControl: boolean;
  setShowMissionControl: (show: boolean) => void;
  toggleMissionControl: () => void;
  showGhostCursors: boolean;
  setShowGhostCursors: (show: boolean) => void;
  toggleGhostCursors: () => void;
}

interface OSMediaContextType {
  brightness: number;
  setBrightness: (val: number) => void;
  volume: number;
  setVolume: (val: number) => void;
}

interface OSBootContextType {
  isRevealed: boolean;
  setIsRevealed: (revealed: boolean) => void;
  startScreenReady: boolean;
  setStartScreenReady: (ready: boolean) => void;
}

// ---------------------------------------------------------------------------
// Internal contexts (not exported directly — use hooks below)
// ---------------------------------------------------------------------------

const OSOverlaysContext = createContext<OSOverlaysContextType | undefined>(undefined);
const OSMediaContext = createContext<OSMediaContextType | undefined>(undefined);
const OSBootContext = createContext<OSBootContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Granular hooks (preferred for new consumers)
// ---------------------------------------------------------------------------

/**
 * Hook for overlay/toggle state only (Spotlight, Mission Control, Calendar,
 * Ghost Cursors, Control Center, Sticky Notes).
 * Use this instead of `useOSSystem()` when you don't need media or boot state.
 */
export const useOSOverlays = (): OSOverlaysContextType => {
  const ctx = useContext(OSOverlaysContext);
  if (!ctx) throw new Error('useOSOverlays must be used within OSSystemProvider');
  return ctx;
};

export const useOSOverlaysOptional = (): OSOverlaysContextType | undefined => {
  return useContext(OSOverlaysContext);
};

/**
 * Hook for media controls only (brightness, volume).
 * Use this for components like ControlCenter that only manipulate media state.
 */
export const useOSMedia = (): OSMediaContextType => {
  const ctx = useContext(OSMediaContext);
  if (!ctx) throw new Error('useOSMedia must be used within OSSystemProvider');
  return ctx;
};

/**
 * Hook for boot/reveal state only.
 * Use this for boot sequence and entrance animation components.
 */
export const useOSBoot = (): OSBootContextType => {
  const ctx = useContext(OSBootContext);
  if (!ctx) throw new Error('useOSBoot must be used within OSSystemProvider');
  return ctx;
};

// ---------------------------------------------------------------------------
// Backward-compatible combined hook
// ---------------------------------------------------------------------------

type OSSystemContextType = OSOverlaysContextType & OSMediaContextType & OSBootContextType;

/**
 * @deprecated Prefer granular hooks (`useOSOverlays`, `useOSMedia`, `useOSBoot`)
 * for better render isolation. This hook subscribes to ALL state changes.
 */
export const useOSSystem = (): OSSystemContextType => {
  const overlays = useContext(OSOverlaysContext);
  const media = useContext(OSMediaContext);
  const boot = useContext(OSBootContext);
  if (!overlays || !media || !boot) {
    throw new Error('useOSSystem must be used within OSSystemProvider');
  }
  return { ...overlays, ...media, ...boot };
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface OSSystemProviderProps {
  children: ReactNode;
}

export const OSSystemProvider: React.FC<OSSystemProviderProps> = ({ children }) => {
  // --- Overlays state ---
  const [showSpotlight, setShowSpotlight] = useState(false);
  const [notesVisible, setNotesVisible] = useState(true);
  const [hiddenNoteIds, setHiddenNoteIds] = useState<Set<string>>(() => new Set());
  const [showControlCenter, setShowControlCenter] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMissionControl, setShowMissionControl] = useState(false);
  const [showGhostCursors, setShowGhostCursors] = useState(false);

  // --- Media state ---
  const [brightness, setBrightness] = useState(100);
  const [volume, setVolume] = useState(50);

  // --- Boot state ---
  const [isRevealed, setIsRevealed] = useState(false);
  const [startScreenReady, setStartScreenReady] = useState(false);

  // Mobile: disable sticky notes on small viewports
  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setTimeout(() => {
        setNotesVisible(false);
      }, 0);
    }
  }, []);

  // --- Callbacks (stable references) ---
  const toggleSpotlight = useCallback(() => setShowSpotlight((prev) => !prev), []);
  const toggleNotes = useCallback(() => setNotesVisible((prev) => !prev), []);
  const toggleMissionControl = useCallback(() => setShowMissionControl((prev) => !prev), []);
  const toggleGhostCursors = useCallback(() => setShowGhostCursors((prev) => !prev), []);

  const hideNote = useCallback((id: string) => {
    setHiddenNoteIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unhideAllNotes = useCallback(() => {
    setHiddenNoteIds((prev) => (prev.size === 0 ? prev : new Set()));
  }, []);

  const restoreHiddenNoteIds = useCallback((ids: string[]) => {
    setHiddenNoteIds(new Set(ids));
  }, []);

  // --- Memoized context values (each only changes when its own state changes) ---
  const overlaysValue = React.useMemo(
    () => ({
      showSpotlight,
      setShowSpotlight,
      toggleSpotlight,
      notesVisible,
      setNotesVisible,
      toggleNotes,
      hiddenNoteIds,
      hideNote,
      unhideAllNotes,
      restoreHiddenNoteIds,
      showControlCenter,
      setShowControlCenter,
      showCalendar,
      setShowCalendar,
      showMissionControl,
      setShowMissionControl,
      toggleMissionControl,
      showGhostCursors,
      setShowGhostCursors,
      toggleGhostCursors,
    }),
    [
      showSpotlight,
      toggleSpotlight,
      notesVisible,
      toggleNotes,
      hiddenNoteIds,
      hideNote,
      unhideAllNotes,
      restoreHiddenNoteIds,
      showControlCenter,
      showCalendar,
      showMissionControl,
      toggleMissionControl,
      showGhostCursors,
      toggleGhostCursors,
    ]
  );

  const mediaValue = React.useMemo(
    () => ({ brightness, setBrightness, volume, setVolume }),
    [brightness, volume]
  );

  const bootValue = React.useMemo(
    () => ({ isRevealed, setIsRevealed, startScreenReady, setStartScreenReady }),
    [isRevealed, startScreenReady]
  );

  return (
    <OSOverlaysContext.Provider value={overlaysValue}>
      <OSMediaContext.Provider value={mediaValue}>
        <OSBootContext.Provider value={bootValue}>{children}</OSBootContext.Provider>
      </OSMediaContext.Provider>
    </OSOverlaysContext.Provider>
  );
};
