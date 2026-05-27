import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getConversationSummary } from '@/lib/conversation';
import { getConversationSessionById } from '@/lib/db';
import { handleError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireAuth(request);
    const session = getConversationSessionById(params.id);
    if (!session || session.userId !== userId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '会话不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { summary: getConversationSummary(params.id) } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
