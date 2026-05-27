import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { detectSearchIntent, runSearchTool } from '@/lib/tools';
import { handleError } from '@/lib/errors';
import { getConversationSessionById } from '@/lib/db';
import { SearchToolIntent } from '@/types';

const allowedIntents: SearchToolIntent[] = ['weather', 'holiday', 'news_summary', 'encyclopedia', 'health_low_risk'];

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const body = await request.json();
    const query = String(body.query || '').trim();
    const sessionId = String(body.sessionId || '');
    const intent = body.intent || detectSearchIntent(query);

    if (!query || !sessionId || !intent) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '缺少查询内容、会话或联网意图' } },
        { status: 400 }
      );
    }
    if (!allowedIntents.includes(intent)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '联网意图不在允许范围内' } },
        { status: 400 }
      );
    }

    const session = getConversationSessionById(sessionId);
    if (!session || session.userId !== userId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } },
        { status: 404 }
      );
    }

    const result = await runSearchTool({
      userId,
      sessionId,
      intent: intent as SearchToolIntent,
      query,
      locationHint: body.locationHint,
    });

    return NextResponse.json({ success: true, data: { result } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
