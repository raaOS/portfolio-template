import { NextResponse } from 'next/server';
import { chatStore } from '@/lib/chatStore';
import { aiChatService } from '@/lib/services/aiChatService';
import { checkDataRateLimit } from '@/lib/dataRateLimit';
import { getClientIdentifier } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

const CHAT_MAX_MESSAGES = 10;
const CHAT_WINDOW_MS = 60 * 1000;
const CHAT_BLOCK_MS = 5 * 60 * 1000;

interface ChatRequestBody {
  message: string;
  visitorId: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody;
    const { message, visitorId } = body;

    if (!message || !visitorId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const clientId = getClientIdentifier(request);
    const rateCheck = await checkDataRateLimit(
      `chat_${clientId}`,
      CHAT_MAX_MESSAGES,
      CHAT_WINDOW_MS,
      CHAT_BLOCK_MS
    );
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Too many messages. Please wait before sending again.',
          retryAfter: rateCheck.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    const chatMsg = await chatStore.addVisitorMessage(visitorId, message);
    const session = await chatStore.getSession(visitorId);
    const aiEnabled = process.env.FEATURE_AI === 'true';
    const isAiMode = aiEnabled && session?.aiMode !== false;

    if (isAiMode) {
      try {
        await chatStore.setTypingStatus(visitorId, 10_000);
        const sessionWithMessages = await chatStore.getAllMessages(visitorId);
        const aiResponse = await aiChatService.generateResponse(sessionWithMessages);
        await chatStore.addAiReply(visitorId, aiResponse.text);
      } catch (aiErr) {
        console.error('[Web Chat AI Error]:', aiErr);
      }
    }

    return NextResponse.json({ success: true, message: chatMsg });
  } catch (error: unknown) {
    console.error('[Web Chat Send Error]:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
