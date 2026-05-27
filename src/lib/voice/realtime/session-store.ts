import { v4 as uuidv4 } from 'uuid';
import {
  RealtimeAudioChunk,
  RealtimeInterruptReason,
  RealtimeProviderEvent,
  RealtimeTransitionResult,
  RealtimeVoiceEvent,
  RealtimeVoiceSessionConfig,
  RealtimeVoiceSessionSnapshot,
  RealtimeVoiceState,
} from './types';
import { transitionRealtimeVoiceState } from './state-machine';

const realtimeSessions = new Map<string, RealtimeVoiceSessionSnapshot>();
const providerEvents = new Map<string, RealtimeProviderEvent[]>();

function now(): string {
  return new Date().toISOString();
}

function applySessionTransition(
  session: RealtimeVoiceSessionSnapshot,
  event: RealtimeVoiceEvent,
  updates: Partial<RealtimeVoiceSessionSnapshot> = {}
): { session: RealtimeVoiceSessionSnapshot; transition: RealtimeTransitionResult } {
  const transition = transitionRealtimeVoiceState(session.state, event);
  if (!transition.allowed) {
    return { session, transition };
  }

  const nextSession: RealtimeVoiceSessionSnapshot = {
    ...session,
    ...updates,
    state: transition.to,
    lastEvent: event,
    updatedAt: now(),
    staleResponseGuard: updates.staleResponseGuard ?? (
      event === 'user_speech_or_manual_interrupt' ? true : session.staleResponseGuard
    ),
  };

  realtimeSessions.set(session.id, nextSession);
  return { session: nextSession, transition };
}

export function createRealtimeVoiceSession(
  config: RealtimeVoiceSessionConfig
): RealtimeVoiceSessionSnapshot {
  const timestamp = now();
  const session: RealtimeVoiceSessionSnapshot = {
    id: uuidv4(),
    userId: config.userId,
    conversationSessionId: config.conversationSessionId,
    provider: config.provider,
    providerConfigured: config.providerConfigured,
    fallbackMode: config.fallbackMode,
    state: 'idle',
    createdAt: timestamp,
    updatedAt: timestamp,
    interruptionCount: 0,
    audioChunksReceived: 0,
    audioMsReceived: 0,
    staleResponseGuard: false,
  };

  realtimeSessions.set(session.id, session);
  providerEvents.set(session.id, []);

  const { session: started } = applySessionTransition(session, 'start_call');
  return started;
}

export function getRealtimeVoiceSession(id: string): RealtimeVoiceSessionSnapshot | null {
  return realtimeSessions.get(id) || null;
}

export function listRealtimeVoiceSessions(): RealtimeVoiceSessionSnapshot[] {
  return Array.from(realtimeSessions.values());
}

export function transitionRealtimeVoiceSession(
  id: string,
  event: RealtimeVoiceEvent,
  updates: Partial<RealtimeVoiceSessionSnapshot> = {}
): { session: RealtimeVoiceSessionSnapshot | null; transition: RealtimeTransitionResult } {
  const session = getRealtimeVoiceSession(id);
  if (!session) {
    return {
      session: null,
      transition: {
        allowed: false,
        from: 'ended',
        to: 'ended',
        event,
        reason: `Realtime voice session not found: ${id}`,
      },
    };
  }
  return applySessionTransition(session, event, updates);
}

export function appendRealtimeAudioChunk(
  id: string,
  chunk: RealtimeAudioChunk
): { session: RealtimeVoiceSessionSnapshot | null; transition?: RealtimeTransitionResult } {
  const session = getRealtimeVoiceSession(id);
  if (!session) {
    return { session: null };
  }

  let current = session;
  let transition: RealtimeTransitionResult | undefined;

  if (session.state === 'listening') {
    const result = applySessionTransition(session, 'vad_speech_start_or_transcript_delta');
    current = result.session;
    transition = result.transition;
  }

  const nextSession: RealtimeVoiceSessionSnapshot = {
    ...current,
    audioChunksReceived: current.audioChunksReceived + 1,
    audioMsReceived: current.audioMsReceived + (chunk.durationMs || 0),
    lastAudioSequence: chunk.sequence,
    updatedAt: now(),
  };

  realtimeSessions.set(id, nextSession);
  return { session: nextSession, transition };
}

export function markRealtimeProviderEvent(event: RealtimeProviderEvent): void {
  const events = providerEvents.get(event.sessionId) || [];
  events.push(event);
  providerEvents.set(event.sessionId, events.slice(-200));
}

export function getRealtimeProviderEvents(sessionId: string): RealtimeProviderEvent[] {
  return providerEvents.get(sessionId) || [];
}

export function interruptRealtimeVoiceSession(
  id: string,
  reason: RealtimeInterruptReason
): { session: RealtimeVoiceSessionSnapshot | null; transition: RealtimeTransitionResult } {
  const session = getRealtimeVoiceSession(id);
  if (!session) {
    return {
      session: null,
      transition: {
        allowed: false,
        from: 'ended',
        to: 'ended',
        event: 'user_speech_or_manual_interrupt',
        reason: `Realtime voice session not found: ${id}`,
      },
    };
  }

  return applySessionTransition(session, 'user_speech_or_manual_interrupt', {
    interruptionCount: session.interruptionCount + 1,
    staleResponseGuard: true,
    lastEvent: reason === 'user_speech' ? 'user_speech_or_manual_interrupt' : session.lastEvent,
  });
}

export function closeRealtimeVoiceSession(id: string): RealtimeVoiceSessionSnapshot | null {
  const session = getRealtimeVoiceSession(id);
  if (!session) return null;

  const { session: ended } = applySessionTransition(session, 'end_call', {
    endedAt: now(),
  });
  return ended;
}

export function resetRealtimeVoiceSessionsForTests(): void {
  realtimeSessions.clear();
  providerEvents.clear();
}

export function isProviderOutputStale(state: RealtimeVoiceState, staleResponseGuard: boolean): boolean {
  return staleResponseGuard || state === 'interrupted' || state === 'ended';
}
