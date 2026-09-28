import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { validateAdminRequestMock } = vi.hoisted(() => ({
  validateAdminRequestMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  validateAdminRequest: validateAdminRequestMock,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { POST } from './route';

function buildRequest(body: Record<string, unknown> = {}): NextRequest {
  return new NextRequest('http://localhost/api/revalidate', {
    method: 'POST',
    headers: body._headers as Record<string, string> | undefined,
    body: body._body ? (body._body as string) : JSON.stringify(body),
  });
}

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete (process.env as Partial<NodeJS.ProcessEnv>).REVALIDATION_TOKEN;
  });

  it('returns 500 when REVALIDATION_TOKEN is not configured', async () => {
    const response = await POST(buildRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe('Secret not configured');
  });

  it('returns 401 when no signature header is present', async () => {
    process.env.REVALIDATION_TOKEN = 'test-secret';
    const request = new NextRequest('http://localhost/api/revalidate', {
      method: 'POST',
      body: JSON.stringify({ ref: 'refs/heads/main' }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('No signature');
  });

  it('returns 401 with invalid signature', async () => {
    process.env.REVALIDATION_TOKEN = 'test-secret';
    const request = new NextRequest('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'sha256=invalid' },
      body: JSON.stringify({ ref: 'refs/heads/main' }),
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toBe('Invalid signature');
  });

  it('revalidates paths on valid webhook signature', async () => {
    const secret = 'test-secret';
    process.env.REVALIDATION_TOKEN = secret;
    const payload = JSON.stringify({ ref: 'refs/heads/main' });
    const crypto = await import('crypto');
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(Buffer.from(payload)).digest('hex');

    const request = new NextRequest('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-hub-signature-256': digest },
      body: payload,
    });

    const response = await POST(request as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.revalidated).toBe(true);
    expect(typeof body.now).toBe('number');
  });

  it('revalidates every preview demo route', async () => {
    const { revalidatePath } = await import('next/cache');
    vi.mocked(revalidatePath).mockClear();

    const secret = 'test-secret';
    process.env.REVALIDATION_TOKEN = secret;
    const payload = JSON.stringify({ ref: 'refs/heads/main' });
    const crypto = await import('crypto');
    const digest =
      'sha256=' + crypto.createHmac('sha256', secret).update(Buffer.from(payload)).digest('hex');

    const request = new NextRequest('http://localhost/api/revalidate', {
      method: 'POST',
      headers: { 'x-hub-signature-256': digest },
      body: payload,
    });

    const response = await POST(request as never);

    expect(response.status).toBe(200);
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/preview/os-desktop');
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/preview/infinite-canvas');
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith('/preview/spatial-gallery');
  });
});
