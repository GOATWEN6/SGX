import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { createDoubaoVoiceSession } from '@/lib/voice';
import { handleError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const voiceSession = await createDoubaoVoiceSession({
      userId,
      conversationSessionId: body.conversationSessionId,
    });

    return NextResponse.json({ success: true, data: { voiceSession } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
