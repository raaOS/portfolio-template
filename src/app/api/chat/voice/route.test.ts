import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enforceRequestRateLimit: vi.fn(),
}));

vi.mock('@/lib/security/request', () => ({
  enforceRequestRateLimit: mocks.enforceRequestRateLimit,
}));

import { POST } from './route';
import { NextRequest } from 'next/server';

function mockGroqResponse(ok: boolean, body: Record<string, unknown>) {
  return {
    ok,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('POST /api/chat/voice', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('FEATURE_AI', 'true');
    vi.stubEnv('AI_PROVIDER', 'groq');
    vi.stubEnv('AI_API_KEY', 'test-groq-key');
    mocks.enforceRequestRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
  });

  it('returns 500 when AI voice provider is missing', async () => {
    vi.stubEnv('AI_PROVIDER', 'groq');
    vi.stubEnv('AI_API_KEY', '');

    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('AI voice provider is not configured');
  });

  it('returns 429 when rate limited', async () => {
    mocks.enforceRequestRateLimit.mockResolvedValue({ allowed: false, retryAfter: 120 });

    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('Too many voice requests. Please try again later.');
    expect(body.retryAfter).toBe(120);
  });

  it('returns 400 when no audio file is provided', async () => {
    const formData = new FormData();
    formData.append('not-file', 'hello');

    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('No audio file provided');
  });

  it('returns 413 when file exceeds maximum size', async () => {
    const file = new File([new Uint8Array(11 * 1024 * 1024)], 'large.webm', { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', file);

    // Mock formData to avoid jsdom parsing issues with large blobs
    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
      body: formData,
    });
    vi.spyOn(request, 'formData').mockResolvedValue(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(413);
    expect(body.error).toBe('Audio file is too large');
  });

  it('returns 400 for unsupported audio types', async () => {
    const file = new File(['small-audio'], 'audio.flac', { type: 'audio/flac' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
      body: formData,
    });
    vi.spyOn(request, 'formData').mockResolvedValue(formData);

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Unsupported audio file type');
  });

  it('returns transcription text on success', async () => {
    const file = new File(['small-audio'], 'audio.webm', { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
      body: formData,
    });
    vi.spyOn(request, 'formData').mockResolvedValue(formData);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockGroqResponse(true, { text: 'Halo dunia' }))
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.text).toBe('Halo dunia');
  });

  it('returns 500 when Groq API responds with error', async () => {
    const file = new File(['small-audio'], 'audio.webm', { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', file);

    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
      body: formData,
    });
    vi.spyOn(request, 'formData').mockResolvedValue(formData);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve('Internal Groq error'),
      })
    );

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toContain('Voice transcription failed');
  });

  it('returns 500 on unexpected errors', async () => {
    mocks.enforceRequestRateLimit.mockRejectedValue(new Error('Something broke'));

    const request = new NextRequest('http://localhost/api/chat/voice', {
      method: 'POST',
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Internal Server Error');
  });
});
