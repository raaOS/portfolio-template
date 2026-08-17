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
  return new Request('http://localhost/api/ai/generate-notif-message', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

function googleAiNotifResponse(message: string) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ message }) }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

describe('POST /api/ai/generate-notif-message', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getGoogleAiApiKeyMock.mockReturnValue('test-key');
    guardAdminAiRequestMock.mockResolvedValue(null);
  });

  it('generates notification message from Google AI', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(googleAiNotifResponse('Halo, ada project mobile app nih'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Halo, ada project mobile app nih');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-flash-latest');
  });

  it('returns 400 when senderName is missing', async () => {
    const response = await POST(request({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Sender name is required');
  });

  it('returns 500 when API key is not configured', async () => {
    getGoogleAiApiKeyMock.mockReturnValue('');

    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('API Key not configured');
  });

  it('returns 500 when guard rejects', async () => {
    guardAdminAiRequestMock.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when Google AI API responds with HTTP error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('Service unavailable', { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Google AI API Error');
  });

  it('returns 500 when AI returns empty candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ candidates: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('No response');
  });

  it('returns 500 when AI returns invalid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'bukan json' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('not valid JSON');
  });

  it('cleans markdown code fences from AI response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '```json\n{"message": "Halo bos!"}\n```' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Halo bos!');
  });
});
