import { v4 as uuidv4 } from 'uuid';
import {
  buildDoubaoRealtimeHeaders,
  getDoubaoRealtimeConfig,
  getDoubaoRealtimeConfigStatus,
} from './doubao-config';
import { connectHeaderWebSocket, HeaderWebSocketConnection } from './header-websocket';
import {
  markRealtimeProviderEvent,
  transitionRealtimeVoiceSession,
} from './session-store';
import { RealtimeAudioChunk, RealtimeInterruptReason } from './types';

export interface DoubaoProviderOperationResult {
  ok: boolean;
  providerConfigured: boolean;
  providerConnected: boolean;
  forwarded: boolean;
  reason?: string;
}

interface DoubaoRuntime {
  sessionId: string;
  connectId: string;
  connection?: HeaderWebSocketConnection;
  connectedAt?: string;
  lastError?: string;
}

const runtimes = new Map<string, DoubaoRuntime>();

function getOrCreateRuntime(sessionId: string): DoubaoRuntime {
  const existing = runtimes.get(sessionId);
  if (existing) return existing;

  const runtime: DoubaoRuntime = {
    sessionId,
    connectId: uuidv4(),
  };
  runtimes.set(sessionId, runtime);
  return runtime;
}

export function isDoubaoRealtimeProviderConfigured(): boolean {
  return getDoubaoRealtimeConfigStatus().configured;
}

export async function connectDoubaoRealtimeRuntime(sessionId: string): Promise<DoubaoProviderOperationResult> {
  const config = getDoubaoRealtimeConfig();
  if (!config) {
    return {
      ok: true,
      providerConfigured: false,
      providerConnected: false,
      forwarded: false,
      reason: `missing_config:${getDoubaoRealtimeConfigStatus().missing.join(',')}`,
    };
  }

  const runtime = getOrCreateRuntime(sessionId);
  if (runtime.connection?.connected) {
    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: 'already_connected',
    };
  }

  try {
    runtime.connection = await connectHeaderWebSocket({
      url: config.endpoint,
      headers: buildDoubaoRealtimeHeaders(config, runtime.connectId),
      timeoutMs: config.connectTimeoutMs,
      onMessage: (payload, opcode) => {
        markRealtimeProviderEvent({
          sessionId,
          type: opcode === 0x2 ? 'response.audio.delta' : 'transcript.delta',
          receivedAt: new Date().toISOString(),
          payload: {
            opcode,
            byteLength: payload.length,
          },
        });
      },
      onClose: () => {
        runtimes.delete(sessionId);
      },
      onError: error => {
        runtime.lastError = error.message;
        markRealtimeProviderEvent({
          sessionId,
          type: 'error',
          receivedAt: new Date().toISOString(),
          payload: { message: error.message },
        });
      },
    });
    runtime.connectedAt = new Date().toISOString();
    transitionRealtimeVoiceSession(sessionId, 'provider_session_ready');
    markRealtimeProviderEvent({
      sessionId,
      type: 'session.created',
      receivedAt: runtime.connectedAt,
      payload: {
        provider: 'doubao',
        resourceId: config.resourceId,
        model: config.model,
      },
    });

    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: 'connected_waiting_for_binary_codec',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtime.lastError = message;
    transitionRealtimeVoiceSession(sessionId, 'provider_timeout', { errorMessage: message });
    return {
      ok: false,
      providerConfigured: true,
      providerConnected: false,
      forwarded: false,
      reason: message,
    };
  }
}

export async function forwardDoubaoAudioChunk(
  sessionId: string,
  chunk: RealtimeAudioChunk
): Promise<DoubaoProviderOperationResult> {
  const config = getDoubaoRealtimeConfig();
  if (!config) {
    return {
      ok: true,
      providerConfigured: false,
      providerConnected: false,
      forwarded: false,
      reason: 'provider_not_configured',
    };
  }

  const connectionResult = await connectDoubaoRealtimeRuntime(sessionId);
  const runtime = getOrCreateRuntime(sessionId);
  if (!connectionResult.providerConnected || !runtime.connection?.connected) {
    return connectionResult;
  }

  if (!config.enableRawAudioForward) {
    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: 'raw_audio_forward_disabled_until_binary_codec_is_verified',
    };
  }

  runtime.connection.send(Buffer.from(chunk.base64Audio, 'base64'), 0x2);
  markRealtimeProviderEvent({
    sessionId,
    type: 'input_audio.delta',
    receivedAt: new Date().toISOString(),
    payload: {
      sequence: chunk.sequence,
      codec: chunk.format.codec,
      sampleRate: chunk.format.sampleRate,
      channels: chunk.format.channels,
      durationMs: chunk.durationMs,
    },
  });

  return {
    ok: true,
    providerConfigured: true,
    providerConnected: true,
    forwarded: true,
  };
}

export async function interruptDoubaoRealtimeRuntime(
  sessionId: string,
  reason: RealtimeInterruptReason
): Promise<DoubaoProviderOperationResult> {
  const config = getDoubaoRealtimeConfig();
  if (!config) {
    return {
      ok: true,
      providerConfigured: false,
      providerConnected: false,
      forwarded: false,
      reason: 'provider_not_configured',
    };
  }

  const runtime = getOrCreateRuntime(sessionId);
  if (!runtime.connection?.connected) {
    return {
      ok: true,
      providerConfigured: true,
      providerConnected: false,
      forwarded: false,
      reason: 'provider_not_connected',
    };
  }

  if (!config.enableJsonControlFrames) {
    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: 'json_control_frames_disabled_until_binary_codec_is_verified',
    };
  }

  runtime.connection.send(JSON.stringify({ type: 'interrupt', reason }), 0x1);
  return {
    ok: true,
    providerConfigured: true,
    providerConnected: true,
    forwarded: true,
  };
}

export function closeDoubaoRealtimeRuntime(sessionId: string): DoubaoProviderOperationResult {
  const runtime = runtimes.get(sessionId);
  if (!runtime?.connection) {
    runtimes.delete(sessionId);
    return {
      ok: true,
      providerConfigured: isDoubaoRealtimeProviderConfigured(),
      providerConnected: false,
      forwarded: false,
      reason: 'runtime_not_connected',
    };
  }

  runtime.connection.close();
  runtimes.delete(sessionId);
  return {
    ok: true,
    providerConfigured: true,
    providerConnected: false,
    forwarded: true,
  };
}
