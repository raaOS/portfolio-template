import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGoogleAiApiKeyMock, guardAdminAiRequestMock } = vi.hoisted(() => ({
  getGoogleAiApiKeyMock: vi.fn(),
  guardAdminAiRequestMock: vi.fn(),
}));

vi.mock('../_shared', () => ({
  getGoogleAiApiKey: getGoogleAiApiKeyMock,
  guardAdminAiRequest: guardAdminAiRequestMock,
}));

import { POST } from './route';

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/ai/suggest-skills', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

function googleAiSkillsResponse(details: string[]) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ details }) }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

describe('POST /api/ai/suggest-skills', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getGoogleAiApiKeyMock.mockReturnValue('test-key');
    guardAdminAiRequestMock.mockResolvedValue(null);
  });

  it('returns 4 skill details from Google AI', async () => {
    const details = [
      'Masking & Compositing',
      'Color Grading',
      'Photo Retouching',
      'Batch Processing',
    ];
    const fetchMock = vi.fn().mockResolvedValue(googleAiSkillsResponse(details));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ skillName: 'Photoshop' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.details).toEqual(details);
    expect(body.details).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-flash-latest');
  });

  it('returns 400 when skillName is missing', async () => {
    const response = await POST(request({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Skill name is required');
  });

  it('returns 500 when API key is not configured', async () => {
    getGoogleAiApiKeyMock.mockReturnValue('');

    const response = await POST(request({ skillName: 'Figma' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('API Key not configured');
  });

  it('returns 500 when guard rejects', async () => {
    guardAdminAiRequestMock.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const response = await POST(request({ skillName: 'Figma' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when Google AI API responds with HTTP error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('Service unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ skillName: 'Figma' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Google AI API Error');
  });

  it('returns 500 when AI returns no candidates text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ skillName: 'Figma' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('No response');
  });

  it('returns 500 on invalid JSON from AI', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'not json' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ skillName: 'Figma' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('not valid JSON');
  });

  it('cleans markdown code fences from AI response', async () => {
    const details = ['Auto Layout', 'Components', 'Prototyping', 'Design Tokens'];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '```json\n' + JSON.stringify({ details }) + '\n```' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ skillName: 'Figma' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.details).toEqual(details);
  });

  it('handles non-Error thrown by returning string(error) as error message', async () => {
    const fetchMock = vi.fn().mockRejectedValue('Unexpected network failure');
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ skillName: 'Figma' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Unexpected network failure');
  });
});
