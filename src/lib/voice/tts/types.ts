export type VoiceTtsProviderName = 'minimax' | 'doubao' | 'disabled';

export interface VoiceTtsAudio {
  base64Audio: string;
  mimeType: string;
  provider: VoiceTtsProviderName;
  model?: string;
  voiceId?: string;
  receivedAt: string;
}

export interface VoiceTtsConfigStatus {
  configured: boolean;
  provider: VoiceTtsProviderName;
  missing: string[];
  model?: string;
  voiceId?: string;
}

export interface VoiceTtsSynthesisInput {
  text: string;
}

export interface VoiceTtsSynthesisResult {
  available: boolean;
  audio?: VoiceTtsAudio;
  reason?: string;
}
