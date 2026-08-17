import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGoogleAiApiKeyMock, getOpenRouterApiKeyMock, guardAdminAiRequestMock } = vi.hoisted(
  () => ({
    getGoogleAiApiKeyMock: vi.fn(),
    getOpenRouterApiKeyMock: vi.fn(),
    guardAdminAiRequestMock: vi.fn(),
  })
);

vi.mock('../_shared', () => ({
  getGoogleAiApiKey: getGoogleAiApiKeyMock,
  getOpenRouterApiKey: getOpenRouterApiKeyMock,
  guardAdminAiRequest: guardAdminAiRequestMock,
}));

vi.mock('@/lib/cloudflareD1', () => ({
  deleteD1Value: vi.fn(),
  getD1Value: vi.fn(),
  isD1Configured: vi.fn(() => false),
  setD1Value: vi.fn(),
}));

import { POST } from './route';

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/ai/generate-details', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

function googleAiResponse(payload: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(payload) }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

function openRouterResponse(payload: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: JSON.stringify(payload),
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

describe('POST /api/ai/generate-details', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getGoogleAiApiKeyMock.mockReturnValue('test-key');
    getOpenRouterApiKeyMock.mockReturnValue('');
    guardAdminAiRequestMock.mockResolvedValue(null);
  });

  it('tries the next Google AI model when the first model is quota-limited', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('quota exceeded for model', {
          status: 429,
          headers: { 'content-type': 'text/plain' },
        })
      )
      .mockResolvedValueOnce(
        googleAiResponse({
          title: 'Poster Eksplorasi',
          description: 'Eksplorasi visual yang rapi.',
          client: 'Personal Exploration',
          tags: 'poster, visual',
          software: ['photoshop'],
          type: 'visual_art',
          role: 'Visual Development',
          team: 'Independent Project',
          timeline: 'Short Sprint',
          narrative: { concept: 'Eksperimen warna' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        imageBase64: `data:image/png;base64,${Buffer.from('fallback-model').toString('base64')}`,
        style: 'minimalis',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe('Poster Eksplorasi');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-flash-latest');
    expect(String(fetchMock.mock.calls[1][0])).toContain('gemini-2.0-flash');
  });

  it('falls back to OpenRouter vision models when all Google AI models are quota-limited', async () => {
    getOpenRouterApiKeyMock.mockReturnValue('openrouter-key');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }))
      .mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }))
      .mockResolvedValueOnce(new Response('quota exceeded', { status: 429 }))
      .mockResolvedValueOnce(
        openRouterResponse({
          title: 'OpenRouter Fallback',
          description: 'Detail dibuat lewat vision fallback.',
          client: 'Personal Exploration',
          tags: 'vision, fallback',
          software: ['figma'],
          type: 'visual_art',
          role: 'Visual Development',
          team: 'Independent Project',
          timeline: 'Short Sprint',
          narrative: { concept: 'Fallback test' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        imageBase64: `data:image/png;base64,${Buffer.from('openrouter-fallback').toString('base64')}`,
        style: 'minimalis',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe('OpenRouter Fallback');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(String(fetchMock.mock.calls[3][0])).toBe(
      'https://openrouter.ai/api/v1/chat/completions'
    );
    expect(JSON.parse(fetchMock.mock.calls[3][1]?.body as string).model).toBe('openai/gpt-4o-mini');
  });

  it('can use OpenRouter when Google AI API key is not configured', async () => {
    getGoogleAiApiKeyMock.mockReturnValue('');
    getOpenRouterApiKeyMock.mockReturnValue('openrouter-key');

    const fetchMock = vi.fn().mockResolvedValueOnce(
      openRouterResponse({
        title: 'Only OpenRouter',
        description: 'Detail dibuat tanpa Google AI.',
        client: 'Personal Exploration',
        tags: 'openrouter, vision',
        software: ['photoshop'],
        type: 'visual_art',
        role: 'Visual Development',
        team: 'Independent Project',
        timeline: 'Short Sprint',
        narrative: { concept: 'OpenRouter only' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        imageBase64: `data:image/jpeg;base64,${Buffer.from('openrouter-only').toString('base64')}`,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.title).toBe('Only OpenRouter');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://openrouter.ai/api/v1/chat/completions'
    );
  });

  it('keeps trying OpenRouter free vision fallback after paid models return insufficient credits', async () => {
    getGoogleAiApiKeyMock.mockReturnValue('');
    getOpenRouterApiKeyMock.mockReturnValue('openrouter-key');

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('Insufficient credits', { status: 402 }))
      .mockResolvedValueOnce(new Response('Insufficient credits', { status: 402 }))
      .mockResolvedValueOnce(new Response('Insufficient credits', { status: 402 }))
      .mockResolvedValueOnce(
        openRouterResponse({
          title: 'Free Vision Fallback',
          description: 'Detail dibuat lewat model vision gratis.',
          client: 'Personal Exploration',
          tags: 'free, vision',
          software: ['figma'],
          type: 'visual_art',
          role: 'Visual Development',
          team: 'Independent Project',
          timeline: 'Short Sprint',
          narrative: { concept: 'Free fallback' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({
        imageBase64: `data:image/png;base64,${Buffer.from('openrouter-free-fallback').toString('base64')}`,
      })
    );
    const body = await response.json();
    const lastPayload = JSON.parse(fetchMock.mock.calls[3][1]?.body as string);

    expect(response.status).toBe(200);
    expect(body.title).toBe('Free Vision Fallback');
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(lastPayload.model).toBe('nvidia/nemotron-nano-12b-v2-vl:free');
  });

  it('caches identical media and prompt options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      googleAiResponse({
        title: 'Cached Project',
        description: 'Hasil dari cache.',
        client: 'Personal Exploration',
        tags: 'cache, visual',
        software: ['figma'],
        type: 'visual_art',
        role: 'Visual Development',
        team: 'Independent Project',
        timeline: 'Short Sprint',
        narrative: { concept: 'Cache test' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      imageBase64: `data:image/jpeg;base64,${Buffer.from('cache-hit').toString('base64')}`,
      style: 'profesional',
      maxTitleWords: 4,
      sentenceCount: 2,
    };

    const firstResponse = await POST(request(payload));
    const secondResponse = await POST(request(payload));
    const firstBody = await firstResponse.json();
    const secondBody = await secondResponse.json();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstBody.title).toBe('Cached Project');
    expect(secondBody).toMatchObject({ title: 'Cached Project', cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
