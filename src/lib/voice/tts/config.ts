import { VoiceTtsConfigStatus, VoiceTtsProviderName } from './types';

export interface MiniMaxTtsConfig {
  provider: 'minimax';
  endpoint: string;
  apiKey: string;
  model: string;
  voiceId: string;
  outputFormat: 'mp3' | 'wav' | 'pcm';
  sampleRate: number;
  bitrate: number;
  speed: number;
  volume: number;
  pitch: number;
  connectTimeoutMs: number;
  synthesisTimeoutMs: number;
}

export type VoiceTtsConfig = MiniMaxTtsConfig;

const DEFAULT_MINIMAX_ENDPOINT = 'wss://api.minimaxi.com/ws/v1/t2a_v2';
const DEFAULT_MINIMAX_MODEL = 'speech-2.8-turbo';
const DEFAULT_MINIMAX_VOICE_ID = 'male-qn-qingse';

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value?.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(defaultValue: number, ...names: string[]): number {
  const value = readEnv(...names);
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readProvider(): VoiceTtsProviderName {
  const provider = readEnv('VOICE_TTS_PROVIDER')?.toLowerCase();
  if (provider === 'disabled' || provider === 'none' || provider === 'off') return 'disabled';
  if (provider === 'doubao') return 'doubao';
  if (provider === 'minimax') return 'minimax';
  return readEnv('MINIMAX_API_KEY', 'MINIMAX_TTS_API_KEY') ? 'minimax' : 'disabled';
}

function readOutputFormat(): 'mp3' | 'wav' | 'pcm' {
  const value = readEnv('MINIMAX_TTS_FORMAT');
  if (value === 'wav' || value === 'pcm') return value;
  return 'mp3';
}

export function getVoiceTtsConfigStatus(): VoiceTtsConfigStatus {
  const provider = readProvider();
  const endpoint = readEnv('MINIMAX_TTS_ENDPOINT') || DEFAULT_MINIMAX_ENDPOINT;
  const model = readEnv('MINIMAX_TTS_MODEL') || DEFAULT_MINIMAX_MODEL;
  const voiceId = readEnv('MINIMAX_TTS_VOICE_ID') || DEFAULT_MINIMAX_VOICE_ID;
  const outputFormat = readOutputFormat();
  const sampleRate = readNumber(32000, 'MINIMAX_TTS_SAMPLE_RATE');

  if (provider === 'disabled') {
    return {
      configured: false,
      provider,
      missing: ['VOICE_TTS_PROVIDER=minimax', 'MINIMAX_API_KEY'],
      endpoint,
      model,
      voiceId,
      outputFormat,
      sampleRate,
    };
  }
  if (provider === 'doubao') {
    return {
      configured: false,
      provider,
      missing: ['Doubao TTS WebSocket adapter is documented but not enabled in this MVP fallback'],
    };
  }

  const apiKey = readEnv('MINIMAX_API_KEY', 'MINIMAX_TTS_API_KEY');
  return {
    configured: Boolean(apiKey),
    provider,
    missing: apiKey ? [] : ['MINIMAX_API_KEY'],
    endpoint,
    model,
    voiceId,
    outputFormat,
    sampleRate,
  };
}

export function getVoiceTtsConfig(): VoiceTtsConfig | null {
  const status = getVoiceTtsConfigStatus();
  if (!status.configured || status.provider !== 'minimax') return null;

  return {
    provider: 'minimax',
    endpoint: readEnv('MINIMAX_TTS_ENDPOINT') || DEFAULT_MINIMAX_ENDPOINT,
    apiKey: readEnv('MINIMAX_API_KEY', 'MINIMAX_TTS_API_KEY')!,
    model: readEnv('MINIMAX_TTS_MODEL') || DEFAULT_MINIMAX_MODEL,
    voiceId: readEnv('MINIMAX_TTS_VOICE_ID') || DEFAULT_MINIMAX_VOICE_ID,
    outputFormat: readOutputFormat(),
    sampleRate: readNumber(32000, 'MINIMAX_TTS_SAMPLE_RATE'),
    bitrate: readNumber(128000, 'MINIMAX_TTS_BITRATE'),
    speed: readNumber(0.95, 'MINIMAX_TTS_SPEED'),
    volume: readNumber(1, 'MINIMAX_TTS_VOLUME'),
    pitch: readNumber(0, 'MINIMAX_TTS_PITCH'),
    connectTimeoutMs: readNumber(3500, 'MINIMAX_TTS_CONNECT_TIMEOUT_MS'),
    synthesisTimeoutMs: readNumber(12000, 'MINIMAX_TTS_SYNTHESIS_TIMEOUT_MS'),
  };
}

export function mimeTypeForTtsFormat(format: MiniMaxTtsConfig['outputFormat']): string {
  if (format === 'wav') return 'audio/wav';
  if (format === 'pcm') return 'audio/pcm';
  return 'audio/mpeg';
}
