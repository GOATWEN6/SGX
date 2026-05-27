import { v4 as uuidv4 } from 'uuid';

export interface DoubaoRealtimeConfig {
  endpoint: string;
  appId: string;
  accessKey: string;
  appKey: string;
  resourceId: string;
  model?: string;
  voice: string;
  systemPrompt: string;
  inputAudioFormat: 'pcm16' | 'opus' | 'webm';
  outputAudioFormat: 'ogg_opus' | 'mp3' | 'pcm';
  outputMimeType: string;
  outputSampleRate: number;
  temperature: number;
  maxTokens: number;
  frameCompression: 'gzip' | 'none';
  sessionParams?: Record<string, unknown>;
  connectTimeoutMs: number;
  enableBinaryProtocolForward: boolean;
}

export interface DoubaoRealtimeConfigStatus {
  configured: boolean;
  missing: string[];
  endpoint: string;
  resourceId: string;
  model?: string;
}

const DEFAULT_ENDPOINT = 'wss://openspeech.bytedance.com/api/v3/realtime/dialogue';
const DEFAULT_RESOURCE_ID = 'volc.speech.dialog';
const DEFAULT_VOICE = 'zh_female_cancan';
const DEFAULT_SYSTEM_PROMPT = '你是一个耐心、简洁、可信赖的银发 AI 语音助手。像打电话一样自然陪老人聊天，避免诊断、开药、金融法律建议。';

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

function readNumber(defaultValue: number, ...names: string[]): number {
  const value = readEnv(...names);
  if (!value) return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function readSessionParams(): Record<string, unknown> | undefined {
  const raw = readEnv('DOUBAO_REALTIME_SESSION_PARAMS_JSON');
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function readFrameCompression(): 'gzip' | 'none' {
  return readEnv('DOUBAO_REALTIME_FRAME_COMPRESSION') === 'none' ? 'none' : 'gzip';
}

function readOutputAudioFormat(): 'ogg_opus' | 'mp3' | 'pcm' {
  const value = readEnv('DOUBAO_REALTIME_OUTPUT_AUDIO_FORMAT');
  if (value === 'mp3' || value === 'pcm') return value;
  return 'ogg_opus';
}

function getOutputMimeType(format: 'ogg_opus' | 'mp3' | 'pcm'): string {
  if (format === 'mp3') return 'audio/mpeg';
  if (format === 'pcm') return 'audio/pcm';
  return 'audio/ogg; codecs=opus';
}

export function getDoubaoRealtimeConfigStatus(): DoubaoRealtimeConfigStatus {
  const endpoint = readEnv('DOUBAO_REALTIME_ENDPOINT', 'VOLC_REALTIME_BASE_URL') || DEFAULT_ENDPOINT;
  const resourceId = readEnv('DOUBAO_REALTIME_RESOURCE_ID', 'VOLC_RESOURCE_ID') || DEFAULT_RESOURCE_ID;
  const appId = readEnv('DOUBAO_REALTIME_APP_ID', 'VOLC_APP_ID');
  const accessKey = readEnv('DOUBAO_REALTIME_ACCESS_KEY', 'VOLC_ACCESS_KEY');
  const appKey = readEnv('DOUBAO_REALTIME_APP_KEY', 'VOLC_APP_KEY');
  const model = readEnv('DOUBAO_REALTIME_MODEL', 'VOLC_REALTIME_MODEL');

  const requiredFields: Array<[string, string | undefined]> = [
    ['DOUBAO_REALTIME_APP_ID or VOLC_APP_ID', appId],
    ['DOUBAO_REALTIME_ACCESS_KEY or VOLC_ACCESS_KEY', accessKey],
    ['DOUBAO_REALTIME_APP_KEY or VOLC_APP_KEY', appKey],
  ];
  const missing = requiredFields.flatMap(([name, value]) => value ? [] : [name]);

  return {
    configured: missing.length === 0,
    missing,
    endpoint,
    resourceId,
    model,
  };
}

export function getDoubaoRealtimeConfig(): DoubaoRealtimeConfig | null {
  const status = getDoubaoRealtimeConfigStatus();
  if (!status.configured) return null;
  const outputAudioFormat = readOutputAudioFormat();

  return {
    endpoint: status.endpoint,
    resourceId: status.resourceId,
    appId: readEnv('DOUBAO_REALTIME_APP_ID', 'VOLC_APP_ID')!,
    accessKey: readEnv('DOUBAO_REALTIME_ACCESS_KEY', 'VOLC_ACCESS_KEY')!,
    appKey: readEnv('DOUBAO_REALTIME_APP_KEY', 'VOLC_APP_KEY')!,
    model: status.model,
    voice: readEnv('DOUBAO_REALTIME_VOICE') || DEFAULT_VOICE,
    systemPrompt: readEnv('DOUBAO_REALTIME_SYSTEM_PROMPT') || DEFAULT_SYSTEM_PROMPT,
    inputAudioFormat: readEnv('DOUBAO_REALTIME_INPUT_AUDIO_FORMAT') === 'pcm16' ? 'pcm16' : 'opus',
    outputAudioFormat,
    outputMimeType: getOutputMimeType(outputAudioFormat),
    outputSampleRate: readNumber(24000, 'DOUBAO_REALTIME_OUTPUT_SAMPLE_RATE'),
    temperature: readNumber(0.4, 'DOUBAO_REALTIME_TEMPERATURE'),
    maxTokens: readNumber(512, 'DOUBAO_REALTIME_MAX_TOKENS'),
    frameCompression: readFrameCompression(),
    sessionParams: readSessionParams(),
    connectTimeoutMs: readNumber(3500, 'DOUBAO_REALTIME_CONNECT_TIMEOUT_MS', 'VOLC_REALTIME_CONNECT_TIMEOUT_MS'),
    enableBinaryProtocolForward: readEnv('DOUBAO_REALTIME_FORWARD_BINARY_PROTOCOL') === 'true',
  };
}

export function buildDoubaoRealtimeHeaders(config: DoubaoRealtimeConfig, connectId = uuidv4()): Record<string, string> {
  return {
    'X-Api-App-ID': config.appId,
    'X-Api-Access-Key': config.accessKey,
    'X-Api-Resource-Id': config.resourceId,
    'X-Api-App-Key': config.appKey,
    'X-Api-Connect-Id': connectId,
  };
}

export function getMaskedDoubaoRealtimeStatus(): DoubaoRealtimeConfigStatus {
  const status = getDoubaoRealtimeConfigStatus();
  return {
    ...status,
    missing: status.missing,
  };
}
