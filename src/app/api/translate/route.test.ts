import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enforceRequestRateLimitMock } = vi.hoisted(() => ({
  enforceRequestRateLimitMock: vi.fn(),
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: enforceRequestRateLimitMock,
}));

import { POST } from './route';

function mockGroqResponse(body: Record<string, unknown>, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe('POST /api/translate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('FEATURE_AI', 'true');
    vi.stubEnv('AI_PROVIDER', 'groq');
    vi.stubEnv('AI_API_KEY', 'test-groq-key');
  });

  it('blocks rate-limited translation requests before invoking Groq', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 120 });

    const response = await POST(
      new Request('http://localhost/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Halo', targetLanguage: 'en' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('Too many requests. Please try again later.');
  });

  it('returns a translated string for valid single-text payloads', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    vi.stubGlobal(
      'fetch',
      mockGroqResponse({
        choices: [{ message: { content: '{"translation":"Hello world"}' } }],
      })
    );

    const response = await POST(
      new Request('http://localhost/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Halo dunia', targetLanguage: 'en' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ translation: 'Hello world' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('accepts fenced JSON and preserves requested keys for multi-field payloads', async () => {
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });
    vi.stubGlobal(
      'fetch',
      mockGroqResponse({
        choices: [{ message: { content: '```json\n{"title":"Hello project"}\n```' } }],
      })
    );

    const response = await POST(
      new Request('http://localhost/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fields: {
            title: 'Halo project',
            role: 'Desainer visual',
          },
        }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      translations: {
        title: 'Hello project',
        role: 'Desainer visual',
      },
    });
  });

  it('returns 500 when AI translation provider is missing', async () => {
    vi.stubEnv('AI_PROVIDER', 'groq');
    vi.stubEnv('AI_API_KEY', '');
    enforceRequestRateLimitMock.mockResolvedValue({ allowed: true, retryAfter: 0 });

    const response = await POST(
      new Request('http://localhost/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: 'Halo dunia' }),
      }) as never
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe('AI translation provider is not configured');
  });
});
