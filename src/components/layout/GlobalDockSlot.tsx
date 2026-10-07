'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const GLOBAL_DOCK_SLOT_ID = 'global-dock-slot';

/**
 * Module-level store untuk slot DOM target.
 *
 * Awalnya pernah pakai MutationObserver di document.body subtree, tapi itu
 * overhead-berat untuk desktop OS interaktif (drag icons, window moves,
 * chat updates → fire ribuan kali per detik). Sekarang slot publish dirinya
 * langsung lewat ref callback saat mount/unmount.
 */
type Listener = () => void;
let slotElement: HTMLElement | null = null;
const listeners = new Set<Listener>();

function setSlot(el: HTMLElement | null) {
  if (slotElement === el) return;
  slotElement = el;
  listeners.forEach((listener) => listener());
}

function subscribeSlot(callback: Listener): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSlotSnapshot(): HTMLElement | null {
  return slotElement;
}

function getServerSnapshot(): HTMLElement | null {
  return null;
}

/**
 * Portal helper: mount children ke `#global-dock-slot` yang dirender oleh
 * {@link GlobalDockSlot} di level layout (non-lazy).
 *
 * Konteks bug yang di-fix:
 * - OSDock (route `/`) di-render di dalam DesktopEnvironment → lazy chunk.
 * - GlobalDock (non-OS routes) di-render di dalam NonOSChrome → lazy chunk.
 * - Saat navigasi `/` ↔ non-OS, View Transitions API mengambil snapshot
 *   sebelum chunk baru selesai mount, jadi element dengan VT name
 *   `global-dock` cuma ada di SALAH SATU snapshot. Tanpa pair yang valid,
 *   browser fallback ke root animation → dock terlihat ikut slide.
 *
 * Solusi: slot persistent dengan VT name di non-lazy code path. Dock real
 * (OSDock/GlobalDock) tetap di lazy chunk masing-masing untuk menjaga
 * akses context, tapi konten visual-nya di-portal ke slot ini supaya rect
 * dock identik di kedua snapshot lintas semua route.
 */
/**
 * Kelas layout dock slot — DIPAKAI BERSAMA oleh {@link GlobalDockSlot} dan
 * fallback {@link DockPortal} supaya rect dock identik dan tidak ada lompatan
 * 1 frame saat target portal baru tersedia.
 */
const DOCK_SLOT_CLASS =
  'pointer-events-none fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,12px))] left-0 right-0 flex justify-center pb-[env(safe-area-inset-bottom,0px)] print:hidden';

export function DockPortal({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribeSlot, getSlotSnapshot, getServerSnapshot);

  // Fallback WAJIB untuk route yang tidak memasang GlobalDockSlot — yaitu
  // route di root layout (`/preview/*`), karena LayoutClient hanya dipasang di
  // `(site)/layout.tsx` dan di `/` mode klien (`src/app/page.tsx`). Tanpa
  // fallback ini `target` selalu null → DockPortal return null → OSDock/GlobalDock tidak
  // pernah masuk DOM dan dock hilang total (bug: dock tidak muncul di
  // /preview/os-desktop).
  //
  // Sengaja TANPA `id` dan TANPA `viewTransitionName`: pada route yang punya
  // slot, ref callback slot baru terpasang di commit phase, jadi 1 frame pertama
  // fallback ini hidup berdampingan dengan slot asli. Duplikat `id` dan
  // duplikat `view-transition-name` membuat Chrome membuang pasangan snapshot
  // view transition (dock ikut slide / animasi patah).
  if (!target) {
    return (
      <div className={DOCK_SLOT_CLASS} style={{ zIndex: 99999 }}>
        {children}
      </div>
    );
  }
  return createPortal(children, target);
}

/**
 * Slot DOM untuk dock global. Dipasang sekali di {@link LayoutClient}.
 *
 * `viewTransitionName: 'global-dock'` di sini, BUKAN di OSDock/GlobalDock
 * inner wrapper — supaya element ini ada konsisten lintas semua navigasi
 * yang memakai layout yang sama.
 *
 * Ref callback `setSlot` publish ke module store langsung saat mount/unmount,
 * tanpa MutationObserver. Pattern ini juga membuat target tersedia secara
 * sinkron pada commit phase yang sama dengan slot itu sendiri — penting
 * supaya DockPortal langsung bisa render konten di pass pertama dan View
 * Transition snapshot melihat dock yang utuh.
 */
export default function GlobalDockSlot() {
  return (
    <div
      ref={setSlot}
      id={GLOBAL_DOCK_SLOT_ID}
      className={DOCK_SLOT_CLASS}
      style={{
        viewTransitionName: 'global-dock',
        zIndex: 99999,
      }}
      aria-hidden="false"
    />
  );
}
