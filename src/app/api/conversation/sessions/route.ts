import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserChildVisibleSummaries, getUserConversationSessions } from '@/lib/db';
import { handleError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const sessions = getUserConversationSessions(userId).items;
    const summaries = getUserChildVisibleSummaries(userId);
    return NextResponse.json({ success: true, data: { sessions, summaries } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
