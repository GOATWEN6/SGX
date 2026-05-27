import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { processConversationMessage } from '@/lib/conversation';
import { handleError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const body = await request.json();
    const sessionId = String(body.sessionId || '');
    const message = String(body.message || '').trim();

    if (!sessionId || !message) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '缺少会话或消息内容' } },
        { status: 400 }
      );
    }

    const result = await processConversationMessage({ userId, sessionId, message });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
