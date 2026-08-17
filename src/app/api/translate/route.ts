import { NextRequest, NextResponse } from 'next/server';
import { enforceRequestRateLimit } from '@/lib/security/request';
import { z } from 'zod';

const MAX_TRANSLATE_REQUESTS = 20;
const TRANSLATE_WINDOW_MS = 60 * 1000;
const TRANSLATE_BLOCK_MS = 5 * 60 * 1000;

const translatePayloadSchema = z.object({
  text: z.string().max(5000).optional(),
  targetLanguage: z.string().max(50).optional(),
  fields: z.record(z.string(), z.string().max(5000)).optional(),
});

function parseJsonObject(responseText: string) {
  const trimmed = responseText.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('No JSON object found in translation response');
    }
    return JSON.parse(withoutFence.slice(start, end + 1));
  }
}

function toRequestedStringMap(parsed: unknown, requestedFields: Record<string, string>) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Translation response is not a JSON object');
  }

  const parsedRecord = parsed as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(requestedFields).map(([key, original]) => {
      const translated = parsedRecord[key];
      return [key, typeof translated === 'string' && translated.trim() ? translated : original];
    })
  );
}

export async function POST(req: NextRequest) {
  try {
    // SECURITY FIX: Validate FEATURE_AI is enabled globally.
    if (process.env.FEATURE_AI !== 'true') {
      return NextResponse.json({ error: 'AI features are not enabled' }, { status: 403 });
    }

    const rateLimit = await enforceRequestRateLimit(
      req,
      'translate_post',
      MAX_TRANSLATE_REQUESTS,
      TRANSLATE_WINDOW_MS,
      TRANSLATE_BLOCK_MS
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', retryAfter: rateLimit.retryAfter },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } }
      );
    }

    const payload = translatePayloadSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json({ error: 'Invalid translation payload' }, { status: 400 });
    }

    const { text, targetLanguage, fields } = payload.data;
    const outputLanguage = targetLanguage?.trim() || 'English';

    const isMultiField = !!fields && typeof fields === 'object';
    const requestedFields = isMultiField
      ? Object.fromEntries(
          Object.entries(fields)
            .map(([key, value]) => [key, value.trim()] as const)
            .filter(([, value]) => value.length > 0)
        )
      : {};

    if (!text && !isMultiField) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (isMultiField && Object.keys(requestedFields).length === 0) {
      return NextResponse.json({ error: 'No translatable fields provided' }, { status: 400 });
    }

    const provider = (process.env.AI_PROVIDER || '').toLowerCase();
    const apiKey = (provider === 'groq' ? process.env.AI_API_KEY || '' : '').trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI translation provider is not configured' },
        { status: 500 }
      );
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (isMultiField) {
      const fieldEntries = Object.entries(requestedFields)
        .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
        .join(',\n  ');

      systemPrompt = `You are an expert Indonesian-to-${outputLanguage} translator specializing in creative design portfolios.
Your goal is to translate design-related content while maintaining a sophisticated, professional, and modern tone.
Preserve all formatting, case consistency, and technical terms (e.g., brand names, software).
You MUST return ONLY a valid JSON object.`;

      userPrompt = `Translate the following JSON object values from Indonesian to ${outputLanguage}.
Return ONLY the JSON object with the same keys.

Input:
{
  ${fieldEntries}
}`;
    } else {
      systemPrompt = `You are a professional translator for a design portfolio.
Translate the text naturally, ensuring it sounds professional and fits a high-end creative context.
You MUST return ONLY a valid JSON object in the exact format: {"translation": "<translated text here>"}`;

      userPrompt = `Translate the following text from Indonesian to ${outputLanguage}:

${text}`;
    }

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(30_000), // 30s hard timeout to prevent serverless hang
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq API Error:', data);
      return NextResponse.json({ error: 'Translation API returned an error' }, { status: 502 });
    }

    const responseText = data.choices?.[0]?.message?.content || '';

    let parsed: unknown;
    try {
      parsed = parseJsonObject(responseText);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    if (isMultiField) {
      return NextResponse.json({
        translations: toRequestedStringMap(parsed, requestedFields),
      });
    } else {
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json(
          { error: 'Translation missing from AI response' },
          { status: 500 }
        );
      }
      const translation = (parsed as Record<string, unknown>).translation;
      if (!translation) {
        return NextResponse.json(
          { error: 'Translation missing from AI response' },
          { status: 500 }
        );
      }
      return NextResponse.json({ translation: String(translation) });
    }
  } catch (error: unknown) {
    console.error('Translation handler error:', error);
    return NextResponse.json({ error: 'Translation failed. Please try again.' }, { status: 500 });
  }
}
