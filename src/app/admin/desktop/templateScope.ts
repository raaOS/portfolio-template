/**
 * Filter & label cakupan template untuk desktop admin.
 *
 * Setiap app registry boleh mendeklarasikan `templateScope` (daftar template
 * yang benar-benar menampilkan kontennya — hasil audit konten CRUD 2026-11-15).
 * Desktop admin menyaring daftar ini RUNTIME berdasarkan
 * `sites.active_template_key` deployment, sehingga:
 *   - klien infinite-canvas tidak melihat app khas macOS (Dock, Explorer, dst.);
 *   - owner tidak lagi bingung "CRUD ini punya template mana".
 *
 * FAIL-OPEN: bila template aktif tidak diketahui (D1 sesaat, endpoint gagal),
 * SEMUA app tetap tampil — jangan pernah menyembunyikan CRUD karena error.
 *
 * @module
 */
import type { AdminZone, TemplateScope } from './types';

/** Key template yang dikenal — sinkron dengan `src/lib/templates/registry.ts`. */
export type ActiveTemplateKey = TemplateScope;

/**
 * Saring zona + app berdasarkan template aktif deployment.
 * App tanpa `templateScope` dianggap "semua template" (selalu lolos).
 * Zona yang kehabisan app ikut hilang (pola sama dengan filter ownerOnly).
 */
export function filterZonesByTemplate(
  zones: AdminZone[],
  activeTemplate: ActiveTemplateKey | null | undefined
): AdminZone[] {
  if (!activeTemplate) return zones;

  return zones
    .map((zone) => ({
      ...zone,
      apps: zone.apps.filter(
        (app) => !app.templateScope || app.templateScope.includes(activeTemplate)
      ),
    }))
    .filter((zone) => zone.apps.length > 0);
}

/** Label badge singkat untuk chip di folder app admin. */
export function getTemplateScopeLabel(scope: TemplateScope[] | undefined): string {
  if (!scope || scope.length === 0) return 'Semua template';
  if (scope.length === 3) return 'Semua template';

  const names: Record<TemplateScope, string> = {
    'os-desktop': 'macOS',
    'infinite-canvas': 'Canvas',
    'spatial-gallery': 'Spatial',
  };

  return scope.map((key) => names[key]).join(' + ') + ' saja';
}
