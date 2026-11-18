import type { LucideIcon } from 'lucide-react';

/**
 * Template yang dikonsumsi sebuah app admin. Nilainya = key template di
 * `sites.active_template_key` / `src/lib/templates/registry.ts`.
 */
export type TemplateScope = 'os-desktop' | 'infinite-canvas' | 'spatial-gallery';

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
  /**
   * Cakupan template: app hanya relevan untuk template yang terdaftar di sini.
   * Tidak diset (undefined) = tampil di semua template.
   *
   * Disaring RUNTIME di desktop admin berdasarkan `sites.active_template_key`
   * deployment ini (endpoint `/api/admin/site-template` + `templateScope.ts`)
   * — bukan saat build — sehingga satu bundle tetap melayani semua template
   * dan dashboard otomatis menyesuaikan template yang aktif.
   */
  templateScope?: TemplateScope[];
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
