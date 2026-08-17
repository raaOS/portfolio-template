/**
 * Helper untuk track mode tampilan terakhir di /projects (grid atau 3D canvas).
 *
 * Dipakai oleh:
 * - ProjectsFinderHeader: menyimpan mode aktif setiap kali user berpindah mode
 * - ProjectBackButton (di project detail): baca mode terakhir biar tombol
 *   "Back to Projects" balik ke mode yang sama dengan yang user pakai sebelumnya.
 *
 * sessionStorage dipilih (bukan localStorage) agar state hanya persist selama
 * tab session — buka tab baru = mulai dari grid (default).
 *
 * API subscribe/getSnapshot mengikuti signature useSyncExternalStore agar
 * component bisa baca sessionStorage secara SSR-safe tanpa hydration mismatch.
 */

const STORAGE_KEY = 'portfolio:lastProjectsView';
const EVENT_NAME = 'portfolio:projectsViewChange';

export type ProjectsViewMode = 'grid' | '3d';

const DEFAULT_MODE: ProjectsViewMode = 'grid';

export function saveProjectsViewMode(view: ProjectsViewMode): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, view);
    // Notify listener supaya useSyncExternalStore re-read snapshot
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // sessionStorage bisa throw di private mode Safari, aman untuk di-ignore
  }
}

export function readProjectsViewMode(): ProjectsViewMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw === '3d' ? '3d' : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

/** Bangun URL /projects?view=... dari mode yang diberikan */
export function buildProjectsHref(view: ProjectsViewMode, basePath = ''): string {
  const normalizedBasePath = basePath && basePath !== '/' ? basePath : '';
  return view === '3d'
    ? `${normalizedBasePath}/projects?view=3d`
    : `${normalizedBasePath}/projects`;
}

/** Subscribe untuk useSyncExternalStore — listen perubahan mode dari tab yang sama */
export function subscribeProjectsViewMode(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, onChange);
  // Juga listen storage event untuk cross-tab sync (walau sessionStorage jarang cross-tab)
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT_NAME, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** Server snapshot selalu default agar SSR tidak mismatch */
export function getProjectsViewModeServerSnapshot(): ProjectsViewMode {
  return DEFAULT_MODE;
}
