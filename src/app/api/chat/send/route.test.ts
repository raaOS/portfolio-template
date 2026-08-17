import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkDataRateLimit: vi.fn(),
  addVisitorMessage: vi.fn(),
  getSession: vi.fn(),
  getAllMessages: vi.fn(),
  addAiReply: vi.fn(),
  setTypingStatus: vi.fn(),
  generateResponse: vi.fn(),
}));

vi.mock('@/lib/dataRateLimit', () => ({
  checkDataRateLimit: mocks.checkDataRateLimit,
}));

vi.mock('@/lib/chatStore', () => ({
  chatStore: {
    addVisitorMessage: mocks.addVisitorMessage,
    getSession: mocks.getSession,
    getAllMessages: mocks.getAllMessages,
    addAiReply: mocks.addAiReply,
    setTypingStatus: mocks.setTypingStatus,
  },
}));

vi.mock('@/lib/services/aiChatService', () => ({
  aiChatService: {
    generateResponse: mocks.generateResponse,
  },
}));

import { POST } from './route';

describe('POST /api/chat/send', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    delete (process.env as Record<string, string | undefined>).FEATURE_AI;
    mocks.checkDataRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
    mocks.addVisitorMessage.mockResolvedValue({
      id: 'msg-1',
      text: 'hello',
      sender: 'visitor',
      timestamp: 1000,
    });
    mocks.getSession.mockResolvedValue({
      visitorId: 'v1',
      aiMode: true,
      lastActive: 1000,
      lastAdminReplyTime: 0,
    });
    mocks.getAllMessages.mockResolvedValue([]);
    mocks.generateResponse.mockResolvedValue({ text: 'AI reply' });
  });

  it('returns 400 when required fields are missing', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Missing required fields');
  });

  it('returns 429 when rate limited', async () => {
    mocks.checkDataRateLimit.mockResolvedValue({ allowed: false, retryAfter: 60 });

    const response = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Hello', visitorId: 'v1' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe('Too many messages. Please wait before sending again.');
    expect(body.retryAfter).toBe(60);
    expect(response.headers.get('Retry-After')).toBe('60');
  });

  it('stores visitor message without external notification dependency', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Hello', visitorId: 'v1' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message.id).toBe('msg-1');
    expect(mocks.addVisitorMessage).toHaveBeenCalledWith('v1', 'Hello');
    expect(mocks.generateResponse).not.toHaveBeenCalled();
  });

  it('generates AI reply when feature flag and session allow it', async () => {
    (process.env as Record<string, string | undefined>).FEATURE_AI = 'true';

    const response = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Hello', visitorId: 'v1' }),
      }) as never
    );

    expect(response.status).toBe(200);
    expect(mocks.setTypingStatus).toHaveBeenCalledWith('v1', 10_000);
    expect(mocks.generateResponse).toHaveBeenCalled();
    expect(mocks.addAiReply).toHaveBeenCalledWith('v1', 'AI reply');
  });

  it('returns 500 on unexpected errors', async () => {
    mocks.addVisitorMessage.mockRejectedValue(new Error('DB failure'));

    const response = await POST(
      new Request('http://localhost/api/chat/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'Hello', visitorId: 'v1' }),
      }) as never
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to send message');
  });
});
