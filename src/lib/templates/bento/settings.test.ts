import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BENTO_SETTINGS,
  bentoSettingsInputSchema,
  normalizeBentoSettings,
} from './settings';

describe('normalizeBentoSettings', () => {
  it('returns defaults for invalid/empty input', () => {
    expect(normalizeBentoSettings(undefined)).toEqual(DEFAULT_BENTO_SETTINGS);
    expect(normalizeBentoSettings(null)).toEqual(DEFAULT_BENTO_SETTINGS);
    expect(normalizeBentoSettings('broken')).toEqual(DEFAULT_BENTO_SETTINGS);
    expect(normalizeBentoSettings(42)).toEqual(DEFAULT_BENTO_SETTINGS);
    expect(normalizeBentoSettings({ theme: 'nope', sections: 'nope' })).toEqual(DEFAULT_BENTO_SETTINGS);
  });

  it('merges partial theme/motion with defaults', () => {
    const result = normalizeBentoSettings({
      theme: { accent: 'rose' },
      motion: { parallax: true },
    });

    expect(result.theme).toEqual({ accent: 'rose', font: 'sans', background: 'light' });
    expect(result.motion).toEqual({ stagger: true, parallax: true });
    expect(result.sections).toEqual(DEFAULT_BENTO_SETTINGS.sections);
  });

  it('keeps saved section order and flags for known sections', () => {
    const result = normalizeBentoSettings({
      sections: [
        { id: 'contact', type: 'contact', order: 0, visible: true, variant: 'centered', animation: 'scale' },
        { id: 'hero', type: 'hero', order: 1, visible: false, variant: 'compact', animation: 'none' },
      ],
    });

    expect(result.sections[0]).toMatchObject({ id: 'contact', order: 0, variant: 'centered' });
    expect(result.sections[1]).toMatchObject({ id: 'hero', visible: false, variant: 'compact' });
  });

  it('drops unknown section types and appends missing defaults', () => {
    const result = normalizeBentoSettings({
      sections: [
        { id: 'hacker', type: 'hacker-panel', order: 0, visible: true, variant: 'default', animation: 'fade-up' },
        { id: 'projects', type: 'projects', order: 2, visible: true, variant: 'list', animation: 'fade-up' },
      ],
    });

    expect(result.sections.find((s) => s.id === 'hacker')).toBeUndefined();
    // Semua section bawaan tetap hadir
    for (const def of DEFAULT_BENTO_SETTINGS.sections) {
      expect(result.sections.some((s) => s.id === def.id)).toBe(true);
    }
    expect(result.sections.find((s) => s.id === 'projects')?.variant).toBe('list');
  });

  it('drops sections with invalid variant for their type (self-heals via default)', () => {
    const result = normalizeBentoSettings({
      sections: [
        { id: 'hero', type: 'hero', order: 0, visible: true, variant: 'mega-ultra', animation: 'fade-up' },
      ],
    });

    const hero = result.sections.find((s) => s.id === 'hero');
    expect(hero?.variant).toBe('default');
  });

  it('dedupes duplicate section ids and sorts by order', () => {
    const result = normalizeBentoSettings({
      sections: [
        { id: 'projects', type: 'projects', order: 5, visible: true, variant: 'grid', animation: 'fade-up' },
        { id: 'projects', type: 'projects', order: 1, visible: false, variant: 'list', animation: 'none' },
      ],
    });

    const projects = result.sections.filter((s) => s.id === 'projects');
    expect(projects).toHaveLength(1);
    expect(projects[0].order).toBe(5);

    const orders = result.sections.map((s) => s.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});

describe('bentoSettingsInputSchema', () => {
  it('accepts partial input', () => {
    expect(bentoSettingsInputSchema.safeParse({}).success).toBe(true);
    expect(bentoSettingsInputSchema.safeParse({ theme: { accent: 'cyan' } }).success).toBe(true);
  });

  it('rejects invalid payloads', () => {
    expect(bentoSettingsInputSchema.safeParse({ theme: { accent: 'INVALID TOKEN!!' } }).success).toBe(false);
    expect(
      bentoSettingsInputSchema.safeParse({
        sections: [{ id: 'x', type: 'unknown', order: 0, visible: true, variant: 'a', animation: 'fade-up' }],
      }).success
    ).toBe(false);
  });
});
