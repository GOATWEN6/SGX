import { DoubaoRealtimeConfig } from './doubao-config';
import { encodeDoubaoFrame } from './doubao-codec';
import {
  DOUBAO_COMPLETION_EVENT_IDS,
  DOUBAO_ERROR_EVENT_IDS,
  DOUBAO_REALTIME_EVENTS,
  DoubaoCompression,
  DoubaoDecodedFrame,
  DoubaoMessageFlags,
  DoubaoMessageType,
  DoubaoSerialization,
} from './doubao-protocol-types';
import {
  RealtimeAudioChunk,
  RealtimeAudioDelta,
  RealtimeInterruptReason,
  RealtimeProviderEvent,
  RealtimeTextDelta,
} from './types';

export interface DoubaoTranslatedProviderOutput {
  providerEvents: RealtimeProviderEvent[];
  audioDeltas: RealtimeAudioDelta[];
  textDeltas: RealtimeTextDelta[];
}

function now(): string {
  return new Date().toISOString();
}

function compression(config: DoubaoRealtimeConfig): DoubaoCompression {
  return config.frameCompression === 'none' ? DoubaoCompression.None : DoubaoCompression.Gzip;
}

function doubaoInputCodec(chunk?: RealtimeAudioChunk): string {
  if (chunk?.format.codec === 'pcm16') return 'pcm16';
  if (chunk?.format.codec === 'wav') return 'wav';
  return 'speech_opus';
}

function mergeSessionParams(base: Record<string, unknown>, override?: Record<string, unknown>): Record<string, unknown> {
  if (!override) return base;
  return {
    ...base,
    ...override,
    audio: {
      ...((base.audio as Record<string, unknown> | undefined) || {}),
      ...((override.audio as Record<string, unknown> | undefined) || {}),
    },
    tts: {
      ...((base.tts as Record<string, unknown> | undefined) || {}),
      ...((override.tts as Record<string, unknown> | undefined) || {}),
    },
    llm: {
      ...((base.llm as Record<string, unknown> | undefined) || {}),
      ...((override.llm as Record<string, unknown> | undefined) || {}),
    },
  };
}

function buildStartSessionPayload(sessionId: string, config: DoubaoRealtimeConfig): Record<string, unknown> {
  return mergeSessionParams({
    session_id: sessionId,
    prompt: {
      system: config.systemPrompt,
    },
    audio: {
      input: {
        format: config.inputAudioFormat === 'pcm16' ? 'pcm16' : 'speech_opus',
        sample_rate: config.inputSampleRate,
        channels: config.inputChannels,
      },
      output: {
        format: config.outputAudioFormat,
        sample_rate: config.outputSampleRate,
      },
    },
    tts: {
      speaker: config.voice,
      audio_config: {
        format: config.outputAudioFormat,
        sample_rate: config.outputSampleRate,
      },
    },
    llm: {
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    },
    metadata: {
      product: 'ai-memoir-assistant',
      mode: 'web_voice_call_mvp',
    },
  }, config.sessionParams);
}

export function buildDoubaoStartConnectionFrame(config: DoubaoRealtimeConfig): Buffer {
  return encodeDoubaoFrame({
    messageType: DoubaoMessageType.FullClientRequest,
    flags: DoubaoMessageFlags.WithEvent,
    serialization: DoubaoSerialization.Json,
    compression: compression(config),
    eventId: DOUBAO_REALTIME_EVENTS.StartConnection,
    payloadJson: {},
  });
}

export function buildDoubaoStartSessionFrame(sessionId: string, config: DoubaoRealtimeConfig): Buffer {
  return encodeDoubaoFrame({
    messageType: DoubaoMessageType.FullClientRequest,
    flags: DoubaoMessageFlags.WithEvent,
    serialization: DoubaoSerialization.Json,
    compression: compression(config),
    eventId: DOUBAO_REALTIME_EVENTS.StartSession,
    sessionId,
    payloadJson: buildStartSessionPayload(sessionId, config),
  });
}

export function buildDoubaoAudioTaskFrame(
  sessionId: string,
  chunk: RealtimeAudioChunk,
  config: DoubaoRealtimeConfig
): Buffer {
  const payload = Buffer.from(chunk.base64Audio, 'base64');
  return encodeDoubaoFrame({
    messageType: DoubaoMessageType.AudioOnlyClientRequest,
    flags: DoubaoMessageFlags.WithEvent,
    serialization: DoubaoSerialization.None,
    compression: compression(config),
    eventId: DOUBAO_REALTIME_EVENTS.TaskRequest,
    sessionId,
    payload,
  });
}

export function buildDoubaoClientInterruptFrame(
  sessionId: string,
  reason: RealtimeInterruptReason,
  config: DoubaoRealtimeConfig
): Buffer {
  return encodeDoubaoFrame({
    messageType: DoubaoMessageType.FullClientRequest,
    flags: DoubaoMessageFlags.WithEvent,
    serialization: DoubaoSerialization.Json,
    compression: compression(config),
    eventId: DOUBAO_REALTIME_EVENTS.ClientInterrupt,
    sessionId,
    payloadJson: { reason },
  });
}

export function buildDoubaoFinishSessionFrame(sessionId: string, config: DoubaoRealtimeConfig): Buffer {
  return encodeDoubaoFrame({
    messageType: DoubaoMessageType.FullClientRequest,
    flags: DoubaoMessageFlags.WithEvent,
    serialization: DoubaoSerialization.Json,
    compression: compression(config),
    eventId: DOUBAO_REALTIME_EVENTS.FinishSession,
    sessionId,
    payloadJson: {},
  });
}

export function buildDoubaoFinishConnectionFrame(config: DoubaoRealtimeConfig): Buffer {
  return encodeDoubaoFrame({
    messageType: DoubaoMessageType.FullClientRequest,
    flags: DoubaoMessageFlags.WithEvent,
    serialization: DoubaoSerialization.Json,
    compression: compression(config),
    eventId: DOUBAO_REALTIME_EVENTS.FinishConnection,
    payloadJson: {},
  });
}

function readStringField(value: unknown, names: string[]): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const name of names) {
    const found = record[name];
    if (typeof found === 'string' && found.trim()) return found;
  }
  for (const child of Object.values(record)) {
    const nested = readStringField(child, names);
    if (nested) return nested;
  }
  return undefined;
}

function jsonSummary(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  return {
    event: record.event,
    code: record.code,
    message: typeof record.message === 'string' ? record.message.slice(0, 240) : undefined,
    text: typeof record.text === 'string' ? record.text.slice(0, 240) : undefined,
  };
}

export function translateDoubaoFrameToRealtimeOutput(
  sessionId: string,
  frame: DoubaoDecodedFrame,
  config: DoubaoRealtimeConfig
): DoubaoTranslatedProviderOutput {
  const receivedAt = now();
  const providerEvents: RealtimeProviderEvent[] = [];
  const audioDeltas: RealtimeAudioDelta[] = [];
  const textDeltas: RealtimeTextDelta[] = [];
  const eventName = frame.eventName || 'Unknown';
  const eventId = frame.eventId;

  if (
    frame.header.messageType === DoubaoMessageType.Error
    || (eventId !== undefined && DOUBAO_ERROR_EVENT_IDS.has(eventId))
  ) {
    providerEvents.push({
      sessionId,
      type: 'error',
      receivedAt,
      payload: {
        provider: 'doubao',
        eventName,
        eventId,
        detail: jsonSummary(frame.payloadJson) || frame.payload.toString('utf8').slice(0, 240),
      },
    });
    return { providerEvents, audioDeltas, textDeltas };
  }

  const transcript = readStringField(frame.payloadJson, ['text', 'delta', 'transcript', 'content']);
  if (transcript) {
    const role = eventName === 'ChatResponse' ? 'assistant' : 'user';
    textDeltas.push({
      role,
      text: transcript,
      receivedAt,
    });
    providerEvents.push({
      sessionId,
      type: 'transcript.delta',
      receivedAt,
      payload: {
        provider: 'doubao',
        eventName,
        eventId,
        text: transcript,
      },
    });
  }

  const isAudioPayload =
    frame.payload.length > 0
    && frame.header.serialization === DoubaoSerialization.None
    && frame.header.messageType === DoubaoMessageType.FullServerResponse;
  if (isAudioPayload) {
    audioDeltas.push({
      base64Audio: frame.payload.toString('base64'),
      mimeType: config.outputMimeType,
      receivedAt,
    });
    providerEvents.push({
      sessionId,
      type: 'response.audio.delta',
      receivedAt,
      payload: {
        provider: 'doubao',
        eventName,
        eventId,
        byteLength: frame.payload.length,
        mimeType: config.outputMimeType,
      },
    });
  }

  if (eventId !== undefined && DOUBAO_COMPLETION_EVENT_IDS.has(eventId)) {
    providerEvents.push({
      sessionId,
      type: 'response.completed',
      receivedAt,
      payload: {
        provider: 'doubao',
        eventName,
        eventId,
      },
    });
  }

  if (!providerEvents.length) {
    providerEvents.push({
      sessionId,
      type: 'transcript.delta',
      receivedAt,
      payload: {
        provider: 'doubao',
        eventName,
        eventId,
        messageType: frame.header.messageType,
        payloadBytes: frame.payload.length,
      },
    });
  }

  return { providerEvents, audioDeltas, textDeltas };
}

export function describeDoubaoInputAudio(chunk: RealtimeAudioChunk): Record<string, unknown> {
  return {
    sequence: chunk.sequence,
    providerCodec: doubaoInputCodec(chunk),
    browserCodec: chunk.format.codec,
    sampleRate: chunk.format.sampleRate,
    channels: chunk.format.channels,
    durationMs: chunk.durationMs,
  };
}
