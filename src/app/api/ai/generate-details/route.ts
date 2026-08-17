import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAiApiKey, getOpenRouterApiKey, guardAdminAiRequest } from '../_shared';
import { createHash } from 'node:crypto';
import { CacheManager } from '@/lib/cache/CacheManager';
import { deleteD1Value, getD1Value, isD1Configured, setD1Value } from '@/lib/cloudflareD1';

/**
 * AI Integration
 * Generates project details using Google's AI API.
 */
// API Timeout: 30 seconds
import {
  MAX_BASE64_CHARS,
  fetchRemoteMediaAsBase64,
  fetchLocalMediaAsBase64,
  parseInlineBase64,
} from '../media-helper';
import { buildProjectDetailsPrompt } from './prompt';
import {
  generateWithGoogleAI,
  generateWithOpenRouter,
  toFriendlyProviderError,
  type ProviderFailure,
} from './providers';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROMPT_VERSION = 'project-details-v2';

const generateDetailsCache = new CacheManager({
  defaultTTL: CACHE_TTL_MS,
  maxSize: 100,
  label: 'AiGenerateDetailsCache',
});

interface GenerateDetailsCacheRecord {
  data: Record<string, unknown>;
  expiresAt: number;
  createdAt: number;
}

function buildCacheKey(input: {
  base64Data: string;
  mimeType: string;
  style: string;
  maxTitleWords: number;
  sentenceCount: number;
}) {
  const mediaHash = createHash('sha256').update(input.base64Data).digest('hex');
  const optionHash = createHash('sha256')
    .update(
      JSON.stringify({
        promptVersion: PROMPT_VERSION,
        mimeType: input.mimeType,
        style: input.style,
        maxTitleWords: input.maxTitleWords,
        sentenceCount: input.sentenceCount,
      })
    )
    .digest('hex');

  return `generate-details:${mediaHash}:${optionHash}`;
}

async function readCachedDetails(cacheKey: string) {
  const memoryCached = generateDetailsCache.get<Record<string, unknown>>(cacheKey);
  if (memoryCached) return memoryCached;

  if (!isD1Configured()) return null;

  try {
    const persisted = await getD1Value<GenerateDetailsCacheRecord>(cacheKey);
    if (!persisted?.data || typeof persisted.expiresAt !== 'number') {
      return null;
    }

    if (Date.now() > persisted.expiresAt) {
      await deleteD1Value(cacheKey);
      return null;
    }

    generateDetailsCache.set(cacheKey, persisted.data, persisted.expiresAt - Date.now());
    return persisted.data;
  } catch (error) {
    console.warn('[AI Generate] Persistent cache read failed:', error);
    return null;
  }
}

async function writeCachedDetails(cacheKey: string, data: Record<string, unknown>) {
  generateDetailsCache.set(cacheKey, data);

  if (!isD1Configured()) return;

  try {
    const now = Date.now();
    await setD1Value(cacheKey, {
      data,
      createdAt: now,
      expiresAt: now + CACHE_TTL_MS,
    } satisfies GenerateDetailsCacheRecord);
  } catch (error) {
    console.warn('[AI Generate] Persistent cache write failed:', error);
  }
}

interface GenerateDetailsRequest {
  imageUrl?: string;
  imageBase64?: string;
  style?: string;
  maxTitleWords?: number;
  sentenceCount?: number;
}

export async function POST(req: NextRequest) {
  const guardResponse = await guardAdminAiRequest(req, 'ai_details');
  if (guardResponse) return guardResponse;

  const googleAiApiKey = getGoogleAiApiKey();
  const openRouterApiKey = getOpenRouterApiKey();
  if (!googleAiApiKey && !openRouterApiKey) {
    return NextResponse.json(
      { error: 'AI provider not configured. Set AI_PROVIDER and AI_API_KEY.' },
      { status: 500 }
    );
  }

  try {
    const {
      imageUrl,
      imageBase64,
      style = 'estetik',
      maxTitleWords = 5,
      sentenceCount = 2,
    } = (await req.json()) as GenerateDetailsRequest;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json({ error: 'Image URL or Base64 is required' }, { status: 400 });
    }

    // Check if local file or remote URL
    let base64Data = '';
    let mimeType = 'image/jpeg';

    if (imageBase64) {
      // Direct base64 input (e.g. from Client FileReader)
      const parsedInline = parseInlineBase64(imageBase64);
      base64Data = parsedInline.base64Data;
      mimeType = parsedInline.mimeType;
      if (base64Data.length > MAX_BASE64_CHARS) {
        return NextResponse.json({ error: 'Image payload is too large' }, { status: 413 });
      }
    } else if (imageUrl) {
      if (
        imageUrl.startsWith('/r2/') ||
        imageUrl.startsWith('r2/') ||
        imageUrl.startsWith('/assets/') ||
        imageUrl.startsWith('assets/')
      ) {
        const localMedia = await fetchLocalMediaAsBase64(imageUrl, req.url);
        base64Data = localMedia.base64Data;
        mimeType = localMedia.mimeType;
      } else if (imageUrl.startsWith('http')) {
        // External Remote URL
        const remoteMedia = await fetchRemoteMediaAsBase64(imageUrl);
        base64Data = remoteMedia.base64Data;
        mimeType = remoteMedia.mimeType;
      }
    }

    if (!base64Data) {
      return NextResponse.json({ error: 'Unable to read media payload' }, { status: 400 });
    }

    const cacheKey = buildCacheKey({
      base64Data,
      mimeType,
      style,
      maxTitleWords,
      sentenceCount,
    });
    const cached = await readCachedDetails(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const prompt = buildProjectDetailsPrompt({ style, maxTitleWords, sentenceCount });
    let text = '';
    let lastFailure: ProviderFailure | null = null;

    if (googleAiApiKey) {
      const result = await generateWithGoogleAI({
        apiKey: googleAiApiKey,
        prompt,
        mimeType,
        base64Data,
      });
      text = result.text;
      lastFailure = result.lastFailure;
    }

    if (!text && openRouterApiKey) {
      const result = await generateWithOpenRouter({
        apiKey: openRouterApiKey,
        prompt,
        mimeType,
        base64Data,
      });
      text = result.text;
      lastFailure = result.lastFailure;
    }

    if (!text) {
      const status = lastFailure?.status || 500;
      return NextResponse.json(
        {
          error: toFriendlyProviderError(lastFailure),
          model: lastFailure?.model,
          provider: lastFailure?.provider,
        },
        { status }
      );
    }

    // Clean markdown and parse JSON safely
    const jsonText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('[AI Generate] JSON parse error:', parseError);
      return NextResponse.json({ error: 'Invalid JSON response from AI' }, { status: 500 });
    }

    await writeCachedDetails(cacheKey, parsed);

    return NextResponse.json(parsed);
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'AI request timed out. Please try again.' },
        { status: 504 }
      );
    }
    console.error('AI Generate Error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
