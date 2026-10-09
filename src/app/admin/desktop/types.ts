import type { LucideIcon } from 'lucide-react';

// ─── Window state for each open CRUD window ───
export interface AdminWindowState {
  id: string;
  appId: string;
  title: string;
  icon: LucideIcon;
  iconColor: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ─── App definition inside a zone folder ───
export interface AdminApp {
  id: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  /** default window dimensions */
  defaultWidth: number;
  defaultHeight: number;
  /**
   * App khusus deployment owner (superadmin). Hanya tampil di desktop admin
   * saat `NEXT_PUBLIC_OWNER_MODE=true`; di site klien app disaring keluar
   * dari `ADMIN_ZONES` (lihat `registry.ts` + `src/lib/ownerMode.ts`).
   */
  ownerOnly?: boolean;
}

// ─── Zone (folder) definition ───
export interface AdminZone {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  gradient: string;
  apps: AdminApp[];
}

// ─── Window manager actions ───
export interface AdminDesktopActions {
  openApp: (zoneId: string, appId: string) => void;
  closeWindow: (windowId: string) => void;
  minimizeWindow: (windowId: string) => void;
  toggleMaximize: (windowId: string) => void;
  bringToFront: (windowId: string) => void;
  updatePosition: (windowId: string, x: number, y: number) => void;
  updateSize: (windowId: string, width: number, height: number) => void;
  openFolder: (zoneId: string) => void;
}
