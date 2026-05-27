import {
  RealtimeTransitionResult,
  RealtimeVoiceEvent,
  RealtimeVoiceState,
} from './types';

export const REALTIME_VOICE_STATES: RealtimeVoiceState[] = [
  'idle',
  'connecting',
  'listening',
  'user_speaking',
  'thinking',
  'assistant_speaking',
  'interrupted',
  'recovering',
  'error',
  'ended',
];

export const REALTIME_VOICE_EVENTS: RealtimeVoiceEvent[] = [
  'start_call',
  'provider_session_ready',
  'mic_denied_or_provider_failed',
  'vad_speech_start_or_transcript_delta',
  'turn_committed',
  'audio_delta_or_response_start',
  'user_speech_or_manual_interrupt',
  'provider_cancel_ack_or_stale_guard_active',
  'assistant_turn_complete',
  'end_call',
  'provider_timeout',
  'playback_error',
  'retry_success',
  'retry_failed',
  'reset',
];

type TransitionTable = Record<RealtimeVoiceState, Partial<Record<RealtimeVoiceEvent, RealtimeVoiceState>>>;

export const REALTIME_VOICE_TRANSITIONS: TransitionTable = {
  idle: {
    start_call: 'connecting',
    reset: 'idle',
    end_call: 'ended',
  },
  connecting: {
    provider_session_ready: 'listening',
    mic_denied_or_provider_failed: 'error',
    provider_timeout: 'recovering',
    end_call: 'ended',
  },
  listening: {
    vad_speech_start_or_transcript_delta: 'user_speaking',
    end_call: 'ended',
  },
  user_speaking: {
    turn_committed: 'thinking',
    end_call: 'ended',
  },
  thinking: {
    audio_delta_or_response_start: 'assistant_speaking',
    provider_timeout: 'recovering',
    mic_denied_or_provider_failed: 'error',
    end_call: 'ended',
  },
  assistant_speaking: {
    user_speech_or_manual_interrupt: 'interrupted',
    assistant_turn_complete: 'listening',
    playback_error: 'recovering',
    end_call: 'ended',
  },
  interrupted: {
    provider_cancel_ack_or_stale_guard_active: 'listening',
    provider_timeout: 'recovering',
    end_call: 'ended',
  },
  recovering: {
    retry_success: 'listening',
    retry_failed: 'error',
    reset: 'idle',
    end_call: 'ended',
  },
  error: {
    reset: 'idle',
    end_call: 'ended',
  },
  ended: {
    reset: 'idle',
  },
};

export function canTransitionRealtimeVoiceState(
  from: RealtimeVoiceState,
  event: RealtimeVoiceEvent
): boolean {
  return Boolean(REALTIME_VOICE_TRANSITIONS[from]?.[event]);
}

export function transitionRealtimeVoiceState(
  from: RealtimeVoiceState,
  event: RealtimeVoiceEvent
): RealtimeTransitionResult {
  const to = REALTIME_VOICE_TRANSITIONS[from]?.[event];

  if (!to) {
    return {
      allowed: false,
      from,
      to: from,
      event,
      reason: `Invalid realtime voice transition: ${from} + ${event}`,
    };
  }

  return {
    allowed: true,
    from,
    to,
    event,
  };
}

export function assertRealtimeVoiceTransition(
  from: RealtimeVoiceState,
  event: RealtimeVoiceEvent
): RealtimeTransitionResult {
  const result = transitionRealtimeVoiceState(from, event);
  if (!result.allowed) {
    throw new Error(result.reason);
  }
  return result;
}

export function isTerminalRealtimeVoiceState(state: RealtimeVoiceState): boolean {
  return state === 'ended';
}

export function isRecoverableRealtimeVoiceState(state: RealtimeVoiceState): boolean {
  return state === 'error' || state === 'recovering';
}
