import { v4 as uuidv4 } from 'uuid';

export interface DoubaoRealtimeConfig {
  endpoint: string;
  appId: string;
  accessKey: string;
  appKey: string;
  resourceId: string;
  model?: string;
  connectTimeoutMs: number;
  enableRawAudioForward: boolean;
  enableJsonControlFrames: boolean;
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

function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
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

  return {
    endpoint: status.endpoint,
    resourceId: status.resourceId,
    appId: readEnv('DOUBAO_REALTIME_APP_ID', 'VOLC_APP_ID')!,
    accessKey: readEnv('DOUBAO_REALTIME_ACCESS_KEY', 'VOLC_ACCESS_KEY')!,
    appKey: readEnv('DOUBAO_REALTIME_APP_KEY', 'VOLC_APP_KEY')!,
    model: status.model,
    connectTimeoutMs: Number(readEnv('DOUBAO_REALTIME_CONNECT_TIMEOUT_MS', 'VOLC_REALTIME_CONNECT_TIMEOUT_MS') || 3500),
    enableRawAudioForward: readEnv('DOUBAO_REALTIME_FORWARD_RAW_AUDIO') === 'true',
    enableJsonControlFrames: readEnv('DOUBAO_REALTIME_FORWARD_JSON_EVENTS') === 'true',
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
