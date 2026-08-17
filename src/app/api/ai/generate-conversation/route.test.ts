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
  return new Request('http://localhost/api/ai/generate-conversation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

function googleAiConversationResponse(conversation: unknown[]) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify(conversation) }],
          },
        },
      ],
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

describe('POST /api/ai/generate-conversation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getGoogleAiApiKeyMock.mockReturnValue('test-key');
    guardAdminAiRequestMock.mockResolvedValue(null);
  });

  it('generates conversation array from Google AI response', async () => {
    const conversation = [
      { id: 1, text: 'Halo, makasih infonya!', isMe: true, time: '10:01', status: 'read' },
      { id: 2, text: 'Sama2 mas, kpn bisa mulai?', isMe: false, time: '10:03', status: 'read' },
      { id: 3, text: 'Besok sdh bisa', isMe: true, time: '10:04', status: 'read' },
    ];

    const fetchMock = vi.fn().mockResolvedValue(googleAiConversationResponse(conversation));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      request({ senderName: 'Budi', notifMessage: 'Halo Mas, ada project desain nih' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(conversation);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-flash-latest');
  });

  it('returns 400 when senderName is missing', async () => {
    const response = await POST(request({ notifMessage: 'Halo ada project' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Sender name and notification message are required');
  });

  it('returns 400 when notifMessage is missing', async () => {
    const response = await POST(request({ senderName: 'Budi' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Sender name and notification message are required');
  });

  it('returns 500 when API key is not configured', async () => {
    getGoogleAiApiKeyMock.mockReturnValue('');

    const response = await POST(request({ senderName: 'Budi', notifMessage: 'Halo ada project' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('API Key not configured');
  });

  it('returns 500 when guard rejects', async () => {
    guardAdminAiRequestMock.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const response = await POST(request({ senderName: 'Budi', notifMessage: 'Halo ada project' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when Google AI API responds with HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Internal error', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi', notifMessage: 'Halo ada project' }));
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

    const response = await POST(request({ senderName: 'Budi', notifMessage: 'Halo ada project' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('No response');
  });

  it('returns 500 when AI returns invalid JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'not valid json {' }] } }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi', notifMessage: 'Halo ada project' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Invalid JSON response from AI');
  });

  it('handles AbortError timeout with 504', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi', notifMessage: 'Halo ada project' }));
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body.error).toBe('AI request timed out. Please try again.');
  });

  it('cleans markdown code fences from AI response', async () => {
    const conversation = [{ id: 1, text: 'Halo!', isMe: true, time: '10:01', status: 'read' }];

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '```json\n' + JSON.stringify(conversation) + '\n```' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ senderName: 'Budi', notifMessage: 'Halo ada project' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(conversation);
  });
});
