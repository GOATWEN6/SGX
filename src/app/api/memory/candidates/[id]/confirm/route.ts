import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { confirmMemoryCandidate } from '@/lib/memory';
import { handleError } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = requireAuth(request);
    const candidate = confirmMemoryCandidate(params.id, userId);
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
