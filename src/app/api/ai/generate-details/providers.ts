const API_TIMEOUT = 30000;
const GOOGLE_AI_MODEL_CANDIDATES = [
  'gemini-flash-latest',
  'gemini-2.0-flash',
  'gemini-2.5-flash-lite',
];
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_IMAGE_MODEL_CANDIDATES = [
  'openai/gpt-4o-mini',
  'openai/gpt-4.1-nano',
  'google/gemini-2.5-flash-lite',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'moonshotai/kimi-k2.6:free',
  'google/gemma-4-26b-a4b-it:free',
] as const;
const OPENROUTER_VIDEO_MODEL_CANDIDATES = [
  'google/gemini-2.5-flash-lite',
  'google/gemini-2.5-flash',
  'nvidia/nemotron-nano-12b-v2-vl:free',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
  'google/gemma-4-26b-a4b-it:free',
] as const;

export interface ProviderFailure {
  provider: 'google' | 'openrouter';
  status: number;
  body: string;
  model: string;
}

interface ProviderGenerationInput {
  apiKey: string;
  prompt: string;
  mimeType: string;
  base64Data: string;
}

interface ProviderGenerationResult {
  text: string;
  lastFailure: ProviderFailure | null;
}

function isRetryableGoogleAiFailure(status: number, body: string) {
  return (
    status === 429 ||
    status === 503 ||
    status === 404 ||
    /quota|rate.?limit|too many requests|not found|unavailable/i.test(body)
  );
}

function toFriendlyGoogleAiError(status: number, body: string) {
  if (/quota|rate.?limit|too many requests/i.test(body) || status === 429) {
    return 'Google AI quota sedang habis untuk semua model yang dicoba. Isi manual dulu atau coba lagi nanti.';
  }

  if (/not found/i.test(body) || status === 404) {
    return 'Model Google AI yang tersedia di API key ini tidak bisa dipakai untuk generate detail.';
  }

  return `Google AI API Error: ${body}`;
}

function isRetryableOpenRouterFailure(status: number, body: string) {
  return (
    status === 400 ||
    status === 402 ||
    status === 404 ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /quota|rate.?limit|too many requests|not found|unavailable|insufficient|credit|model/i.test(
      body
    )
  );
}

function toFriendlyOpenRouterError(status: number, body: string) {
  if (status === 401 || /invalid.*key|unauthorized/i.test(body)) {
    return 'OpenRouter API key tidak valid. Cek AI_PROVIDER=openrouter dan AI_API_KEY di .env.local.';
  }

  if (status === 402 || /credit|balance|payment|insufficient/i.test(body)) {
    return 'OpenRouter belum punya credit/akses cukup untuk model vision yang dicoba.';
  }

  if (status === 429 || /quota|rate.?limit|too many requests/i.test(body)) {
    return 'OpenRouter sedang kena rate limit. Coba lagi nanti atau pakai model lain.';
  }

  if (status === 404 || /not found|model/i.test(body)) {
    return 'Model vision OpenRouter yang dicoba tidak tersedia untuk key ini.';
  }

  return `OpenRouter API Error: ${body}`;
}

export function toFriendlyProviderError(failure: ProviderFailure | null) {
  if (!failure) return 'No response from AI';

  if (failure.provider === 'openrouter') {
    return toFriendlyOpenRouterError(failure.status, failure.body);
  }

  return toFriendlyGoogleAiError(failure.status, failure.body);
}

function getOpenRouterModelCandidates(mimeType: string) {
  if (mimeType.startsWith('video/')) {
    return OPENROUTER_VIDEO_MODEL_CANDIDATES;
  }

  return OPENROUTER_IMAGE_MODEL_CANDIDATES;
}

function buildOpenRouterMediaPart(mimeType: string, base64Data: string) {
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  if (mimeType.startsWith('video/')) {
    return {
      type: 'video_url',
      video_url: {
        url: dataUrl,
      },
    };
  }

  return {
    type: 'image_url',
    image_url: {
      url: dataUrl,
    },
  };
}

function extractOpenRouterText(data: Record<string, unknown>) {
  const choices = data.choices;
  if (!Array.isArray(choices)) return '';

  const firstChoice = choices[0] as { message?: { content?: unknown } } | undefined;
  const content = firstChoice?.message?.content;

  if (typeof content === 'string') return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (
          part &&
          typeof part === 'object' &&
          'text' in part &&
          typeof (part as { text?: unknown }).text === 'string'
        ) {
          return (part as { text: string }).text;
        }
        return '';
      })
      .join('');
  }

  return '';
}

export async function generateWithGoogleAI({
  apiKey,
  prompt,
  mimeType,
  base64Data,
}: ProviderGenerationInput): Promise<ProviderGenerationResult> {
  let lastFailure: ProviderFailure | null = null;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
    },
  };

  for (const model of GOOGLE_AI_MODEL_CANDIDATES) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text();
      lastFailure = { provider: 'google', status: response.status, body, model };

      if (isRetryableGoogleAiFailure(response.status, body)) {
        console.warn(`[AI Generate] Google AI model ${model} unavailable, trying fallback.`);
        continue;
      }

      break;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (text) {
      console.log(`[AI Generate] Project details generated via ${model}`);
      return { text, lastFailure };
    }

    lastFailure = { provider: 'google', status: 500, body: 'No response from AI', model };
  }

  return { text: '', lastFailure };
}

export async function generateWithOpenRouter({
  apiKey,
  prompt,
  mimeType,
  base64Data,
}: ProviderGenerationInput): Promise<ProviderGenerationResult> {
  let lastFailure: ProviderFailure | null = null;
  const mediaPart = buildOpenRouterMediaPart(mimeType, base64Data);

  for (const model of getOpenRouterModelCandidates(mimeType)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

    let response: Response;
    try {
      response = await fetch(OPENROUTER_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
          'X-Title': 'Portfolio Shared Admin',
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: prompt }, mediaPart],
            },
          ],
          temperature: 0.35,
          max_tokens: 1400,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const body = await response.text();
      lastFailure = { provider: 'openrouter', status: response.status, body, model };

      if (isRetryableOpenRouterFailure(response.status, body)) {
        console.warn(`[AI Generate] OpenRouter model ${model} unavailable, trying fallback.`);
        continue;
      }

      break;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const text = extractOpenRouterText(data);
    if (text) {
      console.log(`[AI Generate] Project details generated via OpenRouter ${model}`);
      return { text, lastFailure };
    }

    lastFailure = {
      provider: 'openrouter',
      status: 500,
      body: 'No response from AI',
      model,
    };
  }

  return { text: '', lastFailure };
}
