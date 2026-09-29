import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { validateAdminRequest } from '@/lib/auth';
import { updateSettingsSchema } from '@/lib/validations';
import {
  BANNED_WORDS_DEFAULTS,
  invalidateBannedWordsCache,
  normalizeBannedWords,
} from '@/lib/services/bannedWordsService';

export async function getSettingsData() {
  try {
    const snap = await db.ref('settings').once('value');
    const data = snap.val();
    if (!data || !data.bannedWords || data.bannedWords.length === 0) {
      return { ...data, bannedWords: [...BANNED_WORDS_DEFAULTS] };
    }
    return { ...data, bannedWords: normalizeBannedWords(data.bannedWords) };
  } catch {
    return { bannedWords: [...BANNED_WORDS_DEFAULTS] };
  }
}

// SECURITY FIX (audit 2026-09-29): allowlist eksplisit untuk caller non-admin.
// Row `settings` juga menampung field sensitif (settings/adminPassword,
// settings/adminPin — hash yang ditulis endpoint legacy), jadi membuang
// `bannedWords` saja (blocklist) tetap membocorkan field lain. Allowlist:
// hanya flag boolean publik yang boleh keluar.
const PUBLIC_SETTINGS_KEYS = ['maintenanceMode', 'allowComments'] as const;

export async function GET(request: NextRequest) {
  const data = await getSettingsData();
  const isAdmin = await validateAdminRequest(request, { checkCsrf: false });

  if (isAdmin) {
    return NextResponse.json(data);
  }

  const publicSettings = Object.fromEntries(
    PUBLIC_SETTINGS_KEYS.filter((key) => key in data).map((key) => [key, data[key]])
  );
  return NextResponse.json(publicSettings);
}

export async function POST(request: NextRequest) {
  try {
    if (!(await validateAdminRequest(request))) {
      return NextResponse.json({ error: 'Unauthorized or invalid CSRF token' }, { status: 401 });
    }
    const body = await request.json();

    const validation = updateSettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid settings payload',
          details: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const settingsToSave = { ...validation.data };
    if (Array.isArray(settingsToSave.bannedWords)) {
      settingsToSave.bannedWords = normalizeBannedWords(settingsToSave.bannedWords);
    }

    // Save only validated data to CLOUDFLARE_D1 (prevents junk fields).
    // Use .update() instead of .set() to merge into the existing row —
    // .set() would overwrite the entire `settings` row, destroying nested
    // fields like adminPassword and adminOtp written by other endpoints.
    await db.ref('settings').update(settingsToSave);

    if ('bannedWords' in settingsToSave) {
      invalidateBannedWordsCache();
    }

    return NextResponse.json({ success: true, settings: settingsToSave });
  } catch (error: unknown) {
    console.error('[API/Settings] POST Error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
