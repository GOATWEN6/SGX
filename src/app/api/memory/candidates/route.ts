import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserMemoryCandidates } from '@/lib/db';
import { handleError } from '@/lib/errors';
import { MemoryCandidateStatus } from '@/types';

export const dynamic = 'force-dynamic';
const allowedStatuses: MemoryCandidateStatus[] = ['pending_elder_confirm', 'confirmed', 'rejected', 'edited'];

export async function GET(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const status = request.nextUrl.searchParams.get('status') as MemoryCandidateStatus | null;
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '候选记忆状态无效' } },
        { status: 400 }
      );
    }
    const candidates = getUserMemoryCandidates(userId, status || undefined);
    return NextResponse.json({ success: true, data: { candidates } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
