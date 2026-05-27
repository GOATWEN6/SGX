import { v4 as uuidv4 } from 'uuid';
import {
  buildDoubaoRealtimeHeaders,
  getDoubaoRealtimeConfig,
  getDoubaoRealtimeConfigStatus,
} from './doubao-config';
import { decodeDoubaoFrame } from './doubao-codec';
import { connectHeaderWebSocket, HeaderWebSocketConnection } from './header-websocket';
import {
  markRealtimeProviderEvent,
  getRealtimeVoiceSession,
  isProviderOutputStale,
  transitionRealtimeVoiceSession,
} from './session-store';
import {
  RealtimeAudioChunk,
  RealtimeAudioDelta,
  RealtimeInterruptReason,
  RealtimeProviderEvent,
  RealtimeTextDelta,
} from './types';
import {
  buildDoubaoAudioTaskFrame,
  buildDoubaoClientInterruptFrame,
  buildDoubaoFinishConnectionFrame,
  buildDoubaoFinishSessionFrame,
  buildDoubaoStartConnectionFrame,
  buildDoubaoStartSessionFrame,
  describeDoubaoInputAudio,
  translateDoubaoFrameToRealtimeOutput,
} from './doubao-translator';

export interface DoubaoProviderOperationResult {
  ok: boolean;
  providerConfigured: boolean;
  providerConnected: boolean;
  forwarded: boolean;
  reason?: string;
  audioDeltas?: RealtimeAudioDelta[];
}

interface DoubaoRuntime {
  sessionId: string;
  connectId: string;
  connection?: HeaderWebSocketConnection;
  connectedAt?: string;
  providerSessionReadyAt?: string;
  lastError?: string;
  pendingAudioDeltas: RealtimeAudioDelta[];
  pendingTextDeltas: RealtimeTextDelta[];
  pendingAudioFrames: RealtimeAudioChunk[];
}

const runtimes = new Map<string, DoubaoRuntime>();

function getOrCreateRuntime(sessionId: string): DoubaoRuntime {
  const existing = runtimes.get(sessionId);
  if (existing) return existing;

  const runtime: DoubaoRuntime = {
    sessionId,
    connectId: uuidv4(),
    pendingAudioDeltas: [],
    pendingTextDeltas: [],
    pendingAudioFrames: [],
  };
  runtimes.set(sessionId, runtime);
  return runtime;
}

function markProviderEvents(events: RealtimeProviderEvent[]): void {
  for (const event of events) {
    markRealtimeProviderEvent(event);
  }
}

function handleDoubaoProviderMessage(
  sessionId: string,
  runtime: DoubaoRuntime,
  payload: Buffer,
  opcode: number
): void {
  const config = getDoubaoRealtimeConfig();
  if (!config) return;

  if (opcode !== 0x2) {
    markRealtimeProviderEvent({
      sessionId,
      type: 'error',
      receivedAt: new Date().toISOString(),
      payload: {
        provider: 'doubao',
        message: 'unexpected_non_binary_provider_frame',
        opcode,
        byteLength: payload.length,
      },
    });
    return;
  }

  try {
    const decoded = decodeDoubaoFrame(payload);
    const translated = translateDoubaoFrameToRealtimeOutput(sessionId, decoded, config);
    markProviderEvents(translated.providerEvents);

    if (decoded.eventName === 'SessionStarted') {
      runtime.providerSessionReadyAt = new Date().toISOString();
      transitionRealtimeVoiceSession(sessionId, 'provider_session_ready');
      flushQueuedDoubaoAudioFrames(sessionId, runtime, config);
    }
    if (decoded.eventName === 'ServerInterrupted') {
      runtime.pendingAudioDeltas = [];
      transitionRealtimeVoiceSession(sessionId, 'provider_cancel_ack_or_stale_guard_active');
    }
    const session = getRealtimeVoiceSession(sessionId);
    if (!session || !isProviderOutputStale(session.state, session.staleResponseGuard)) {
      runtime.pendingAudioDeltas.push(...translated.audioDeltas);
      runtime.pendingTextDeltas.push(...translated.textDeltas);
      if (translated.audioDeltas.length > 0) {
        transitionRealtimeVoiceSession(sessionId, 'audio_delta_or_response_start', { staleResponseGuard: false });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtime.lastError = message;
    markRealtimeProviderEvent({
      sessionId,
      type: 'error',
      receivedAt: new Date().toISOString(),
      payload: {
        provider: 'doubao',
        message: 'provider_frame_decode_failed',
        detail: message,
        byteLength: payload.length,
      },
    });
  }
}

function sendDoubaoAudioFrame(
  sessionId: string,
  runtime: DoubaoRuntime,
  chunk: RealtimeAudioChunk,
  config: NonNullable<ReturnType<typeof getDoubaoRealtimeConfig>>
): void {
  runtime.connection!.send(buildDoubaoAudioTaskFrame(sessionId, chunk, config), 0x2);
  markRealtimeProviderEvent({
    sessionId,
    type: 'input_audio.delta',
    receivedAt: new Date().toISOString(),
    payload: describeDoubaoInputAudio(chunk),
  });
}

function flushQueuedDoubaoAudioFrames(
  sessionId: string,
  runtime: DoubaoRuntime,
  config: NonNullable<ReturnType<typeof getDoubaoRealtimeConfig>>
): void {
  if (!runtime.connection?.connected || !runtime.providerSessionReadyAt) return;
  const chunks = runtime.pendingAudioFrames.splice(0, runtime.pendingAudioFrames.length);
  for (const chunk of chunks) {
    sendDoubaoAudioFrame(sessionId, runtime, chunk, config);
  }
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
        handleDoubaoProviderMessage(sessionId, runtime, payload, opcode);
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
    markRealtimeProviderEvent({
      sessionId,
      type: 'session.created',
      receivedAt: runtime.connectedAt,
      payload: {
        provider: 'doubao',
        resourceId: config.resourceId,
        model: config.model,
        binaryProtocolForwarding: config.enableBinaryProtocolForward,
      },
    });

    if (config.enableBinaryProtocolForward) {
      runtime.connection.send(buildDoubaoStartConnectionFrame(config), 0x2);
      runtime.connection.send(buildDoubaoStartSessionFrame(sessionId, config), 0x2);
    }

    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: config.enableBinaryProtocolForward
        ? 'connected_binary_protocol_session_start_sent'
        : 'connected_waiting_for_binary_protocol_gate',
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

  if (!config.enableBinaryProtocolForward) {
    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: 'binary_protocol_forward_disabled_until_provider_smoke_is_verified',
    };
  }

  if (!runtime.providerSessionReadyAt) {
    runtime.pendingAudioFrames.push(chunk);
    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: 'provider_session_not_ready_audio_queued',
    };
  }

  sendDoubaoAudioFrame(sessionId, runtime, chunk, config);

  return {
    ok: true,
    providerConfigured: true,
    providerConnected: true,
    forwarded: true,
    audioDeltas: flushDoubaoRealtimeOutput(sessionId),
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

  if (!config.enableBinaryProtocolForward) {
    return {
      ok: true,
      providerConfigured: true,
      providerConnected: true,
      forwarded: false,
      reason: 'binary_protocol_forward_disabled_until_provider_smoke_is_verified',
    };
  }

  runtime.pendingAudioDeltas = [];
  runtime.connection.send(buildDoubaoClientInterruptFrame(sessionId, reason, config), 0x2);
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

  const config = getDoubaoRealtimeConfig();
  if (config?.enableBinaryProtocolForward && runtime.connection.connected) {
    try {
      runtime.connection.send(buildDoubaoFinishSessionFrame(sessionId, config), 0x2);
      runtime.connection.send(buildDoubaoFinishConnectionFrame(config), 0x2);
    } catch {
      // Closing should stay idempotent even if the upstream socket is already gone.
    }
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

export function flushDoubaoRealtimeOutput(sessionId: string): RealtimeAudioDelta[] {
  const runtime = runtimes.get(sessionId);
  if (!runtime?.pendingAudioDeltas.length) return [];
  const session = getRealtimeVoiceSession(sessionId);
  if (session && isProviderOutputStale(session.state, session.staleResponseGuard)) {
    runtime.pendingAudioDeltas = [];
    return [];
  }
  const deltas = runtime.pendingAudioDeltas.splice(0, runtime.pendingAudioDeltas.length);
  return deltas.map((delta, index) => ({
    ...delta,
    sequence: delta.sequence ?? index,
  }));
}

export function flushDoubaoRealtimeTextOutput(sessionId: string): RealtimeTextDelta[] {
  const runtime = runtimes.get(sessionId);
  if (!runtime?.pendingTextDeltas.length) return [];
  const session = getRealtimeVoiceSession(sessionId);
  if (session && isProviderOutputStale(session.state, session.staleResponseGuard)) {
    runtime.pendingTextDeltas = [];
    return [];
  }
  return runtime.pendingTextDeltas.splice(0, runtime.pendingTextDeltas.length);
}
