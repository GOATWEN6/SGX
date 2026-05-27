import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { startConversationSession } from '@/lib/conversation';
import { handleError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const session = startConversationSession({
      userId,
      mode: body.mode === 'text' ? 'text' : 'web_voice_call',
      conversationType: body.conversationType === 'memory_topic' ? 'memory_topic' : 'ai_chat',
    });

    return NextResponse.json({ success: true, data: { session } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
