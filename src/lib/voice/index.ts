import {
  createVoiceSessionRecord,
  getConversationSessionById,
  getVoiceSessionRecordById,
  updateConversationSession,
  updateVoiceSessionRecord,
} from '@/lib/db';
import { VoiceSessionRecord, VoiceState } from '@/types';

export interface AudioChunk {
  data: string;
  format: 'pcm16' | 'webm' | 'wav';
  sequence: number;
}

export interface VoiceSessionConfig {
  userId: string;
  conversationSessionId?: string;
}

export interface VoiceSessionHandle {
  id: string;
  provider: 'doubao';
  providerConfigured: boolean;
  fallbackMode: boolean;
  state: VoiceState;
}

export interface RealtimeVoiceProvider {
  createSession(input: VoiceSessionConfig): Promise<VoiceSessionHandle>;
  sendAudio(chunk: AudioChunk): Promise<void>;
  interrupt(reason: 'user_speech' | 'manual_stop'): Promise<void>;
  close(): Promise<void>;
}

export function isDoubaoRealtimeConfigured(): boolean {
  return Boolean(
    process.env.DOUBAO_REALTIME_ENABLED === 'true'
    && process.env.DOUBAO_REALTIME_API_KEY
    && process.env.DOUBAO_REALTIME_ENDPOINT
    && process.env.DOUBAO_REALTIME_MODEL
  );
}

export async function createDoubaoVoiceSession(input: VoiceSessionConfig): Promise<VoiceSessionRecord> {
  if (input.conversationSessionId) {
    const conversationSession = getConversationSessionById(input.conversationSessionId);
    if (!conversationSession || conversationSession.userId !== input.userId) {
      throw new Error('会话不存在或无权访问');
    }
  }

  const providerConfigured = isDoubaoRealtimeConfigured();
  return createVoiceSessionRecord({
    userId: input.userId,
    conversationSessionId: input.conversationSessionId,
    provider: 'doubao',
    providerConfigured,
    fallbackMode: !providerConfigured,
    state: providerConfigured ? 'connecting' : 'idle',
  });
}

export function interruptVoiceSession(id: string, userId: string, reason: 'user_speech' | 'manual_stop'): VoiceSessionRecord | null {
  const current = getVoiceSessionRecordById(id);
  if (!current || current.userId !== userId) return null;

  const next = updateVoiceSessionRecord(id, {
    state: reason === 'user_speech' ? 'interrupted' : 'listening',
    interruptionCount: current.interruptionCount + 1,
  });

  if (next?.conversationSessionId) {
    updateConversationSession(next.conversationSessionId, {
      lastState: next.state,
      interruptionCount: next.interruptionCount,
    });
  }

  return next;
}

export function endVoiceSession(id: string, userId: string): VoiceSessionRecord | null {
  const current = getVoiceSessionRecordById(id);
  if (!current || current.userId !== userId) return null;
  return updateVoiceSessionRecord(id, {
    state: 'idle',
    endedAt: new Date().toISOString(),
  });
}

export * from './realtime';
