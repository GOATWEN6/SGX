import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { interruptVoiceSession } from '@/lib/voice';
import { handleError } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const body = await request.json();
    const voiceSessionId = String(body.voiceSessionId || '');
    const reason = body.reason === 'manual_stop' ? 'manual_stop' : 'user_speech';
    if (!voiceSessionId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '缺少语音会话 ID' } },
        { status: 400 }
      );
    }

    const voiceSession = interruptVoiceSession(voiceSessionId, userId, reason);
    if (!voiceSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '语音会话不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { voiceSession } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
