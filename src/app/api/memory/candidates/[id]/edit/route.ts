import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { editMemoryCandidate } from '@/lib/memory';
import { handleError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireAuth(request);
    const body = await request.json();
    const content = String(body.content || '').trim();
    if (!content) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '候选记忆内容不能为空' } },
        { status: 400 }
      );
    }

    const candidate = editMemoryCandidate(params.id, userId, content);
    if (!candidate) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '候选记忆不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { candidate } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
