import { describe, it, expect } from 'vitest';
import {
  hardSkillSchema,
  bulkUpdateHardSkillsSchema,
  updateHardSkillSchema,
  stickyNoteSchema,
  stickyNotesBulkSchema,
  galleryFeaturedSchema,
  updateDesignPhilosophySchema,
  createHardSkillConceptSchema,
  updateHardSkillConceptSchema,
  updateAboutSchema,
  wallpaperSchema,
} from '../adminCrud';

describe('hardSkillSchema', () => {
  const validSkill = {
    id: 'skill-1',
    name: 'Photoshop',
    iconUrl: 'https://example.com/icon.png',
    level: 'Advanced' as const,
    order: 1,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };

  it('accepts valid skill', () => {
    expect(hardSkillSchema.safeParse(validSkill).success).toBe(true);
  });

  it('rejects invalid level enum', () => {
    const result = hardSkillSchema.safeParse({ ...validSkill, level: 'Guru' });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = hardSkillSchema.safeParse({ ...validSkill, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects negative order', () => {
    const result = hardSkillSchema.safeParse({ ...validSkill, order: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict)', () => {
    const result = hardSkillSchema.safeParse({
      ...validSkill,
      unknownField: 'hack',
    });
    expect(result.success).toBe(false);
  });
});

describe('bulkUpdateHardSkillsSchema', () => {
  it('accepts empty array', () => {
    expect(bulkUpdateHardSkillsSchema.safeParse([]).success).toBe(true);
  });

  it('rejects non-array', () => {
    expect(bulkUpdateHardSkillsSchema.safeParse({ skills: [] }).success).toBe(false);
  });

  it('caps array size at 200', () => {
    const huge = Array.from({ length: 201 }, (_, i) => ({
      id: `skill-${i}`,
      name: 'X',
      iconUrl: 'x',
      level: 'Beginner' as const,
      order: i,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    }));
    expect(bulkUpdateHardSkillsSchema.safeParse(huge).success).toBe(false);
  });
});

describe('updateHardSkillSchema', () => {
  it('rejects attempt to override id via body', () => {
    // id & createdAt di-omit dari updateHardSkillSchema
    const result = updateHardSkillSchema.safeParse({
      id: 'forged-id',
      name: 'Updated',
    });
    expect(result.success).toBe(false);
  });

  it('requires at least one field', () => {
    const result = updateHardSkillSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts single field update', () => {
    const result = updateHardSkillSchema.safeParse({ name: 'Renamed' });
    expect(result.success).toBe(true);
  });
});

describe('stickyNoteSchema', () => {
  const validNote = {
    id: 'note-1',
    text: 'Hello',
    date: '2025-01-01T00:00:00Z',
    color: '#fef08a',
    isStarred: false,
    isDeleted: false,
  };

  it('accepts minimal valid note', () => {
    expect(stickyNoteSchema.safeParse(validNote).success).toBe(true);
  });

  it('caps text length at 5000', () => {
    const huge = { ...validNote, text: 'x'.repeat(5001) };
    expect(stickyNoteSchema.safeParse(huge).success).toBe(false);
  });

  it('rejects unknown fields', () => {
    const result = stickyNoteSchema.safeParse({ ...validNote, evil: 'xss' });
    expect(result.success).toBe(false);
  });

  it('accepts percentage positioning', () => {
    const result = stickyNoteSchema.safeParse({
      ...validNote,
      xPct: 50,
      yPct: 60,
      widthPct: 30,
      heightPct: 40,
    });
    expect(result.success).toBe(true);
  });

  it('bounds opacity 0..1', () => {
    expect(stickyNoteSchema.safeParse({ ...validNote, opacity: 1.5 }).success).toBe(false);
    expect(stickyNoteSchema.safeParse({ ...validNote, opacity: 0.5 }).success).toBe(true);
  });
});

describe('stickyNotesBulkSchema', () => {
  it('caps array at 200 notes', () => {
    const huge = Array.from({ length: 201 }, (_, i) => ({
      id: `note-${i}`,
      text: '',
      date: '2025-01-01',
      color: '#fff',
      isStarred: false,
      isDeleted: false,
    }));
    expect(stickyNotesBulkSchema.safeParse(huge).success).toBe(false);
  });
});

describe('galleryFeaturedSchema', () => {
  it('accepts valid list', () => {
    const result = galleryFeaturedSchema.safeParse({
      featuredProjectIds: ['id-1', 'id-2'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty string id', () => {
    const result = galleryFeaturedSchema.safeParse({
      featuredProjectIds: ['', 'valid'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing featuredProjectIds key', () => {
    expect(galleryFeaturedSchema.safeParse({}).success).toBe(false);
  });

  it('caps list at 100 items', () => {
    const huge = { featuredProjectIds: Array.from({ length: 101 }, (_, i) => `id-${i}`) };
    expect(galleryFeaturedSchema.safeParse(huge).success).toBe(false);
  });
});

describe('updateDesignPhilosophySchema', () => {
  it('requires heading, subheading, dan workflowSteps', () => {
    expect(updateDesignPhilosophySchema.safeParse({}).success).toBe(false);
  });

  it('accepts valid payload', () => {
    const payload = {
      heading: 'Design Philosophy',
      subheading: 'Approach',
      workflowSteps: [
        {
          id: 'step-1',
          number: '01',
          title: 'Research',
          subtitle: 'Deep dive',
          description: 'We start with research.',
          type: 'phase' as const,
          color: 'amber' as const,
          icon: 'search',
          subSteps: [],
          nextSteps: ['step-2'],
          loopTargets: [],
        },
      ],
    };
    expect(updateDesignPhilosophySchema.safeParse(payload).success).toBe(true);
  });

  it('rejects workflowSteps with invalid type enum', () => {
    const payload = {
      heading: 'H',
      subheading: 'S',
      workflowSteps: [
        {
          id: 'step-1',
          number: '01',
          title: 'T',
          subtitle: 'St',
          description: 'D',
          type: 'invalid-type',
          color: 'amber' as const,
          icon: 'x',
          subSteps: [],
          nextSteps: [],
          loopTargets: [],
        },
      ],
    };
    expect(updateDesignPhilosophySchema.safeParse(payload).success).toBe(false);
  });
});

describe('hardSkillConceptSchemas', () => {
  it('createHardSkillConceptSchema requires title + description', () => {
    expect(
      createHardSkillConceptSchema.safeParse({
        title: 'UI',
        description: 'User interface design',
      }).success
    ).toBe(true);
    expect(createHardSkillConceptSchema.safeParse({ title: 'UI' }).success).toBe(false);
  });

  it('updateHardSkillConceptSchema requires at least one field', () => {
    expect(updateHardSkillConceptSchema.safeParse({}).success).toBe(false);
    expect(updateHardSkillConceptSchema.safeParse({ title: 'New' }).success).toBe(true);
  });
});

describe('updateAboutSchema layout preferences', () => {
  it('accepts persisted zIndex for desktop icons/windows and icon size', () => {
    const result = updateAboutSchema.safeParse({
      desktopPreferences: {
        iconPositions: {
          'project-a': {
            x: 120,
            y: 160,
            zIndex: 420,
            size: 'large',
            xPct: 10,
            yPct: 20,
            refScreenWidth: 1200,
            refScreenHeight: 800,
          },
        },
      },
      windowPreferences: {
        about: {
          x: 100,
          y: 80,
          width: 900,
          height: 600,
          zIndex: 430,
          isOpenByDefault: true,
        },
      },
    });

    expect(result.success).toBe(true);
  });
});

describe('wallpaperSchema', () => {
  it('accepts valid wallpaper with all fields', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-1',
      url: '/r2/assets/wallpapers/ocean.mp4',
      name: 'Ocean Sunset',
      type: 'video',
      posterUrl: '/r2/assets/wallpapers/ocean.jpg',
      startTime: 30,
    });
    expect(result.success).toBe(true);
  });

  it('accepts wallpaper type metadata from persisted wallpaper entries', () => {
    const videoResult = wallpaperSchema.safeParse({
      id: 'wp-video',
      url: '/r2/assets/wallpapers/ocean.mp4',
      type: 'video',
      startTime: 15,
    });
    const imageResult = wallpaperSchema.safeParse({
      id: 'wp-image',
      url: '/r2/assets/wallpapers/static.webp',
      type: 'image',
    });

    expect(videoResult.success).toBe(true);
    expect(imageResult.success).toBe(true);
  });

  it('accepts wallpaper without optional fields', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-minimal',
      url: '/r2/image.jpg',
    });
    expect(result.success).toBe(true);
  });

  it('accepts legacy wallpaper media type', () => {
    expect(
      wallpaperSchema.safeParse({
        id: 'wp-video',
        url: '/r2/video.mp4',
        type: 'video',
      }).success
    ).toBe(true);
    expect(
      wallpaperSchema.safeParse({
        id: 'wp-image',
        url: '/r2/image.webp',
        type: 'image',
      }).success
    ).toBe(true);
  });

  it('accepts startTime as string and coerces to number', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-coerce',
      url: '/r2/v.mp4',
      startTime: '45',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.startTime).toBe(45);
  });

  it('accepts startTime = 0', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-zero',
      url: '/r2/v.mp4',
      startTime: 0,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.startTime).toBe(0);
  });

  it('accepts startTime = 250 (max boundary)', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-max',
      url: '/r2/v.mp4',
      startTime: 250,
    });
    expect(result.success).toBe(true);
  });

  it('rejects startTime below 0', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-neg',
      url: '/r2/v.mp4',
      startTime: -1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects startTime above 250', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-over',
      url: '/r2/v.mp4',
      startTime: 251,
    });
    expect(result.success).toBe(false);
  });

  it('accepts undefined startTime (optional field omitted)', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-no-st',
      url: '/r2/v.mp4',
      name: 'Test',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.startTime).toBeUndefined();
  });

  it('rejects missing required id', () => {
    const result = wallpaperSchema.safeParse({
      url: '/r2/v.mp4',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing required url', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-x',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra fields (strict mode)', () => {
    const result = wallpaperSchema.safeParse({
      id: 'wp-x',
      url: '/r2/v.mp4',
      extraField: 'nope',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateAboutSchema loaderConfig', () => {
  const validLoader = {
    enabled: true,
    style: 'deck-reveal' as const,
    imageProjectIds: ['p-1', 'p-2'],
    durationMs: 2800,
    accentColor: '#1500E1',
    showCounter: true,
  };

  it('accepts valid loaderConfig', () => {
    const result = updateAboutSchema.safeParse({ loaderConfig: validLoader });
    expect(result.success).toBe(true);
  });

  it('accepts minimal loaderConfig (tanpa field optional)', () => {
    const result = updateAboutSchema.safeParse({
      loaderConfig: { enabled: false, style: 'deck-reveal', imageProjectIds: [] },
    });
    expect(result.success).toBe(true);
  });

  it('accepts hello style (imageProjectIds boleh kosong — tidak dipakai)', () => {
    const result = updateAboutSchema.safeParse({
      loaderConfig: { enabled: true, style: 'hello', imageProjectIds: [] },
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than 10 image ids', () => {
    const result = updateAboutSchema.safeParse({
      loaderConfig: {
        ...validLoader,
        imageProjectIds: Array.from({ length: 11 }, (_, i) => `p-${i}`),
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid accent color', () => {
    const result = updateAboutSchema.safeParse({
      loaderConfig: { ...validLoader, accentColor: 'biru' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects durationMs out of range', () => {
    const low = updateAboutSchema.safeParse({
      loaderConfig: { ...validLoader, durationMs: 500 },
    });
    const high = updateAboutSchema.safeParse({
      loaderConfig: { ...validLoader, durationMs: 20000 },
    });
    expect(low.success).toBe(false);
    expect(high.success).toBe(false);
  });

  it('rejects unknown style (strict enum)', () => {
    const result = updateAboutSchema.safeParse({
      loaderConfig: { ...validLoader, style: 'confetti' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown extra fields (strict mode)', () => {
    const result = updateAboutSchema.safeParse({
      loaderConfig: { ...validLoader, extraField: 'nope' },
    });
    expect(result.success).toBe(false);
  });
});
