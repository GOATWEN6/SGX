import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { getMaskedVoiceTtsStatus, synthesizeSpeech } from '@/lib/voice/tts';

export const dynamic = 'force-dynamic';

function normalizeText(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 500);
}

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);
    return NextResponse.json({
      success: true,
      data: {
        status: getMaskedVoiceTtsStatus(),
      },
    });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const text = normalizeText(body.text);
    if (!text) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '缺少需要合成的文本' } },
        { status: 400 }
      );
    }

    const result = await synthesizeSpeech({ text });
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
