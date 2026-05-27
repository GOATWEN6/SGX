import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleError } from '@/lib/errors';
import { isDoubaoRealtimeConfigured } from '@/lib/voice';
import {
  appendRealtimeAudioChunk,
  closeRealtimeVoiceSession,
  closeDoubaoRealtimeRuntime,
  connectDoubaoRealtimeRuntime,
  forwardDoubaoAudioChunk,
  flushDoubaoRealtimeOutput,
  flushDoubaoRealtimeTextOutput,
  createRealtimeVoiceSession,
  getRealtimeVoiceSession,
  interruptRealtimeVoiceSession,
  interruptDoubaoRealtimeRuntime,
  RealtimeAudioChunk,
  DoubaoProviderOperationResult,
  RealtimeVoiceEvent,
  toLegacyVoiceState,
  transitionRealtimeVoiceSession,
} from '@/lib/voice/realtime';

export const dynamic = 'force-dynamic';

type RealtimeAction =
  | 'create'
  | 'provider_ready'
  | 'append_audio'
  | 'commit_turn'
  | 'assistant_started'
  | 'assistant_completed'
  | 'cancel_ack'
  | 'poll_output'
  | 'interrupt'
  | 'close'
  | 'provider_timeout'
  | 'playback_error'
  | 'retry_success'
  | 'retry_failed'
  | 'reset';

const actionToEvent: Partial<Record<RealtimeAction, RealtimeVoiceEvent>> = {
  provider_ready: 'provider_session_ready',
  commit_turn: 'turn_committed',
  assistant_started: 'audio_delta_or_response_start',
  assistant_completed: 'assistant_turn_complete',
  cancel_ack: 'provider_cancel_ack_or_stale_guard_active',
  provider_timeout: 'provider_timeout',
  playback_error: 'playback_error',
  retry_success: 'retry_success',
  retry_failed: 'retry_failed',
  reset: 'reset',
};

function getAction(value: unknown): RealtimeAction | null {
  if (typeof value !== 'string') return null;
  const allowed: RealtimeAction[] = [
    'create',
    'provider_ready',
    'append_audio',
    'commit_turn',
    'assistant_started',
    'assistant_completed',
    'cancel_ack',
    'poll_output',
    'interrupt',
    'close',
    'provider_timeout',
    'playback_error',
    'retry_success',
    'retry_failed',
    'reset',
  ];
  return allowed.includes(value as RealtimeAction) ? value as RealtimeAction : null;
}

function assertOwnedSession(sessionId: unknown, userId: string) {
  const id = String(sessionId || '');
  if (!id) {
    return { error: '缺少 realtime session ID' };
  }

  const session = getRealtimeVoiceSession(id);
  if (!session || session.userId !== userId) {
    return { error: 'Realtime 语音会话不存在' };
  }

  return { session };
}

type ClientProviderResult = Pick<
  DoubaoProviderOperationResult,
  'ok' | 'providerConfigured' | 'providerConnected' | 'forwarded' | 'reason'
>;

function toClientProviderResult(result: DoubaoProviderOperationResult | undefined): ClientProviderResult | undefined {
  if (!result) return undefined;
  const base: ClientProviderResult = {
    ok: result.ok,
    providerConfigured: result.providerConfigured,
    providerConnected: result.providerConnected,
    forwarded: result.forwarded,
  };
  if (!result.reason) return base;
  const safeReasons = [
    'already_connected',
    'connected_binary_protocol_session_start_sent',
    'connected_waiting_for_binary_protocol_gate',
    'binary_protocol_forward_disabled_until_provider_smoke_is_verified',
    'provider_session_not_ready_audio_queued',
    'provider_not_configured',
    'provider_not_connected',
    'runtime_not_connected',
  ];
  if (safeReasons.includes(result.reason) || result.reason.startsWith('missing_config:')) {
    return { ...base, reason: result.reason };
  }
  return {
    ...base,
    reason: 'provider_connection_failed',
  };
}

function toResponseData(session: NonNullable<ReturnType<typeof getRealtimeVoiceSession>>) {
  return {
    realtimeSession: {
      id: session.id,
      provider: session.provider,
      providerConfigured: session.providerConfigured,
      fallbackMode: session.fallbackMode,
      state: session.state,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      endedAt: session.endedAt,
      interruptionCount: session.interruptionCount,
      audioChunksReceived: session.audioChunksReceived,
      audioMsReceived: session.audioMsReceived,
      lastAudioSequence: session.lastAudioSequence,
      staleResponseGuard: session.staleResponseGuard,
    },
    legacyState: toLegacyVoiceState(session.state),
  };
}

function validateAudioChunk(raw: unknown): RealtimeAudioChunk | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Partial<RealtimeAudioChunk>;
  if (
    typeof input.sequence !== 'number'
    || typeof input.base64Audio !== 'string'
    || !input.format
    || typeof input.format.sampleRate !== 'number'
    || (input.format.channels !== 1 && input.format.channels !== 2)
  ) {
    return null;
  }

  const codec = input.format.codec;
  if (codec !== 'pcm16' && codec !== 'opus' && codec !== 'webm' && codec !== 'wav') {
    return null;
  }

  return {
    sequence: input.sequence,
    base64Audio: input.base64Audio,
    format: {
      codec,
      sampleRate: input.format.sampleRate,
      channels: input.format.channels,
    },
    durationMs: input.durationMs,
    capturedAt: input.capturedAt,
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = requireAuth(request);
    const body = await request.json().catch(() => ({}));
    const action = getAction(body.action);

    if (!action) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '缺少或不支持的 realtime action' } },
        { status: 400 }
      );
    }

    if (action === 'create') {
      const providerConfigured = isDoubaoRealtimeConfigured();
      const session = createRealtimeVoiceSession({
        userId,
        conversationSessionId: body.conversationSessionId ? String(body.conversationSessionId) : undefined,
        provider: 'doubao',
        providerConfigured,
        fallbackMode: !providerConfigured,
        inputFormat: body.inputFormat,
      });
      const providerConnection = body.connectProvider === false
        ? undefined
        : await connectDoubaoRealtimeRuntime(session.id);
      const current = getRealtimeVoiceSession(session.id) || session;
      return NextResponse.json({
        success: true,
        data: {
          ...toResponseData(current),
          providerConnection: toClientProviderResult(providerConnection),
        },
      });
    }

    const owned = assertOwnedSession(body.realtimeSessionId, userId);
    if ('error' in owned) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: owned.error } },
        { status: 404 }
      );
    }

    if (action === 'append_audio') {
      const chunk = validateAudioChunk(body.chunk);
      if (!chunk) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PARAMS', message: '音频 chunk 格式不正确' } },
          { status: 400 }
        );
      }
      const { session, transition } = appendRealtimeAudioChunk(owned.session.id, chunk);
      const providerForward = await forwardDoubaoAudioChunk(owned.session.id, chunk);
      const current = getRealtimeVoiceSession(owned.session.id) || session!;
      return NextResponse.json({
        success: true,
        data: {
          ...toResponseData(current),
          transition,
          providerForward: toClientProviderResult(providerForward),
          audioDeltas: providerForward.audioDeltas || [],
          textDeltas: flushDoubaoRealtimeTextOutput(owned.session.id),
        },
      });
    }

    if (action === 'poll_output') {
      return NextResponse.json({
        success: true,
        data: {
          ...toResponseData(owned.session),
          audioDeltas: flushDoubaoRealtimeOutput(owned.session.id),
          textDeltas: flushDoubaoRealtimeTextOutput(owned.session.id),
        },
      });
    }

    if (action === 'interrupt') {
      const reason = body.reason === 'manual_stop' ? 'manual_stop' : 'user_speech';
      const { session, transition } = interruptRealtimeVoiceSession(owned.session.id, reason);
      if (!transition.allowed) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATE', message: transition.reason }, data: { transition } },
          { status: 409 }
        );
      }
      const providerInterrupt = await interruptDoubaoRealtimeRuntime(owned.session.id, reason);
      return NextResponse.json({
        success: true,
        data: {
          ...toResponseData(session!),
          transition,
          providerInterrupt: toClientProviderResult(providerInterrupt),
        },
      });
    }

    if (action === 'close') {
      const providerClose = closeDoubaoRealtimeRuntime(owned.session.id);
      const session = closeRealtimeVoiceSession(owned.session.id);
      return NextResponse.json({
        success: true,
        data: {
          ...toResponseData(session!),
          providerClose: toClientProviderResult(providerClose),
        },
      });
    }

    const event = actionToEvent[action];
    if (!event) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '不支持的状态迁移动作' } },
        { status: 400 }
      );
    }

    const { session, transition } = transitionRealtimeVoiceSession(owned.session.id, event);
    if (!transition.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: transition.reason }, data: { transition } },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: { ...toResponseData(session!), transition } });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}
