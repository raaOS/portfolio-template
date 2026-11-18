import { describe, expect, it } from 'vitest';
import type { AdminApp, AdminZone, TemplateScope } from './types';
import { filterZonesByTemplate, getTemplateScopeLabel } from './templateScope';

function makeApp(id: string, templateScope?: TemplateScope[]): AdminApp {
  return {
    id,
    label: id,
    icon: (() => null) as unknown as AdminApp['icon'],
    iconColor: '',
    iconBg: '',
    defaultWidth: 800,
    defaultHeight: 600,
    ...(templateScope ? { templateScope } : {}),
  };
}

function makeZones(): AdminZone[] {
  const zone = {
    id: 'content',
    label: 'Konten & Berkas',
    description: '',
    icon: (() => null) as unknown as AdminZone['icon'],
    iconColor: '',
    iconBg: '',
    gradient: '',
    apps: [
      makeApp('projects'),
      makeApp('dock', ['os-desktop']),
      makeApp('feedback', ['os-desktop']),
      makeApp('appearance', ['os-desktop', 'spatial-gallery']),
    ],
  };
  return [zone];
}

describe('filterZonesByTemplate', () => {
  it('template tidak diketahui (null) = fail-open, semua app tetap tampil', () => {
    const zones = makeZones();
    const result = filterZonesByTemplate(zones, null);
    expect(result[0].apps.map((a) => a.id)).toEqual([
      'projects',
      'dock',
      'feedback',
      'appearance',
    ]);
  });

  it('template macOS: hanya app tanpa scope + scope macOS yang lolos', () => {
    const result = filterZonesByTemplate(makeZones(), 'os-desktop');
    expect(result[0].apps.map((a) => a.id)).toEqual([
      'projects',
      'dock',
      'feedback',
      'appearance',
    ]);
  });

  it('template canvas: app khas macOS + split appearance tersaring keluar', () => {
    const result = filterZonesByTemplate(makeZones(), 'infinite-canvas');
    expect(result[0].apps.map((a) => a.id)).toEqual(['projects']);
  });

  it('template spatial: app macOS-only (dock, feedback) tersaring, split appearance lolos', () => {
    const result = filterZonesByTemplate(makeZones(), 'spatial-gallery');
    expect(result[0].apps.map((a) => a.id)).toEqual(['projects', 'appearance']);
  });

  it('zona yang kehabisan app ikut hilang', () => {
    const zones = makeZones().map((z) => ({
      ...z,
      apps: z.apps.filter((a) => a.id === 'dock'),
    }));
    const result = filterZonesByTemplate(zones, 'infinite-canvas');
    expect(result).toEqual([]);
  });

  it('input tidak termutasi (filter murni)', () => {
    const zones = makeZones();
    filterZonesByTemplate(zones, 'infinite-canvas');
    expect(zones[0].apps.length).toBe(4);
  });
});

describe('getTemplateScopeLabel', () => {
  it('undefined / lengkap = Semua template', () => {
    expect(getTemplateScopeLabel(undefined)).toBe('Semua template');
    expect(getTemplateScopeLabel([])).toBe('Semua template');
    expect(
      getTemplateScopeLabel(['os-desktop', 'infinite-canvas', 'spatial-gallery'])
    ).toBe('Semua template');
  });

  it('label singkat per kombinasi', () => {
    expect(getTemplateScopeLabel(['os-desktop'])).toBe('macOS saja');
    expect(getTemplateScopeLabel(['infinite-canvas'])).toBe('Canvas saja');
    expect(getTemplateScopeLabel(['spatial-gallery'])).toBe('Spatial saja');
    expect(getTemplateScopeLabel(['os-desktop', 'spatial-gallery'])).toBe('macOS + Spatial saja');
  });
});
