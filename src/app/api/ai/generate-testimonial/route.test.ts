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

function request(body?: Record<string, unknown>) {
  return new Request('http://localhost/api/ai/generate-testimonial', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : '{}',
  }) as never;
}

function googleAiTestimonialResponse(payload: Record<string, unknown>) {
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

describe('POST /api/ai/generate-testimonial', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getGoogleAiApiKeyMock.mockReturnValue('test-key');
    guardAdminAiRequestMock.mockResolvedValue(null);
  });

  it('generates testimonial with name, notificationText, and messages', async () => {
    const testimonial = {
      name: 'Agus Setiawan',
      notificationText: 'Makasih mas, desainnya keren banget!',
      messages: [
        { text: 'Halo mas, barusan kulihat hasilnya. Keren!', isMe: false, time: '09:00' },
        { text: 'Syukurlah mas, ada yang perlu revisi?', isMe: true, time: '09:05' },
        { text: 'Aman semua mas, makasih ya!', isMe: false, time: '09:10' },
      ],
    };

    const fetchMock = vi.fn().mockResolvedValue(googleAiTestimonialResponse(testimonial));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ topic: 'Banner Ads', messageCount: 3 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe('Agus Setiawan');
    expect(body.notificationText).toBe('Makasih mas, desainnya keren banget!');
    expect(body.messages).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-flash-latest');
  });

  it('parses request without topic and messageCount using defaults', async () => {
    const testimonial = {
      name: 'Budi',
      notificationText: 'Desainnya oke',
      messages: [{ text: 'Makasih', isMe: false, time: '10:00' }],
    };

    const fetchMock = vi.fn().mockResolvedValue(googleAiTestimonialResponse(testimonial));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe('Budi');
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(sentBody.contents[0].parts[0].text).toContain('Desain Ads');
    expect(sentBody.contents[0].parts[0].text).toContain('3');
  });

  it('returns 500 when API key is not configured', async () => {
    getGoogleAiApiKeyMock.mockReturnValue('');

    const response = await POST(request({ topic: 'Logo Design' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('API Key not configured');
  });

  it('returns 500 when guard rejects', async () => {
    guardAdminAiRequestMock.mockResolvedValue(
      Response.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const response = await POST(request({ topic: 'Logo Design' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 500 when Google AI API responds with HTTP error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ topic: 'Logo Design' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Google AI API Error');
  });

  it('returns 500 when AI returns empty candidates', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ topic: 'Banner' }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('No response');
  });

  it('cleans markdown code fences from AI response', async () => {
    const testimonial = {
      name: 'Deni',
      notificationText: 'Mantap!',
      messages: [{ text: 'Keren mas!', isMe: false, time: '11:00' }],
    };

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [{ text: '```json\n' + JSON.stringify(testimonial) + '\n```' }],
              },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(request({ topic: 'UI Design' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.name).toBe('Deni');
    expect(body.notificationText).toBe('Mantap!');
  });
});
