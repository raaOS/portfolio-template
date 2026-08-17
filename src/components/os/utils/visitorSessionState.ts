import type { DesktopIconPosition } from '@/types/about';
import type { WindowState } from '@/components/os/hooks/useWindowManager';
import type { NoteData } from '../ui/elements/StickyNoteItem';

export const VISITOR_DESKTOP_SESSION_KEY = 'portfolio-os-visitor-session-v1';

export interface VisitorWindowSnapshot {
  id: string;
  title?: string;
  isOpen: boolean;
  isMinimized?: boolean;
  isMaximized?: boolean;
  zIndex?: number;
  noPadding?: boolean;
  initialPosition?: { x: number; y: number };
  width?: number;
  height?: number;
  kind?: 'project' | 'system';
  projectId?: string;
}

export interface VisitorNoteSnapshot {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  isCollapsed?: boolean;
  opacity?: number;
}

export interface VisitorDesktopSession {
  version: 1;
  updatedAt: number;
  viewport?: { width: number; height: number };
  windows?: Record<string, VisitorWindowSnapshot>;
  icons?: Record<string, DesktopIconPosition>;
  notes?: Record<string, VisitorNoteSnapshot>;
  notesVisible?: boolean;
  hiddenNoteIds?: string[];
}

function getViewportSnapshot() {
  if (typeof window === 'undefined') return undefined;
  return { width: window.innerWidth, height: window.innerHeight };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeSession(value: unknown): VisitorDesktopSession | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if ('windows' in value && value.windows !== undefined && !isRecord(value.windows)) return null;
  if ('icons' in value && value.icons !== undefined && !isRecord(value.icons)) return null;
  if ('notes' in value && value.notes !== undefined && !isRecord(value.notes)) return null;
  return value as unknown as VisitorDesktopSession;
}

export function loadVisitorDesktopSession(): VisitorDesktopSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = sessionStorage.getItem(VISITOR_DESKTOP_SESSION_KEY);
    if (!raw) return null;
    return sanitizeSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveVisitorDesktopSessionPatch(patch: Partial<VisitorDesktopSession>) {
  if (typeof window === 'undefined') return;

  try {
    const current = loadVisitorDesktopSession();
    const next: VisitorDesktopSession = {
      ...(current ?? {}),
      version: 1,
      updatedAt: Date.now(),
      viewport: getViewportSnapshot(),
      ...patch,
    };

    sessionStorage.setItem(VISITOR_DESKTOP_SESSION_KEY, JSON.stringify(next));
  } catch {}
}

export function clearVisitorDesktopSession() {
  if (typeof window === 'undefined') return;

  try {
    sessionStorage.removeItem(VISITOR_DESKTOP_SESSION_KEY);
  } catch {}
}

function snapshotWindow(windowState: WindowState): VisitorWindowSnapshot | null {
  const isProject = windowState.id.startsWith('project-');

  if (isProject && !windowState.isOpen) {
    return null;
  }

  const projectId = isProject ? windowState.id.replace('project-', '') : undefined;

  return {
    id: windowState.id,
    title: windowState.title,
    isOpen: windowState.isOpen,
    isMinimized: windowState.isMinimized,
    isMaximized: windowState.isMaximized,
    zIndex: windowState.zIndex,
    noPadding: windowState.noPadding,
    initialPosition: windowState.initialPosition,
    width: windowState.width,
    height: windowState.height,
    kind: isProject ? 'project' : 'system',
    projectId,
  };
}

export function saveVisitorWindowSnapshots(windows: WindowState[]) {
  const snapshots: Record<string, VisitorWindowSnapshot> = {};

  windows.forEach((windowState) => {
    const snapshot = snapshotWindow(windowState);
    if (snapshot) {
      snapshots[windowState.id] = snapshot;
    }
  });

  saveVisitorDesktopSessionPatch({ windows: snapshots });
}

export function applyVisitorWindowSnapshot(
  windowState: WindowState,
  snapshot?: VisitorWindowSnapshot
): WindowState {
  if (!snapshot) return windowState;

  return {
    ...windowState,
    title: snapshot.title ?? windowState.title,
    isOpen: snapshot.isOpen,
    isMinimized: snapshot.isMinimized ?? false,
    isMaximized: snapshot.isMaximized ?? false,
    zIndex: snapshot.zIndex ?? windowState.zIndex,
    noPadding: snapshot.noPadding ?? windowState.noPadding,
    initialPosition: snapshot.initialPosition ?? windowState.initialPosition,
    width: snapshot.width ?? windowState.width,
    height: snapshot.height ?? windowState.height,
  };
}

export function saveVisitorIconSnapshot(id: string, position: DesktopIconPosition) {
  const current = loadVisitorDesktopSession();
  saveVisitorDesktopSessionPatch({
    icons: {
      ...(current?.icons ?? {}),
      [id]: position,
    },
  });
}

export function saveVisitorNoteSnapshots(
  notes: NoteData[],
  notesVisible: boolean,
  hiddenNoteIds: ReadonlySet<string>
) {
  const snapshots: Record<string, VisitorNoteSnapshot> = {};

  notes.forEach((note) => {
    snapshots[note.id] = {
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      zIndex: note.zIndex,
      isCollapsed: note.isCollapsed,
      opacity: note.opacity,
    };
  });

  saveVisitorDesktopSessionPatch({
    notes: snapshots,
    notesVisible,
    hiddenNoteIds: Array.from(hiddenNoteIds),
  });
}

export function applyVisitorNoteSnapshots(
  notes: NoteData[],
  snapshots?: Record<string, VisitorNoteSnapshot>
) {
  if (!snapshots) return notes;

  return notes.map((note) => ({
    ...note,
    ...(snapshots[note.id] ?? {}),
  }));
}
