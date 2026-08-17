import { NextRequest, NextResponse } from 'next/server';
import { enforceRequestRateLimit } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
]);

export async function POST(request: NextRequest) {
  try {
    // SECURITY FIX: Validate FEATURE_AI is enabled globally.
    if (process.env.FEATURE_AI !== 'true') {
      return NextResponse.json({ error: 'AI features are not enabled' }, { status: 403 });
    }

    const provider = (process.env.AI_PROVIDER || '').toLowerCase();
    const groqKey = provider === 'groq' ? process.env.AI_API_KEY : '';
    if (!groqKey) {
      return NextResponse.json({ error: 'AI voice provider is not configured' }, { status: 500 });
    }

    const rateLimit = await enforceRequestRateLimit(
      request,
      'chat_voice',
      6,
      60 * 1000,
      5 * 60 * 1000
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many voice requests. Please try again later.',
          retryAfter: rateLimit.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as Blob | null;

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (file.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'Audio file is too large' }, { status: 413 });
    }

    if (file.type && !ALLOWED_AUDIO_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported audio file type' }, { status: 400 });
    }

    // Forward to Groq Whisper API
    const groqFormData = new FormData();
    groqFormData.append('file', file, 'audio.webm');
    groqFormData.append('model', 'whisper-large-v3-turbo');
    // optional: groqFormData.append('language', 'id');

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${groqKey}`,
      },
      body: groqFormData,
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      console.error('[Voice API] Groq Error:', errorText);
      return NextResponse.json({ error: 'Voice transcription failed' }, { status: 500 });
    }

    const data = await groqRes.json();

    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error('[Voice API] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
