import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest, unauthorized, validationError } from '@/lib/api-response';

import { validateClientRequest } from '@/lib/clientAuth';
import { aboutService } from '@/lib/services/aboutService';
import { stickyNotesService } from '@/lib/services/stickyNotesService';
import type { DockPreferences, WallpaperConfig } from '@/types/about';
import type { NoteData } from '@/components/os/ui/elements/StickyNoteItem';

export const dynamic = 'force-dynamic';

const dockLabelsSchema = z
  .object({
    projects: z.string().trim().max(40).optional(),
    contact: z.string().trim().max(40).optional(),
    whatsapp: z.string().trim().max(40).optional(),
    notes: z.string().trim().max(40).optional(),
    about: z.string().trim().max(40).optional(),
  })
  .strict();

const clientSystemSchema = z
  .object({
    wallpaperBlur: z.coerce.number().min(0).max(20).optional(),
    activeWallpaperId: z.string().trim().max(120).optional(),
    stickyNote: z
      .object({
        text: z.string().trim().max(2000).optional(),
        color: z
          .string()
          .trim()
          .regex(/^#[0-9a-f]{6}$/i)
          .optional(),
      })
      .strict()
      .optional(),
    dockLabels: dockLabelsSchema.optional(),
  })
  .strict()
  .refine(
    (payload) =>
      payload.wallpaperBlur !== undefined ||
      payload.activeWallpaperId !== undefined ||
      payload.stickyNote !== undefined ||
      payload.dockLabels !== undefined,
    'At least one system section must be updated'
  );

const DOCK_KEYS = ['projects', 'contact', 'whatsapp', 'notes', 'about'] as const;

function requirePro(_plan: string) {
  // Paket Lite dan Pro sama-sama diizinkan ganti wallpaper & tampilan sistem
  return null;
}


function revalidateClientTenant(siteSlug: string) {
  revalidatePath(`/${siteSlug}`, 'layout');
  revalidatePath(`/${siteSlug}`);
}

function serializeDockLabels(dockConfig?: DockPreferences) {
  return DOCK_KEYS.reduce<Record<(typeof DOCK_KEYS)[number], string>>(
    (labels, key) => {
      labels[key] = dockConfig?.[key]?.label || '';
      return labels;
    },
    {
      projects: '',
      contact: '',
      whatsapp: '',
      notes: '',
      about: '',
    }
  );
}

function serializeWallpapers(wallpaperConfig?: WallpaperConfig) {
  return (wallpaperConfig?.collection || []).map((wallpaper) => ({
    id: wallpaper.id,
    name: wallpaper.name || wallpaper.id,
    type: wallpaper.type || 'image',
    url: wallpaper.url,
    posterUrl: wallpaper.posterUrl,
  }));
}

function getEditableStickyNote(notes: NoteData[]) {
  return notes.find((note) => !note.isDeleted) || null;
}

function createClientStickyNote(): NoteData {
  const now = new Date().toISOString();
  return {
    id: `client-note-${Date.now()}`,
    text: '',
    date: now,
    color: '#fef08a',
    isStarred: false,
    isDeleted: false,
    xPct: 72,
    yPct: 18,
    widthPct: 22,
    heightPct: 26,
    zIndex: 1,
    fontSize: 16,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await validateClientRequest(request, { checkCsrf: false });
    if (!session) return unauthorized('Client session is required');
    const proError = requirePro(session.plan);
    if (proError) return proError;

    const [about, notes] = await Promise.all([
      aboutService.getAboutData(false, true, session.siteId),
      stickyNotesService.getNotes(false, true, session.siteId),
    ]);
    const stickyNote = getEditableStickyNote(notes);

    return NextResponse.json(
      {
        success: true,
        data: {
          wallpaperBlur: about.wallpaperConfig?.blur ?? 0,
          activeWallpaperId: about.wallpaperConfig?.activeWallpaperId || '',
          wallpapers: serializeWallpapers(about.wallpaperConfig),
          stickyNote: {
            text: stickyNote?.text || '',
            color: stickyNote?.color || '#fef08a',
          },
          dockLabels: serializeDockLabels(about.dockConfig),
        },
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('[Client System GET] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read client system settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await validateClientRequest(request);
    if (!session) return unauthorized('Client session is required');
    const proError = requirePro(session.plan);
    if (proError) return proError;

    const rawBody = await request.json().catch(() => ({}));
    const validationResult = clientSystemSchema.safeParse(rawBody);
    if (!validationResult.success) return validationError(validationResult.error);

    const payload = validationResult.data;
    const writes: Promise<unknown>[] = [];

    if (
      payload.wallpaperBlur !== undefined ||
      payload.activeWallpaperId !== undefined ||
      payload.dockLabels !== undefined
    ) {
      const about = await aboutService.getAboutData(true, true, session.siteId);
      const currentWallpaperConfig = about.wallpaperConfig;
      const collection = currentWallpaperConfig?.collection || [];

      if (
        payload.activeWallpaperId &&
        !collection.some((wallpaper) => wallpaper.id === payload.activeWallpaperId)
      ) {
        return badRequest('Selected wallpaper is not available for this site');
      }

      const dockConfig: DockPreferences = { ...(about.dockConfig || {}) };
      if (payload.dockLabels) {
        DOCK_KEYS.forEach((key) => {
          if (payload.dockLabels?.[key] === undefined) return;
          dockConfig[key] = {
            ...(dockConfig[key] || {}),
            label: payload.dockLabels[key] || '',
          };
        });
      }

      writes.push(
        aboutService.updateAboutData(
          {
            wallpaperConfig: {
              ...(currentWallpaperConfig || {
                activeWallpaperId: payload.activeWallpaperId || '',
                collection: [],
              }),
              activeWallpaperId:
                payload.activeWallpaperId ?? currentWallpaperConfig?.activeWallpaperId ?? '',
              blur: payload.wallpaperBlur ?? currentWallpaperConfig?.blur ?? 0,
            },
            dockConfig,
          },
          session.siteId
        )
      );
    }

    if (payload.stickyNote) {
      const notes = await stickyNotesService.getNotes(true, true, session.siteId);
      const editableIndex = notes.findIndex((note) => !note.isDeleted);
      const baseNote = editableIndex >= 0 ? notes[editableIndex] : createClientStickyNote();
      const updatedNote: NoteData = {
        ...baseNote,
        text: payload.stickyNote.text ?? baseNote.text,
        color: payload.stickyNote.color ?? baseNote.color,
        date: new Date().toISOString(),
      };
      const nextNotes =
        editableIndex >= 0
          ? notes.map((note, index) => (index === editableIndex ? updatedNote : note))
          : [updatedNote, ...notes];
      writes.push(stickyNotesService.saveNotes(nextNotes, session.siteId));
    }

    await Promise.all(writes);
    revalidateClientTenant(session.siteSlug);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Client System PUT] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update client system settings' },
      { status: 500 }
    );
  }
}
