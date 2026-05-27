import type { VoiceState as LegacyVoiceState } from '@/types';

export type RealtimeVoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'user_speaking'
  | 'thinking'
  | 'assistant_speaking'
  | 'interrupted'
  | 'recovering'
  | 'error'
  | 'ended';

export type RealtimeVoiceEvent =
  | 'start_call'
  | 'provider_session_ready'
  | 'mic_denied_or_provider_failed'
  | 'vad_speech_start_or_transcript_delta'
  | 'turn_committed'
  | 'audio_delta_or_response_start'
  | 'user_speech_or_manual_interrupt'
  | 'provider_cancel_ack_or_stale_guard_active'
  | 'assistant_turn_complete'
  | 'end_call'
  | 'provider_timeout'
  | 'playback_error'
  | 'retry_success'
  | 'retry_failed'
  | 'reset';

export type RealtimeProviderName = 'doubao' | 'livekit' | 'pipecat' | 'demo';

export type RealtimeInterruptReason = 'user_speech' | 'manual_stop';

export interface RealtimeAudioFormat {
  codec: 'pcm16' | 'opus' | 'webm' | 'wav';
  sampleRate: number;
  channels: 1 | 2;
}

export interface RealtimeAudioChunk {
  sequence: number;
  base64Audio: string;
  format: RealtimeAudioFormat;
  durationMs?: number;
  capturedAt?: string;
}

export interface RealtimeAudioDelta {
  base64Audio: string;
  mimeType: string;
  sequence?: number;
  receivedAt?: string;
}

export interface RealtimeTextDelta {
  text: string;
  role?: 'user' | 'assistant';
  receivedAt?: string;
}

export interface RealtimeVoiceSessionConfig {
  userId: string;
  conversationSessionId?: string;
  provider: RealtimeProviderName;
  providerConfigured: boolean;
  fallbackMode: boolean;
  inputFormat?: RealtimeAudioFormat;
}

export interface RealtimeVoiceSessionSnapshot {
  id: string;
  userId: string;
  conversationSessionId?: string;
  provider: RealtimeProviderName;
  providerConfigured: boolean;
  fallbackMode: boolean;
  state: RealtimeVoiceState;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
  interruptionCount: number;
  audioChunksReceived: number;
  audioMsReceived: number;
  lastAudioSequence?: number;
  lastEvent?: RealtimeVoiceEvent;
  errorMessage?: string;
  staleResponseGuard: boolean;
}

export interface RealtimeTransitionResult {
  allowed: boolean;
  from: RealtimeVoiceState;
  to: RealtimeVoiceState;
  event: RealtimeVoiceEvent;
  reason?: string;
}

export interface RealtimeProviderEvent {
  sessionId: string;
  type:
    | 'session.created'
    | 'input_audio.delta'
    | 'transcript.delta'
    | 'response.audio.delta'
    | 'response.completed'
    | 'response.cancelled'
    | 'error';
  receivedAt: string;
  payload?: unknown;
}

export function toLegacyVoiceState(state: RealtimeVoiceState): LegacyVoiceState {
  switch (state) {
    case 'user_speaking':
      return 'listening';
    case 'assistant_speaking':
      return 'speaking';
    case 'recovering':
      return 'connecting';
    case 'ended':
      return 'idle';
    default:
      return state;
  }
}
