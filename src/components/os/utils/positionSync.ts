// Sistem positions yang simple dan reliable
// localStorage = primary source for ADMIN ONLY, CLOUDFLARE_D1 = template for visitors

import type { DesktopIconSize, WindowPreference } from '@/types/about';
import { clearVisitorDesktopSession } from './visitorSessionState';
import { getViewport } from './viewport';

const STORAGE_KEY = 'portfolio-os-positions-v1';

type WindowPosition = { x: number; y: number; width: number; height: number; zIndex?: number };
type IconPosition = { x: number; y: number };
type PersistedIconData = IconPosition & {
  zIndex?: number;
  size?: DesktopIconSize;
  xPct?: number;
  yPct?: number;
  refScreenWidth?: number;
  refScreenHeight?: number;
};
type NotePosition = { x: number; y: number; width: number; height: number; zIndex?: number };

interface PositionData {
  windows: Record<string, WindowPosition>;
  icons: Record<string, PersistedIconData>;
  notes: Record<string, NotePosition>;
}

type PersistedIconPosition = Partial<PersistedIconData> | null | undefined;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** SSR-safe viewport dimensions helper */
// getViewport dipindah ke ./viewport — dipakai bersama window manager & notes.


// Load dari localStorage (ADMIN only)
export function loadPositions(): Partial<PositionData> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return {};
}

// Load session positions (VISITOR).
// Visitor session state now lives in visitorSessionState.ts. This legacy
// loader is kept for API compatibility with older callers.
export function loadSessionPositions(): Partial<PositionData> {
  // Short-circuit: no writes happen, so there is nothing meaningful to load.
  // Kept as a function (not inlined) so callers can keep the old import path.
  return {};
}

// Save ke localStorage
export function savePositions(data: Partial<PositionData>) {
  if (typeof window === 'undefined') return;

  try {
    const current = loadPositions();
    const merged = {
      windows: { ...current.windows, ...data.windows },
      icons: { ...current.icons, ...data.icons },
      notes: { ...current.notes, ...data.notes },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
}

// Clear visitor positions (called when admin saves new template).
// No-op after "refresh = reset" migration — kept for API compatibility.
export function clearVisitorPositions() {
  if (typeof window === 'undefined') return;
  try {
    // Legacy key — remove if it still exists from older versions
    clearVisitorDesktopSession();
    sessionStorage.removeItem('portfolio-os-session-positions');
  } catch {}
}

// Get position window
export function getWindowPosition(
  id: string,
  CLOUDFLARE_D1Data: WindowPreference | null | undefined,
  defaults: { x: number; y: number; width: number; height: number },
  isAdmin: boolean = false
): { x: number; y: number; width: number; height: number } {
  // 1. Cek localStorage hanya jika admin (sebagai buffer sesi)
  if (isAdmin) {
    const local = loadPositions().windows?.[id];
    if (local) return local;
  }

  const vp = getViewport();

  // 2. Cek percentage-based position (NEW - responsive)
  if (isFiniteNumber(CLOUDFLARE_D1Data?.xPct) && isFiniteNumber(CLOUDFLARE_D1Data?.yPct)) {
    const x = (CLOUDFLARE_D1Data.xPct! / 100) * vp.width;
    const y = (CLOUDFLARE_D1Data.yPct! / 100) * vp.height;
    const width = isFiniteNumber(CLOUDFLARE_D1Data?.widthPct)
      ? (CLOUDFLARE_D1Data.widthPct! / 100) * vp.width
      : isFiniteNumber(CLOUDFLARE_D1Data?.width)
        ? CLOUDFLARE_D1Data.width!
        : defaults.width;
    const height = isFiniteNumber(CLOUDFLARE_D1Data?.heightPct)
      ? (CLOUDFLARE_D1Data.heightPct! / 100) * vp.height
      : isFiniteNumber(CLOUDFLARE_D1Data?.height)
        ? CLOUDFLARE_D1Data.height!
        : defaults.height;

    // Clamp to viewport with margin
    const margin = 20;
    return {
      x: Math.max(margin, Math.min(x, vp.width - Math.max(width, 300) - margin)),
      y: Math.max(margin, Math.min(y, vp.height - Math.max(height, 200) - margin)),
      width: Math.max(300, Math.min(width, vp.width * 0.95)),
      height: Math.max(200, Math.min(height, vp.height * 0.95)),
    };
  }

  // 3. Cek legacy pixel-based position (FALLBACK)
  if (isFiniteNumber(CLOUDFLARE_D1Data?.x) && isFiniteNumber(CLOUDFLARE_D1Data?.y)) {
    const width = isFiniteNumber(CLOUDFLARE_D1Data?.width)
      ? CLOUDFLARE_D1Data!.width!
      : defaults.width;
    const height = isFiniteNumber(CLOUDFLARE_D1Data?.height)
      ? CLOUDFLARE_D1Data!.height!
      : defaults.height;

    // Clamp legacy values to current viewport
    const margin = 20;
    return {
      x: Math.max(
        margin,
        Math.min(CLOUDFLARE_D1Data!.x!, vp.width - Math.max(width, 300) - margin)
      ),
      y: Math.max(
        margin,
        Math.min(CLOUDFLARE_D1Data!.y!, vp.height - Math.max(height, 200) - margin)
      ),
      width: Math.max(300, Math.min(width, vp.width * 0.95)),
      height: Math.max(200, Math.min(height, vp.height * 0.95)),
    };
  }

  // 4. Default
  return defaults;
}

// Get position icon
// Prioritas: localStorage (admin) → percentage-based (responsive, cross-device) →
// legacy pixel (clamped ke viewport aktif) → default grid slot.
export function getIconPosition(
  id: string,
  CLOUDFLARE_D1Data: PersistedIconPosition,
  defaults: { x: number; y: number },
  isAdmin: boolean = false
): { x: number; y: number } {
  const vp = getViewport();
  // Icon minimum visibility: keep at least this many pixels dari tiap edge supaya
  // icon nggak pernah ketutup menu bar atas atau dock bawah, dan tetap clickable.
  const ICON_BOX = 80; // asumsi ukuran icon (matches DesktopIcon baseHeight large)
  const TOP_SAFE = 40; // space untuk MenuBar
  const BOTTOM_SAFE = 120; // space untuk Dock
  const SIDE_SAFE = 8;

  const clamp = (x: number, y: number) => ({
    x: Math.max(SIDE_SAFE, Math.min(x, Math.max(SIDE_SAFE, vp.width - ICON_BOX - SIDE_SAFE))),
    y: Math.max(TOP_SAFE, Math.min(y, Math.max(TOP_SAFE, vp.height - BOTTOM_SAFE))),
  });

  // 1. Cek localStorage hanya jika admin
  if (isAdmin) {
    const local = loadPositions().icons?.[id];
    if (local) {
      // Admin punya buffer lokal → prioritas. Tetap clamp supaya kalau admin
      // pindah ke layar yang lebih kecil, iconnya nggak ilang.
      return clamp(local.x, local.y);
    }
  }

  // 2. Percentage-based (NEW — responsive cross-device)
  if (isFiniteNumber(CLOUDFLARE_D1Data?.xPct) && isFiniteNumber(CLOUDFLARE_D1Data?.yPct)) {
    const x = (CLOUDFLARE_D1Data.xPct! / 100) * vp.width;
    const y = (CLOUDFLARE_D1Data.yPct! / 100) * vp.height;
    return clamp(x, y);
  }

  // 3. Legacy pixel-based — scale proporsional bila refScreen dikenal,
  //    fallback: pakai pixel langsung lalu di-clamp.
  if (isFiniteNumber(CLOUDFLARE_D1Data?.x) && isFiniteNumber(CLOUDFLARE_D1Data?.y)) {
    const refW = isFiniteNumber(CLOUDFLARE_D1Data?.refScreenWidth)
      ? CLOUDFLARE_D1Data!.refScreenWidth!
      : null;
    const refH = isFiniteNumber(CLOUDFLARE_D1Data?.refScreenHeight)
      ? CLOUDFLARE_D1Data!.refScreenHeight!
      : null;
    if (refW && refH && refW > 0 && refH > 0) {
      const x = (CLOUDFLARE_D1Data!.x! / refW) * vp.width;
      const y = (CLOUDFLARE_D1Data!.y! / refH) * vp.height;
      return clamp(x, y);
    }
    return clamp(CLOUDFLARE_D1Data!.x!, CLOUDFLARE_D1Data!.y!);
  }

  // 4. Default grid slot (already within viewport from desktopLayoutUtils)
  return clamp(defaults.x, defaults.y);
}

// Save single icon position
// Persist pixel + percentage + reference screen — supaya admin yang pakai layar
// besar tetap responsive saat visitor buka di layar kecil/sedang.
export function saveIconPosition(
  id: string,
  pos: { x: number; y: number; zIndex?: number; size?: DesktopIconSize },
  isAdmin: boolean = false
) {
  if (!isAdmin) return; // Visitor: no persistence to follow "refresh = reset" rule

  const current = loadPositions();
  const vp = getViewport();
  const xPct = vp.width > 0 ? (pos.x / vp.width) * 100 : 0;
  const yPct = vp.height > 0 ? (pos.y / vp.height) * 100 : 0;

  savePositions({
    icons: {
      ...current.icons,
      [id]: {
        x: pos.x,
        y: pos.y,
        zIndex: pos.zIndex ?? current.icons?.[id]?.zIndex,
        size: pos.size ?? current.icons?.[id]?.size,
        xPct,
        yPct,
        refScreenWidth: vp.width,
        refScreenHeight: vp.height,
      },
    },
  });
}

export function saveIconSize(id: string, size: DesktopIconSize, isAdmin: boolean = false) {
  if (!isAdmin) return;

  const current = loadPositions();
  const existing = current.icons?.[id];
  if (!existing) return;

  savePositions({
    icons: {
      ...current.icons,
      [id]: {
        ...existing,
        size,
      },
    },
  });
}

export function saveIconZIndex(id: string, zIndex: number, isAdmin: boolean = false) {
  if (!isAdmin) return;

  const current = loadPositions();
  const existing = current.icons?.[id];
  if (!existing) return;

  savePositions({
    icons: {
      ...current.icons,
      [id]: {
        ...existing,
        zIndex,
      },
    },
  });
}

// Save single window position
export function saveWindowPosition(
  id: string,
  pos: { x?: number; y?: number; width?: number; height?: number; zIndex?: number },
  isAdmin: boolean = false
) {
  if (!isAdmin) return; // Visitor changes are not persisted

  // FIX: Merge dengan posisi persisted saat ini, bukan hardcoded default.
  // Kalau user cuma drag (update x/y), width/height yang tidak di-pass
  // harus tetap pakai nilai persisted — bukan di-reset ke default.
  const current = loadPositions();
  const persisted = current.windows?.[id];
  const fallback = { x: 100, y: 80, width: 900, height: 600 };
  const base: WindowPosition = persisted ?? fallback;

  const updated: WindowPosition = {
    x: pos.x ?? base.x,
    y: pos.y ?? base.y,
    width: pos.width ?? base.width,
    height: pos.height ?? base.height,
    zIndex: pos.zIndex ?? base.zIndex,
  };

  savePositions({
    windows: {
      ...current.windows,
      [id]: updated,
    },
  });
}

// Save single note position (for visitor session)
export function saveNotePosition(
  id: string,
  pos: { x?: number; y?: number; width?: number; height?: number; zIndex?: number },
  isAdmin: boolean = false
) {
  if (!isAdmin) return; // Visitor changes no longer persisted (refresh = reset)

  // FIX: Merge dengan posisi persisted saat ini, bukan hardcoded default.
  const current = loadPositions();
  const persisted = current.notes?.[id];
  const fallback = { x: 100, y: 100, width: 280, height: 280 };
  const base: NotePosition = persisted ?? fallback;

  const updated: NotePosition = {
    x: pos.x ?? base.x,
    y: pos.y ?? base.y,
    width: pos.width ?? base.width,
    height: pos.height ?? base.height,
    zIndex: pos.zIndex ?? base.zIndex,
  };

  savePositions({
    notes: {
      ...current.notes,
      [id]: updated,
    },
  });
}

// Flush semua ke server (admin)
export async function flushPositions(csrfToken: string, siteId = 'default-site'): Promise<boolean> {
  try {
    const positions = loadPositions();

    const payload = {
      windowPreferences: positions.windows || {},
      desktopPreferences: {
        iconPositions: positions.icons || {},
      },
    };

    const res = await fetch('/api/about', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ ...payload, siteId }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
