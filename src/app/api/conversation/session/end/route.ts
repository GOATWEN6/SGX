import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { endConversationSession } from '@/lib/conversation';
import { handleError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const body = await request.json();
    const sessionId = String(body.sessionId || '');
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '缺少会话 ID' } },
        { status: 400 }
      );
    }

    const summary = endConversationSession({ userId, sessionId });
    return NextResponse.json({ success: true, data: { summary } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
