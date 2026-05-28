'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, MessageCircle, Mic, Monitor, PhoneOff, Send, Volume2 } from 'lucide-react';
import { authenticatedFetch, clearAuth, getToken, setAuth } from '@/lib/client-auth';
import styles from './voice-assistant.module.css';

type VoiceState = 'booting' | 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  streaming?: boolean;
}

interface MemoryCandidateLite {
  id: string;
  content: string;
  evidenceText: string;
  status: string;
}

interface RealtimeAudioDelta {
  base64Audio: string;
  mimeType: string;
}

interface ServerTtsAudio extends RealtimeAudioDelta {
  provider?: string;
  model?: string;
  voiceId?: string;
}

interface RealtimeTextDelta {
  text: string;
  role?: 'user' | 'assistant';
}

interface RealtimeAppendResponse {
  audioDeltas?: RealtimeAudioDelta[];
  textDeltas?: RealtimeTextDelta[];
  providerForward?: {
    providerConnected: boolean;
    forwarded: boolean;
    reason?: string;
  };
}

const stateLabel: Record<VoiceState, string> = {
  booting: '正在准备',
  idle: '可以开始',
  connecting: '正在连接',
  listening: '正在听您说',
  thinking: '正在想一想',
  speaking: 'AI 正在说话',
  interrupted: '已打断',
  error: '需要重试',
};

const SPEECH_COMMIT_DELAY_MS = 1200;
const SPEECH_COMMIT_DELAY_SECONDS = Math.round(SPEECH_COMMIT_DELAY_MS / 100) / 10;
const SPEECH_RESTART_DELAY_MS = 180;
const REALTIME_PCM_SAMPLE_RATE = 16000;
const REALTIME_PCM_CHANNELS = 1;
const REALTIME_PCM_CHUNK_MS = 120;
const REALTIME_PCM_CHUNK_SAMPLES = Math.round((REALTIME_PCM_SAMPLE_RATE * REALTIME_PCM_CHUNK_MS) / 1000);
const REALTIME_PCM_WORKLET_SOURCE = `
class RealtimePcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length) {
      const copy = new Float32Array(channel.length);
      copy.set(channel);
      this.port.postMessage(copy, [copy.buffer]);
    }
    return true;
  }
}
registerProcessor('realtime-pcm-processor', RealtimePcmProcessor);
`;

function pickBestSpeechRecognitionAlternative(result: any) {
  let bestAlternative = result?.[0];
  for (let index = 1; index < (result?.length || 0); index += 1) {
    const alternative = result[index];
    if ((alternative?.confidence || 0) > (bestAlternative?.confidence || 0)) {
      bestAlternative = alternative;
    }
  }
  return String(bestAlternative?.transcript || '');
}

async function createTestUser(): Promise<string> {
  clearAuth();

  const response = await fetch('/api/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      name: '语音助手测试老人',
      ageGroup: '75-80',
      gender: 'prefer_not_to_say',
      birthPlace: '本地测试',
      useHonorific: true,
      preferredStyle: 'narrative',
      conversationDuration: 10,
      memoirGoal: 'family_heirloom',
    }),
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || '创建测试用户失败');
  }
  setAuth(result.data.token, result.data.user.id);
  return result.data.user.id;
}

async function ensureTestUser(forceFresh = false): Promise<string> {
  if (!forceFresh && getToken()) {
    try {
      const response = await authenticatedFetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get' }),
      });
      const result = await response.json();
      if (result.success && result.data?.user?.id) return result.data.user.id;
    } catch {
      // Fall through and create a clean local test user.
    }
  }
  return createTestUser();
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

function pcm16ToBase64(samples: Int16Array): string {
  return bytesToBase64(new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength));
}

function downsampleFloat32(input: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
  if (sourceSampleRate === targetSampleRate) return new Float32Array(input);
  if (sourceSampleRate < targetSampleRate) return new Float32Array(input);

  const ratio = sourceSampleRate / targetSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(input.length, Math.floor((outputIndex + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += input[inputIndex];
      count += 1;
    }
    output[outputIndex] = count > 0 ? sum / count : input[start] || 0;
  }

  return output;
}

function float32ToPcm16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return output;
}

function base64ToBlob(base64Audio: string, mimeType: string): Blob {
  const binary = window.atob(base64Audio);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function splitForSpeech(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized.match(/[^。！？!?；;，,、\n]+[。！？!?；;，,、\n]?/g) || [normalized];
  const chunks: string[] = [];
  for (const part of parts) {
    let rest = part.trim();
    while (rest.length > 70) {
      chunks.push(rest.slice(0, 70));
      rest = rest.slice(70);
    }
    if (rest) chunks.push(rest);
  }
  return chunks;
}

function shouldFlushSpeechBuffer(text: string): boolean {
  return /[。！？!?；;\n]$/.test(text.trim()) || text.length >= 36;
}

export default function VoiceAssistantPage() {
  const [voiceState, setVoiceState] = useState<VoiceState>('booting');
  const [conversationSessionId, setConversationSessionId] = useState<string | null>(null);
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [realtimeSessionId, setRealtimeSessionId] = useState<string | null>(null);
  const [realtimeFallbackMode, setRealtimeFallbackMode] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [autoBargeInEnabled, setAutoBargeInEnabled] = useState(true);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidateLite[]>([]);

  const recognitionRef = useRef<any>(null);
  const speechQueueRef = useRef<string[]>([]);
  const speechBufferRef = useRef('');
  const displayQueueRef = useRef('');
  const displayTimerRef = useRef<number | null>(null);
  const displayWaitersRef = useRef<Array<() => void>>([]);
  const isSpeechQueueActiveRef = useRef(false);
  const assistantSpeechStartedAtRef = useRef(0);
  const autoConversationRef = useRef(false);
  const suppressRecognitionEndRef = useRef(false);
  const micMeterStreamRef = useRef<MediaStream | null>(null);
  const micMeterContextRef = useRef<AudioContext | null>(null);
  const micMeterAnalyserRef = useRef<AnalyserNode | null>(null);
  const micMeterIntervalRef = useRef<number | null>(null);
  const pendingFinalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const speechCommitTimerRef = useRef<number | null>(null);
  const recognitionRestartTimerRef = useRef<number | null>(null);
  const recognitionActiveRef = useRef(false);
  const voiceStateRef = useRef<VoiceState>('booting');
  const isSpeakingRef = useRef(false);
  const voiceSessionIdRef = useRef<string | null>(null);
  const realtimeSessionIdRef = useRef<string | null>(null);
  const realtimeFallbackModeRef = useRef(true);
  const callActiveRef = useRef(false);
  const messageAbortRef = useRef<AbortController | null>(null);
  const activeTurnIdRef = useRef(0);
  const interruptTimeoutRef = useRef<number | null>(null);
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadContextRef = useRef<AudioContext | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const vadHitCountRef = useRef(0);
  const vadNoiseFloorRef = useRef(0.025);
  const vadStartedAtRef = useRef(0);
  const lastAutoInterruptAtRef = useRef(0);
  const realtimePcmStreamRef = useRef<MediaStream | null>(null);
  const realtimePcmContextRef = useRef<AudioContext | null>(null);
  const realtimePcmSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const realtimePcmWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const realtimePcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const realtimePcmSinkRef = useRef<GainNode | null>(null);
  const realtimePcmWorkletUrlRef = useRef<string | null>(null);
  const realtimePcmQueuedBuffersRef = useRef<Float32Array[]>([]);
  const realtimePcmQueuedSampleCountRef = useRef(0);
  const realtimeUploadPromisesRef = useRef<Promise<void>[]>([]);
  const realtimeChunkSequenceRef = useRef(0);
  const lastProviderForwardReasonRef = useRef('');
  const serverTtsUnavailableNotifiedRef = useRef(false);
  const audioQueueRef = useRef<RealtimeAudioDelta[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const isRealtimeAudioPlayingRef = useRef(false);
  const realtimeOutputPollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    voiceSessionIdRef.current = voiceSessionId;
  }, [voiceSessionId]);

  useEffect(() => {
    realtimeSessionIdRef.current = realtimeSessionId;
  }, [realtimeSessionId]);

  useEffect(() => {
    realtimeFallbackModeRef.current = realtimeFallbackMode;
  }, [realtimeFallbackMode]);

  const stopMicMeter = () => {
    if (micMeterIntervalRef.current !== null) {
      window.clearInterval(micMeterIntervalRef.current);
      micMeterIntervalRef.current = null;
    }
    micMeterStreamRef.current?.getTracks().forEach(track => track.stop());
    micMeterStreamRef.current = null;
    micMeterContextRef.current?.close().catch(() => {});
    micMeterContextRef.current = null;
    micMeterAnalyserRef.current = null;
    setVoiceLevel(0);
  };

  const clearSpeechCommitTimer = () => {
    if (speechCommitTimerRef.current !== null) {
      window.clearTimeout(speechCommitTimerRef.current);
      speechCommitTimerRef.current = null;
    }
  };

  const clearRecognitionRestartTimer = () => {
    if (recognitionRestartTimerRef.current !== null) {
      window.clearTimeout(recognitionRestartTimerRef.current);
      recognitionRestartTimerRef.current = null;
    }
  };

  const buildSpeechDraft = () => [pendingFinalTranscriptRef.current, interimTranscriptRef.current]
    .map(part => part.trim())
    .filter(Boolean)
    .join(' ')
    .trim();

  const updateSpeechDraftInput = () => {
    setInput(buildSpeechDraft());
  };

  const clearSpeechDraft = () => {
    clearSpeechCommitTimer();
    clearRecognitionRestartTimer();
    pendingFinalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
  };

  const scheduleSpeechCommit = () => {
    const pendingText = pendingFinalTranscriptRef.current.trim();
    if (!pendingText) return;
    clearSpeechCommitTimer();
    setNotice(`我会在您停顿约 ${SPEECH_COMMIT_DELAY_SECONDS} 秒后发送，您可以继续补充。`);
    speechCommitTimerRef.current = window.setTimeout(() => {
      void flushSpeechCommit('silence_timeout');
    }, SPEECH_COMMIT_DELAY_MS);
  };

  const flushSpeechCommit = async (reason: 'silence_timeout' | 'manual_stop' = 'silence_timeout') => {
    clearSpeechCommitTimer();
    clearRecognitionRestartTimer();
    const text = pendingFinalTranscriptRef.current.trim() || input.trim();
    if (!text) {
      suppressRecognitionEndRef.current = true;
      recognitionActiveRef.current = false;
      recognitionRef.current?.stop?.();
      stopMicMeter();
      setIsRecording(false);
      setVoiceState('idle');
      return;
    }

    pendingFinalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    suppressRecognitionEndRef.current = true;
    recognitionActiveRef.current = false;
    recognitionRef.current?.stop?.();
    stopMicMeter();
    setIsRecording(false);
    setNotice(reason === 'manual_stop' ? '已发送您刚才说的话。' : '检测到您停顿，已发送完整一句。');
    await sendMessage(text);
  };

  const loadTtsStatus = async (fallbackMode: boolean) => {
    const response = await authenticatedFetch('/api/voice/tts', { method: 'GET' });
    const result = await response.json() as {
      success: boolean;
      data?: {
        status?: {
          configured?: boolean;
          provider?: string;
          model?: string;
          voiceId?: string;
          missing?: string[];
          sampleRate?: number;
          outputFormat?: string;
        };
      };
    };
    if (!result.success) return;

    const status = result.data?.status;
    if (!status?.configured) {
      const missing = status?.missing?.length ? `缺少：${status.missing.join('、')}。` : '';
      setNotice(`当前是浏览器 ASR + 字幕 fallback；未配置高音色 TTS，所以不会出声。${missing}配置 MiniMax TTS 或打通 Doubao realtime audio delta 后再验收声音。`);
      return;
    }
    if (fallbackMode) {
      setNotice(`当前是浏览器 ASR + ${status.provider || 'server'} 高音色 TTS fallback，模型：${status.model || '默认模型'}，音色：${status.voiceId || '默认音色'}，输出：${status.outputFormat || '默认格式'} / ${status.sampleRate || '默认'}Hz。`);
    }
  };

  const startMicMeter = async (existingStream?: MediaStream) => {
    if (!navigator.mediaDevices?.getUserMedia || micMeterIntervalRef.current !== null) return;
    try {
      const stream = existingStream || await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      if (!existingStream) micMeterStreamRef.current = stream;
      micMeterContextRef.current = context;
      micMeterAnalyserRef.current = analyser;

      const samples = new Uint8Array(analyser.fftSize);
      micMeterIntervalRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        setVoiceLevel(Math.min(1, rms * 8));
      }, 80);
    } catch {
      setVoiceLevel(0);
    }
  };

  const stopBargeInMonitor = () => {
    if (vadIntervalRef.current !== null) {
      window.clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }
    vadHitCountRef.current = 0;
    vadStreamRef.current?.getTracks().forEach(track => track.stop());
    vadStreamRef.current = null;
    vadContextRef.current?.close().catch(() => {});
    vadContextRef.current = null;
    vadAnalyserRef.current = null;
    vadNoiseFloorRef.current = 0.025;
    vadStartedAtRef.current = 0;
  };

  const stopSpeakingNow = () => {
    speechQueueRef.current = [];
    speechBufferRef.current = '';
    isSpeechQueueActiveRef.current = false;
    clearRealtimePlayback();
    setIsSpeaking(false);
  };

  const resolveDisplayWaiters = () => {
    const waiters = displayWaitersRef.current;
    displayWaitersRef.current = [];
    waiters.forEach(resolve => resolve());
  };

  const clearAssistantDisplayQueue = () => {
    if (displayTimerRef.current !== null) {
      window.clearTimeout(displayTimerRef.current);
      displayTimerRef.current = null;
    }
    displayQueueRef.current = '';
    resolveDisplayWaiters();
  };

  const interruptSpeech = async (reason: 'user_speech' | 'manual_stop' = 'manual_stop') => {
    activeTurnIdRef.current += 1;
    messageAbortRef.current?.abort();
    clearAssistantDisplayQueue();
    stopSpeakingNow();
    finishAssistantStreaming();
    setVoiceState('interrupted');
    const activeRealtimeSessionId = realtimeSessionIdRef.current;
    if (activeRealtimeSessionId && !realtimeFallbackModeRef.current) {
      await authenticatedFetch('/api/voice/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'interrupt', realtimeSessionId: activeRealtimeSessionId, reason }),
      }).catch(() => {});
    }
    const activeVoiceSessionId = voiceSessionIdRef.current;
    if (activeVoiceSessionId) {
      await authenticatedFetch('/api/voice/session/interrupt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceSessionId: activeVoiceSessionId, reason }),
      }).catch(() => {});
    }
    if (interruptTimeoutRef.current !== null) {
      window.clearTimeout(interruptTimeoutRef.current);
    }
    interruptTimeoutRef.current = window.setTimeout(() => {
      if (callActiveRef.current && voiceStateRef.current === 'interrupted') {
        setVoiceState('listening');
      }
      interruptTimeoutRef.current = null;
    }, 300);
  };

  function clearRealtimePlayback() {
    audioQueueRef.current = [];
    isRealtimeAudioPlayingRef.current = false;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.removeAttribute('src');
      currentAudioRef.current.load();
      currentAudioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
  }

  const playNextRealtimeAudio = () => {
    if (isRealtimeAudioPlayingRef.current || audioQueueRef.current.length === 0 || !callActiveRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next) return;

    const blob = base64ToBlob(next.base64Audio, next.mimeType);
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    currentAudioRef.current = audio;
    currentAudioUrlRef.current = objectUrl;
    isRealtimeAudioPlayingRef.current = true;
    assistantSpeechStartedAtRef.current = Date.now();
    void startBargeInMonitor();
    setIsSpeaking(true);
    setVoiceState('speaking');

    const cleanup = () => {
      isRealtimeAudioPlayingRef.current = false;
      setIsSpeaking(false);
      URL.revokeObjectURL(objectUrl);
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
      if (currentAudioUrlRef.current === objectUrl) currentAudioUrlRef.current = null;
      if (callActiveRef.current && audioQueueRef.current.length > 0) {
        playNextRealtimeAudio();
      } else if (callActiveRef.current && voiceStateRef.current === 'speaking') {
        setVoiceState('listening');
      }
    };

    audio.onended = cleanup;
    audio.onerror = () => {
      cleanup();
      setNotice('实时音频播放失败了，可以先看大字幕或切回文字测试。');
    };
    void audio.play().catch(() => {
      cleanup();
      setNotice('浏览器阻止了实时音频播放，请先点击页面后重试。');
    });
  };

  const enqueueRealtimeAudio = (deltas?: RealtimeAudioDelta[]) => {
    if (!deltas?.length) return;
    audioQueueRef.current.push(...deltas);
    playNextRealtimeAudio();
  };

  const applyRealtimeTextDeltas = (deltas?: RealtimeTextDelta[]) => {
    if (!deltas?.length) return;
    const timestamp = new Date().toISOString();
    setMessages(prev => {
      const next = [...prev];
      for (const delta of deltas) {
        const text = delta.text.trim();
        if (!text) continue;
        if (!delta.role) {
          setInput(text);
          continue;
        }
        const last = next[next.length - 1];
        if (last?.role === delta.role) {
          next[next.length - 1] = { ...last, content: `${last.content}${text}` };
        } else {
          next.push({ role: delta.role, content: text, timestamp });
        }
      }
      return next;
    });
  };

  const trackRealtimeUpload = (promise: Promise<void>) => {
    realtimeUploadPromisesRef.current.push(promise);
    promise.finally(() => {
      const index = realtimeUploadPromisesRef.current.indexOf(promise);
      if (index >= 0) realtimeUploadPromisesRef.current.splice(index, 1);
    });
  };

  const appendRealtimePcm16Chunk = async (samples: Int16Array, durationMs: number) => {
    const activeRealtimeSessionId = realtimeSessionIdRef.current;
    if (!activeRealtimeSessionId) return;

    const response = await authenticatedFetch('/api/voice/realtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'append_audio',
        realtimeSessionId: activeRealtimeSessionId,
        chunk: {
          sequence: realtimeChunkSequenceRef.current,
          base64Audio: pcm16ToBase64(samples),
          format: {
            codec: 'pcm16',
            sampleRate: REALTIME_PCM_SAMPLE_RATE,
            channels: REALTIME_PCM_CHANNELS,
          },
          durationMs,
          capturedAt: new Date().toISOString(),
        },
      }),
    });
    realtimeChunkSequenceRef.current += 1;
    const result = await response.json() as { success: boolean; data?: RealtimeAppendResponse; error?: { message?: string } };
    if (!result.success) throw new Error(result.error?.message || '实时音频上传失败');

    const reason = result.data?.providerForward?.reason || '';
    if (reason && reason !== lastProviderForwardReasonRef.current) {
      lastProviderForwardReasonRef.current = reason;
      if (reason.includes('binary_protocol')) {
        setNotice('音频已经进入服务端 realtime 链路；Doubao 二进制协议转发仍处于保护模式，避免误发错误协议帧。');
      }
    }
    enqueueRealtimeAudio(result.data?.audioDeltas);
    applyRealtimeTextDeltas(result.data?.textDeltas);
  };

  const takeRealtimePcmSamples = (sampleCount: number): Float32Array => {
    const output = new Float32Array(sampleCount);
    let outputOffset = 0;

    while (outputOffset < sampleCount && realtimePcmQueuedBuffersRef.current.length > 0) {
      const head = realtimePcmQueuedBuffersRef.current[0];
      const needed = sampleCount - outputOffset;
      const take = Math.min(needed, head.length);
      output.set(head.subarray(0, take), outputOffset);
      outputOffset += take;

      if (take === head.length) {
        realtimePcmQueuedBuffersRef.current.shift();
      } else {
        realtimePcmQueuedBuffersRef.current[0] = head.subarray(take);
      }
    }

    realtimePcmQueuedSampleCountRef.current = Math.max(0, realtimePcmQueuedSampleCountRef.current - sampleCount);
    return output;
  };

  const queueRealtimePcmUpload = (samples: Float32Array) => {
    const pcm16 = float32ToPcm16(samples);
    const durationMs = Math.round((pcm16.length / REALTIME_PCM_SAMPLE_RATE) * 1000);
    const upload = appendRealtimePcm16Chunk(pcm16, durationMs).catch(error => {
      setVoiceState('error');
      setNotice(error instanceof Error ? error.message : '实时 PCM16 音频上传失败。');
    });
    trackRealtimeUpload(upload);
  };

  const appendRealtimePcmSamples = (samples: Float32Array) => {
    if (!samples.length || !callActiveRef.current) return;
    realtimePcmQueuedBuffersRef.current.push(samples);
    realtimePcmQueuedSampleCountRef.current += samples.length;

    while (realtimePcmQueuedSampleCountRef.current >= REALTIME_PCM_CHUNK_SAMPLES) {
      queueRealtimePcmUpload(takeRealtimePcmSamples(REALTIME_PCM_CHUNK_SAMPLES));
    }
  };

  const flushRealtimePcmTail = () => {
    const sampleCount = realtimePcmQueuedSampleCountRef.current;
    if (sampleCount < Math.round(REALTIME_PCM_SAMPLE_RATE * 0.04)) {
      realtimePcmQueuedBuffersRef.current = [];
      realtimePcmQueuedSampleCountRef.current = 0;
      return;
    }
    queueRealtimePcmUpload(takeRealtimePcmSamples(sampleCount));
  };

  const handleRealtimePcmInput = (samples: Float32Array, sourceSampleRate: number) => {
    const downsampled = downsampleFloat32(samples, sourceSampleRate, REALTIME_PCM_SAMPLE_RATE);
    appendRealtimePcmSamples(downsampled);
  };

  const stopRealtimeOutputPolling = () => {
    if (realtimeOutputPollIntervalRef.current !== null) {
      window.clearInterval(realtimeOutputPollIntervalRef.current);
      realtimeOutputPollIntervalRef.current = null;
    }
  };

  const pollRealtimeOutput = async () => {
    const activeRealtimeSessionId = realtimeSessionIdRef.current;
    if (!activeRealtimeSessionId || realtimeFallbackModeRef.current || !callActiveRef.current) return;
    const response = await authenticatedFetch('/api/voice/realtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'poll_output', realtimeSessionId: activeRealtimeSessionId }),
    });
    const result = await response.json() as { success: boolean; data?: { audioDeltas?: RealtimeAudioDelta[]; textDeltas?: RealtimeTextDelta[] } };
    if (result.success) {
      enqueueRealtimeAudio(result.data?.audioDeltas);
      applyRealtimeTextDeltas(result.data?.textDeltas);
    }
  };

  const startRealtimeOutputPolling = () => {
    stopRealtimeOutputPolling();
    realtimeOutputPollIntervalRef.current = window.setInterval(() => {
      pollRealtimeOutput().catch(() => {});
    }, 350);
  };

  const commitRealtimeTurn = async () => {
    const activeRealtimeSessionId = realtimeSessionIdRef.current;
    if (!activeRealtimeSessionId) return;
    await authenticatedFetch('/api/voice/realtime', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'commit_turn', realtimeSessionId: activeRealtimeSessionId }),
    }).catch(() => {});
  };

  const stopRealtimeCapture = async (commitTurn = true) => {
    realtimePcmWorkletNodeRef.current?.port.close();
    realtimePcmWorkletNodeRef.current?.disconnect();
    realtimePcmWorkletNodeRef.current = null;
    realtimePcmProcessorRef.current?.disconnect();
    realtimePcmProcessorRef.current = null;
    realtimePcmSourceRef.current?.disconnect();
    realtimePcmSourceRef.current = null;
    realtimePcmSinkRef.current?.disconnect();
    realtimePcmSinkRef.current = null;
    if (realtimePcmWorkletUrlRef.current) {
      URL.revokeObjectURL(realtimePcmWorkletUrlRef.current);
      realtimePcmWorkletUrlRef.current = null;
    }
    realtimePcmStreamRef.current?.getTracks().forEach(track => track.stop());
    realtimePcmStreamRef.current = null;
    await realtimePcmContextRef.current?.close().catch(() => {});
    realtimePcmContextRef.current = null;
    if (commitTurn) {
      flushRealtimePcmTail();
      await Promise.allSettled(realtimeUploadPromisesRef.current);
    } else {
      realtimePcmQueuedBuffersRef.current = [];
      realtimePcmQueuedSampleCountRef.current = 0;
    }
    stopMicMeter();
    setIsRecording(false);
    if (voiceStateRef.current === 'listening') setVoiceState(commitTurn ? 'thinking' : 'idle');
    if (commitTurn) await commitRealtimeTurn();
  };

  const startRealtimeCapture = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setNotice('当前浏览器不能采集实时音频，请先用文字或浏览器语音识别测试。');
      return;
    }
    if (realtimePcmContextRef.current) {
      await stopRealtimeCapture(true);
      return;
    }
    if (isSpeakingRef.current) await interruptSpeech('user_speech');

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      setNotice('当前浏览器不支持 Web Audio PCM16 采集，请先用文字或浏览器 ASR fallback 测试。');
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: REALTIME_PCM_CHANNELS,
        sampleRate: REALTIME_PCM_SAMPLE_RATE,
      },
    });
    let context: AudioContext;
    try {
      context = new AudioContextCtor({ sampleRate: REALTIME_PCM_SAMPLE_RATE });
    } catch {
      context = new AudioContextCtor();
    }
    await context.resume().catch(() => {});

    realtimePcmStreamRef.current = stream;
    realtimePcmContextRef.current = context;
    await startMicMeter(stream);
    realtimeChunkSequenceRef.current = 0;
    realtimePcmQueuedBuffersRef.current = [];
    realtimePcmQueuedSampleCountRef.current = 0;
    realtimeUploadPromisesRef.current = [];
    lastProviderForwardReasonRef.current = '';

    const source = context.createMediaStreamSource(stream);
    const sink = context.createGain();
    sink.gain.value = 0;
    realtimePcmSourceRef.current = source;
    realtimePcmSinkRef.current = sink;

    if (context.audioWorklet) {
      const workletUrl = URL.createObjectURL(new Blob([REALTIME_PCM_WORKLET_SOURCE], { type: 'application/javascript' }));
      realtimePcmWorkletUrlRef.current = workletUrl;
      await context.audioWorklet.addModule(workletUrl);
      const workletNode = new AudioWorkletNode(context, 'realtime-pcm-processor');
      workletNode.port.onmessage = event => {
        if (!callActiveRef.current || !realtimePcmContextRef.current) return;
        handleRealtimePcmInput(event.data as Float32Array, context.sampleRate);
      };
      realtimePcmWorkletNodeRef.current = workletNode;
      source.connect(workletNode);
      workletNode.connect(sink);
    } else {
      const processor = context.createScriptProcessor(4096, REALTIME_PCM_CHANNELS, REALTIME_PCM_CHANNELS);
      processor.onaudioprocess = event => {
        if (!callActiveRef.current || !realtimePcmContextRef.current) return;
        handleRealtimePcmInput(event.inputBuffer.getChannelData(0), context.sampleRate);
      };
      realtimePcmProcessorRef.current = processor;
      source.connect(processor);
      processor.connect(sink);
    }
    sink.connect(context.destination);

    setIsRecording(true);
    setVoiceState('listening');
    setNotice(`正在把麦克风 PCM16 ${REALTIME_PCM_SAMPLE_RATE / 1000}kHz 音频发送到 Doubao realtime 链路。`);
  };

  const startBargeInMonitor = async () => {
    if (!autoBargeInEnabled || !navigator.mediaDevices?.getUserMedia || vadIntervalRef.current !== null) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextCtor();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      vadStreamRef.current = stream;
      vadContextRef.current = context;
      vadAnalyserRef.current = analyser;
      vadNoiseFloorRef.current = 0.025;
      vadStartedAtRef.current = Date.now();

      const samples = new Uint8Array(analyser.fftSize);
      vadIntervalRef.current = window.setInterval(() => {
        if (!isSpeakingRef.current || voiceStateRef.current !== 'speaking') {
          vadHitCountRef.current = 0;
          return;
        }
        const elapsedFromAssistant = Date.now() - assistantSpeechStartedAtRef.current;
        const elapsedFromVad = Date.now() - vadStartedAtRef.current;
        if (elapsedFromAssistant < 900 || elapsedFromVad < 700) {
          vadHitCountRef.current = 0;
          analyser.getByteTimeDomainData(samples);
          let calibrationSum = 0;
          for (let i = 0; i < samples.length; i += 1) {
            const centered = (samples[i] - 128) / 128;
            calibrationSum += centered * centered;
          }
          const calibrationRms = Math.sqrt(calibrationSum / samples.length);
          vadNoiseFloorRef.current = Math.max(0.018, vadNoiseFloorRef.current * 0.88 + calibrationRms * 0.12);
          return;
        }
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        const dynamicThreshold = Math.max(0.055, vadNoiseFloorRef.current * 2.8 + 0.025);
        if (rms > dynamicThreshold) {
          vadHitCountRef.current += 1;
        } else {
          vadHitCountRef.current = Math.max(0, vadHitCountRef.current - 1);
          vadNoiseFloorRef.current = Math.max(0.018, vadNoiseFloorRef.current * 0.94 + rms * 0.06);
        }
        if (vadHitCountRef.current >= 4 && Date.now() - lastAutoInterruptAtRef.current > 1600) {
          lastAutoInterruptAtRef.current = Date.now();
          vadHitCountRef.current = 0;
          stopBargeInMonitor();
          void interruptSpeech('user_speech').then(() => {
            setNotice('检测到您在说话，我已经停下，正在听您说。');
            window.setTimeout(() => {
              if (callActiveRef.current && !isRecording && voiceStateRef.current !== 'error') {
                startListening({ auto: true });
              }
            }, 220);
          });
        }
      }, 120);
    } catch {
      setAutoBargeInEnabled(false);
      setNotice('浏览器没有开放麦克风，自动语音打断暂时关闭；文字输入和手动麦克风仍可继续测试。');
      stopBargeInMonitor();
    }
  };

  const restartListeningAfterSpeech = () => {
    if (!callActiveRef.current || !autoConversationRef.current || voiceStateRef.current === 'error') return;
    window.setTimeout(() => {
      if (
        callActiveRef.current
        && autoConversationRef.current
        && !isSpeakingRef.current
        && !isRecording
        && realtimeFallbackModeRef.current
      ) {
        startListening({ auto: true });
      }
    }, 260);
  };

  const playServerTtsAudio = (audioDelta: ServerTtsAudio) => {
    const blob = base64ToBlob(audioDelta.base64Audio, audioDelta.mimeType);
    const objectUrl = URL.createObjectURL(blob);
    const audio = new Audio(objectUrl);
    currentAudioRef.current = audio;
    currentAudioUrlRef.current = objectUrl;
    assistantSpeechStartedAtRef.current = Date.now();
    void startBargeInMonitor();
    setIsSpeaking(true);
    setVoiceState('speaking');

    const cleanup = () => {
      isSpeechQueueActiveRef.current = false;
      URL.revokeObjectURL(objectUrl);
      if (currentAudioRef.current === audio) currentAudioRef.current = null;
      if (currentAudioUrlRef.current === objectUrl) currentAudioUrlRef.current = null;
      if (callActiveRef.current) {
        window.setTimeout(playNextSpeechChunk, 60);
      }
    };

    audio.onended = cleanup;
    audio.onerror = () => {
      cleanup();
      setNotice('高音色 TTS 音频播放失败了，本轮先看大字幕。');
    };
    void audio.play().catch(() => {
      cleanup();
      setNotice('浏览器阻止了服务端 TTS 音频播放，请先点击页面后重试。');
    });
  };

  const synthesizeServerSpeech = async (text: string): Promise<ServerTtsAudio | null> => {
    const response = await authenticatedFetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const result = await response.json() as {
      success: boolean;
      data?: { available?: boolean; audio?: ServerTtsAudio; reason?: string };
      error?: { message?: string };
    };
    if (!result.success) {
      throw new Error(result.error?.message || '高音色 TTS 合成失败');
    }
    if (!result.data?.available || !result.data.audio) {
      if (!serverTtsUnavailableNotifiedRef.current) {
        serverTtsUnavailableNotifiedRef.current = true;
        setNotice('高音色 TTS 未配置，本轮只显示大字幕；请配置 MiniMax 或豆包 TTS 后再验收音色。');
      }
      return null;
    }
    return result.data.audio;
  };

  function playNextSpeechChunk() {
    if (isSpeechQueueActiveRef.current || !callActiveRef.current) return;
    const next = speechQueueRef.current.shift();
    if (!next) {
      setIsSpeaking(false);
      if (voiceStateRef.current === 'speaking') setVoiceState('listening');
      restartListeningAfterSpeech();
      return;
    }

    isSpeechQueueActiveRef.current = true;
    synthesizeServerSpeech(next)
      .then(audioDelta => {
        if (!callActiveRef.current) return;
        if (!audioDelta) {
          isSpeechQueueActiveRef.current = false;
          setIsSpeaking(false);
          if (voiceStateRef.current === 'speaking') setVoiceState('listening');
          window.setTimeout(playNextSpeechChunk, 30);
          return;
        }
        playServerTtsAudio(audioDelta);
      })
      .catch(error => {
        isSpeechQueueActiveRef.current = false;
        setIsSpeaking(false);
        setNotice(error instanceof Error ? error.message : '高音色 TTS 合成失败，本轮先看大字幕。');
        window.setTimeout(playNextSpeechChunk, 80);
      });
  }

  const enqueueSpeechText = (text: string) => {
    const chunks = splitForSpeech(text);
    if (!chunks.length) return;
    speechQueueRef.current.push(...chunks);
    playNextSpeechChunk();
  };

  const queueSpeechDelta = (text: string, flush = false) => {
    speechBufferRef.current += text;
    if (flush || shouldFlushSpeechBuffer(speechBufferRef.current)) {
      const next = speechBufferRef.current;
      speechBufferRef.current = '';
      enqueueSpeechText(next);
    }
  };

  const revealNextDisplayChar = () => {
    if (!callActiveRef.current) {
      clearAssistantDisplayQueue();
      return;
    }

    const nextChar = displayQueueRef.current.slice(0, 1);
    displayQueueRef.current = displayQueueRef.current.slice(1);

    if (nextChar) {
      appendAssistantDelta(nextChar);
      const delay = /[，。！？；,.!?;]/.test(nextChar) ? 70 : 22;
      displayTimerRef.current = window.setTimeout(revealNextDisplayChar, delay);
      return;
    }

    displayTimerRef.current = null;
    resolveDisplayWaiters();
  };

  const enqueueAssistantDisplayDelta = (text: string) => {
    if (!text) return;
    displayQueueRef.current += text;
    if (displayTimerRef.current === null) {
      revealNextDisplayChar();
    }
  };

  const waitForAssistantDisplayQueue = () => new Promise<void>(resolve => {
    if (!displayQueueRef.current && displayTimerRef.current === null) {
      resolve();
      return;
    }
    displayWaitersRef.current.push(resolve);
  });

  const speakText = (text: string) => {
    speechQueueRef.current = [];
    speechBufferRef.current = '';
    isSpeechQueueActiveRef.current = false;
    enqueueSpeechText(text);
  };

  function appendAssistantDelta(text: string) {
    setMessages(prev => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === 'assistant' && last.streaming) {
        next[next.length - 1] = { ...last, content: `${last.content}${text}` };
      } else {
        next.push({ role: 'assistant', content: text, timestamp: new Date().toISOString(), streaming: true });
      }
      return next;
    });
  }

  const finishAssistantStreaming = () => {
    setMessages(prev => prev.map((message, index) => (
      index === prev.length - 1 && message.role === 'assistant'
        ? { ...message, streaming: false }
        : message
    )));
  };

  const isCurrentTurn = (turnId: number, abortController: AbortController) => (
    callActiveRef.current
    && activeTurnIdRef.current === turnId
    && !abortController.signal.aborted
  );

  const boot = async () => {
    setVoiceState('booting');
    setNotice('');
    try {
      await ensureTestUser();
      const createSession = async () => {
        const response = await authenticatedFetch('/api/conversation/session/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'web_voice_call', conversationType: 'ai_chat' }),
        });
        return response.json();
      };
      let sessionResult = await createSession();
      if (!sessionResult.success && sessionResult.error?.code === 'UNAUTHORIZED') {
        await ensureTestUser(true);
        sessionResult = await createSession();
      }
      if (!sessionResult.success) throw new Error(sessionResult.error?.message || '创建对话失败');
      const nextConversationId = sessionResult.data.session.id;
      setConversationSessionId(nextConversationId);

      const voiceResponse = await authenticatedFetch('/api/voice/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationSessionId: nextConversationId }),
      });
      const voiceResult = await voiceResponse.json();
      if (!voiceResult.success) throw new Error(voiceResult.error?.message || '创建语音会话失败');
      setVoiceSessionId(voiceResult.data.voiceSession.id);
      callActiveRef.current = true;

      if (voiceResult.data.voiceSession.fallbackMode) {
        setRealtimeFallbackMode(true);
        realtimeFallbackModeRef.current = true;
        setNotice('当前是浏览器 ASR + 服务端高音色 TTS/字幕 fallback，不是真实豆包实时语音流。');
        void loadTtsStatus(true).catch(() => {});
      } else {
        const realtimeResponse = await authenticatedFetch('/api/voice/realtime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create',
            conversationSessionId: nextConversationId,
            connectProvider: true,
            inputFormat: { codec: 'pcm16', sampleRate: REALTIME_PCM_SAMPLE_RATE, channels: REALTIME_PCM_CHANNELS },
          }),
        });
        const realtimeResult = await realtimeResponse.json();
        if (!realtimeResult.success) throw new Error(realtimeResult.error?.message || '创建实时语音链路失败');
        setRealtimeSessionId(realtimeResult.data.realtimeSession.id);
        const nextFallbackMode = Boolean(realtimeResult.data.realtimeSession.fallbackMode);
        setRealtimeFallbackMode(nextFallbackMode);
        realtimeFallbackModeRef.current = nextFallbackMode;
        if (!nextFallbackMode) startRealtimeOutputPolling();
        const providerReason = realtimeResult.data.providerConnection?.reason;
        setNotice(providerReason
          ? `实时语音链路已建立服务端会话：${providerReason}`
          : '实时语音链路已建立，点击开始说话会发送音频 chunk 到服务端。');
        if (nextFallbackMode) void loadTtsStatus(true).catch(() => {});
      }

      const greeting = '您好，我是这个页面里的 AI 语音助手。您可以直接说话，也可以打字测试。';
      setMessages([{ role: 'assistant', content: greeting, timestamp: new Date().toISOString() }]);
      setVoiceState('idle');
    } catch (error) {
      setVoiceState('error');
      setNotice(error instanceof Error ? error.message : '启动失败，请检查配置后刷新。');
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'zh-CN';
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.maxAlternatives = 3;
    }
    boot();
    return () => {
      callActiveRef.current = false;
      messageAbortRef.current?.abort();
      clearSpeechDraft();
      clearAssistantDisplayQueue();
      recognitionRef.current?.abort?.();
      recognitionActiveRef.current = false;
      stopSpeakingNow();
      stopBargeInMonitor();
      stopRealtimeCapture(false).catch(() => {});
      stopRealtimeOutputPolling();
      stopMicMeter();
      clearRealtimePlayback();
    };
    // The standalone test call should boot exactly once per page entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || !conversationSessionId) return;
    if (isSpeakingRef.current) await interruptSpeech('user_speech');

    clearSpeechDraft();
    messageAbortRef.current?.abort();
    const turnId = activeTurnIdRef.current + 1;
    activeTurnIdRef.current = turnId;
    clearAssistantDisplayQueue();
    setInput('');
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text, timestamp: new Date().toISOString() },
      { role: 'assistant', content: '', timestamp: new Date().toISOString(), streaming: true },
    ]);
    setVoiceState('thinking');
    const abortController = new AbortController();
    messageAbortRef.current = abortController;

    try {
      const response = await authenticatedFetch('/api/conversation/message/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: conversationSessionId, message: text }),
        signal: abortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('流式回复启动失败');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!isCurrentTurn(turnId, abortController)) {
          await reader.cancel().catch(() => {});
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() || '';

        for (const block of blocks) {
          if (!isCurrentTurn(turnId, abortController)) {
            await reader.cancel().catch(() => {});
            return;
          }
          const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
          const dataText = block.match(/^data:\s*(.+)$/m)?.[1];
          if (!event || !dataText) continue;
          const data = JSON.parse(dataText);

          if (event === 'status') {
            if (voiceStateRef.current !== 'thinking') setVoiceState('thinking');
            if (typeof data.message === 'string') setNotice(data.message);
          }
          if (event === 'delta' && typeof data.text === 'string') {
            if (voiceStateRef.current === 'thinking') setVoiceState('speaking');
            enqueueAssistantDisplayDelta(data.text);
            queueSpeechDelta(data.text);
          }
          if (event === 'done') {
            finalData = data.data;
          }
          if (event === 'error') {
            throw new Error(data.message || '流式回复失败');
          }
        }
      }

      if (!isCurrentTurn(turnId, abortController)) return;
      queueSpeechDelta('', true);
      await waitForAssistantDisplayQueue();
      if (!isCurrentTurn(turnId, abortController)) return;
      finishAssistantStreaming();

      if (finalData?.memoryCandidates?.length) {
        setMemoryCandidates(prev => [...finalData.memoryCandidates, ...prev]);
      }
      if (finalData?.usedWebSearch && !finalData.citations?.length) {
        setNotice('本轮识别为联网问题，但搜索服务未配置，因此没有实时来源。');
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        if (isCurrentTurn(turnId, abortController)) {
          clearAssistantDisplayQueue();
          finishAssistantStreaming();
          queueSpeechDelta('', true);
        }
        return;
      }
      if (!isCurrentTurn(turnId, abortController)) return;
      finishAssistantStreaming();
      setVoiceState('error');
      setNotice(error instanceof Error ? error.message : '发送失败，请稍后再试。');
    }
  };

  const startListening = async (options: { auto?: boolean; preserveDraft?: boolean } = {}) => {
    autoConversationRef.current = true;
    if (realtimeSessionIdRef.current && !realtimeFallbackModeRef.current) {
      startRealtimeCapture().catch(error => {
        setVoiceState('error');
        setNotice(error instanceof Error ? error.message : '实时语音采集失败。');
      });
      return;
    }
    if (!recognitionRef.current) {
      setNotice('当前浏览器不支持语音识别，请先用文字输入测试。');
      return;
    }
    if ((isRecording || recognitionActiveRef.current) && !options.preserveDraft) {
      void flushSpeechCommit('manual_stop');
      return;
    }
    if (isSpeakingRef.current || voiceStateRef.current === 'thinking') await interruptSpeech('user_speech');

    if (!options.preserveDraft) clearSpeechDraft();
    suppressRecognitionEndRef.current = false;
    recognitionRef.current.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = pickBestSpeechRecognitionAlternative(event.results[i]);
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }

      if (interimText.trim()) {
        clearSpeechCommitTimer();
        interimTranscriptRef.current = interimText;
        updateSpeechDraftInput();
        if (pendingFinalTranscriptRef.current.trim()) {
          setNotice('我还在听，您可以继续把这句话说完。');
        }
      }

      if (finalText.trim()) {
        const nextFinal = [pendingFinalTranscriptRef.current, finalText]
          .map(part => part.trim())
          .filter(Boolean)
          .join(' ');
        pendingFinalTranscriptRef.current = nextFinal;
        interimTranscriptRef.current = '';
        updateSpeechDraftInput();
        scheduleSpeechCommit();
      }
    };
    recognitionRef.current.onerror = (event: any) => {
      const errorMap: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝了，请在浏览器设置里允许麦克风。',
        'service-not-allowed': '浏览器暂时不允许使用语音识别服务，可以先打字。',
        'audio-capture': '没有检测到可用麦克风。',
        'no-speech': '我没有听到声音，可以靠近一点再说。',
      };
      setNotice(errorMap[event.error] || '我没听清，可以再试一次。');
      setIsRecording(false);
      stopMicMeter();
      if (options.auto) {
        setVoiceState('idle');
        return;
      }
      setVoiceState('error');
    };
    recognitionRef.current.onend = () => {
      recognitionActiveRef.current = false;
      setIsRecording(false);
      stopMicMeter();
      if (
        !suppressRecognitionEndRef.current
        && callActiveRef.current
        && autoConversationRef.current
        && realtimeFallbackModeRef.current
        && voiceStateRef.current === 'listening'
        && pendingFinalTranscriptRef.current.trim()
      ) {
        clearRecognitionRestartTimer();
        recognitionRestartTimerRef.current = window.setTimeout(() => {
          if (
            callActiveRef.current
            && autoConversationRef.current
            && realtimeFallbackModeRef.current
            && voiceStateRef.current === 'listening'
            && pendingFinalTranscriptRef.current.trim()
          ) {
            startListening({ auto: true, preserveDraft: true });
          }
        }, SPEECH_RESTART_DELAY_MS);
        return;
      }
      if (voiceStateRef.current === 'listening' && !suppressRecognitionEndRef.current) {
        setVoiceState(options.auto ? 'listening' : 'idle');
      }
      suppressRecognitionEndRef.current = false;
    };
    startMicMeter().catch(() => {});
    try {
      recognitionRef.current.start();
      recognitionActiveRef.current = true;
      setIsRecording(true);
      setVoiceState('listening');
      setNotice(options.preserveDraft ? '我还在听，短暂停顿不会马上发送。' : `正在听您说。停顿约 ${SPEECH_COMMIT_DELAY_SECONDS} 秒后会自动发送，也可以点麦克风手动发送。`);
    } catch {
      recognitionActiveRef.current = false;
      setNotice('语音识别正在启动，请稍等一秒再试。');
    }
  };

  const endCall = async () => {
    callActiveRef.current = false;
    activeTurnIdRef.current += 1;
    messageAbortRef.current?.abort();
    clearSpeechDraft();
    clearAssistantDisplayQueue();
    recognitionRef.current?.abort?.();
    recognitionActiveRef.current = false;
    stopSpeakingNow();
    stopBargeInMonitor();
    await stopRealtimeCapture(false);
    stopRealtimeOutputPolling();
    stopMicMeter();
    clearRealtimePlayback();
    const activeRealtimeSessionId = realtimeSessionIdRef.current;
    if (activeRealtimeSessionId) {
      await authenticatedFetch('/api/voice/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', realtimeSessionId: activeRealtimeSessionId }),
      }).catch(() => {});
      setRealtimeSessionId(null);
      setRealtimeFallbackMode(true);
    }
    if (conversationSessionId) {
      await authenticatedFetch('/api/conversation/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: conversationSessionId }),
      }).catch(() => {});
    }
    if (voiceSessionId) {
      await authenticatedFetch('/api/voice/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceSessionId }),
      }).catch(() => {});
    }
    await boot();
  };

  const updateMemoryCandidate = async (candidateId: string, action: 'confirm' | 'reject') => {
    const response = await authenticatedFetch(`/api/memory/candidates/${candidateId}/${action}`, { method: 'POST' });
    const result = await response.json();
    if (!result.success) {
      setNotice(result.error?.message || '候选记忆操作失败');
      return;
    }
    setMemoryCandidates(prev => prev.map(candidate => (
      candidate.id === candidateId ? { ...candidate, status: result.data.candidate.status } : candidate
    )));
  };

  const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant');
  const lastUser = [...messages].reverse().find(message => message.role === 'user');

  return (
    <main className={styles.page}>
      <section className={styles.callWindow}>
        <header className={styles.windowBar}>
          <div className={styles.windowDots} aria-hidden="true">
            <span />
            <span />
          </div>
          <div className={styles.status} role="status" aria-live="polite">
            <span className={`${styles.statusDot} ${styles[`state_${voiceState}`] || ''}`} />
            {stateLabel[voiceState]}
          </div>
        </header>

        {notice && <div className={styles.notice} role="alert">{notice}</div>}

        <section className={styles.stage} aria-label="AI 语音助手通话区">
          <div
            className={`${styles.animeAvatar} ${isSpeaking ? styles.animeAvatarSpeaking : ''} ${isRecording ? styles.animeAvatarListening : ''}`}
            aria-hidden="true"
            data-testid="anime-avatar"
          >
            <div className={styles.avatarGlow} />
            <svg className={styles.avatarSvg} viewBox="0 0 240 240" role="img">
              <defs>
                <radialGradient id="avatarBacklight" cx="50%" cy="36%" r="66%">
                  <stop offset="0%" stopColor="#f8fbff" />
                  <stop offset="58%" stopColor="#cfe9ff" />
                  <stop offset="100%" stopColor="#a9d1ff" />
                </radialGradient>
                <linearGradient id="avatarSkin" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffe4cf" />
                  <stop offset="100%" stopColor="#f5ad86" />
                </linearGradient>
                <linearGradient id="avatarHair" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#2e1b15" />
                  <stop offset="56%" stopColor="#53301e" />
                  <stop offset="100%" stopColor="#22120e" />
                </linearGradient>
                <linearGradient id="avatarSweater" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#263846" />
                  <stop offset="100%" stopColor="#111923" />
                </linearGradient>
              </defs>
              <circle cx="120" cy="112" r="94" fill="url(#avatarBacklight)" />
              <ellipse className={styles.avatarShadow} cx="120" cy="213" rx="52" ry="12" fill="#8eb8e1" opacity="0.22" />
              <path d="M64 218c8-34 28-51 56-51s48 17 56 51H64z" fill="url(#avatarSweater)" />
              <path d="M82 188c9 18 25 29 38 29s29-11 38-29" fill="none" stroke="#f8fbff" strokeWidth="6" strokeLinecap="round" opacity="0.88" />
              <g className={styles.avatarHead}>
                <path className={styles.avatarHairBack} d="M57 117c0-51 27-84 66-84 38 0 65 29 65 78 0 47-26 77-66 77-39 0-65-28-65-71z" fill="url(#avatarHair)" />
                <path d="M75 118c0-41 19-67 50-67 31 0 51 27 51 68 0 39-22 66-51 66-30 0-50-26-50-67z" fill="url(#avatarSkin)" />
                <path className={styles.avatarFringe} d="M58 108c3-46 27-77 66-77 35 0 62 27 65 67-23-9-42-28-48-54-11 38-40 62-83 64z" fill="url(#avatarHair)" />
                <path d="M78 116c8-4 19-4 27 0" fill="none" stroke="#2c1a14" strokeWidth="5" strokeLinecap="round" opacity="0.72" />
                <path d="M136 116c8-4 19-4 27 0" fill="none" stroke="#2c1a14" strokeWidth="5" strokeLinecap="round" opacity="0.72" />
                <g className={styles.avatarEyes}>
                  <ellipse cx="93" cy="131" rx="12" ry="16" fill="#211510" />
                  <ellipse cx="149" cy="131" rx="12" ry="16" fill="#211510" />
                  <circle cx="89" cy="126" r="4" fill="#fff" opacity="0.92" />
                  <circle cx="145" cy="126" r="4" fill="#fff" opacity="0.92" />
                  <circle cx="97" cy="137" r="3" fill="#a77b5f" opacity="0.72" />
                  <circle cx="153" cy="137" r="3" fill="#a77b5f" opacity="0.72" />
                </g>
                <ellipse cx="73" cy="147" rx="12" ry="8" fill="#f29a94" opacity="0.38" />
                <ellipse cx="170" cy="147" rx="12" ry="8" fill="#f29a94" opacity="0.38" />
                <g className={styles.avatarMouth}>
                  <path className={styles.mouthSmile} d="M106 158c8 9 22 9 30 0" fill="none" stroke="#a55457" strokeWidth="4" strokeLinecap="round" />
                  <ellipse className={styles.mouthOpen} cx="121" cy="160" rx="12" ry="8" fill="#7d3137" />
                  <ellipse className={styles.mouthWide} cx="121" cy="160" rx="17" ry="6" fill="#7d3137" />
                </g>
              </g>
            </svg>
            <div className={styles.avatarListeningRing} />
          </div>

          <div className={styles.soundWave} aria-hidden="true">
            {[0, 1, 2, 3, 4].map(index => (
              <span
                key={index}
                style={{ transform: `scaleY(${Math.max(0.18, isRecording ? voiceLevel + index * 0.08 : isSpeaking ? 0.45 + index * 0.08 : 0.22)})` }}
              />
            ))}
          </div>

          <p className={styles.promptText}>
            {voiceState === 'listening'
              ? '请开始说话'
              : voiceState === 'speaking'
                ? '我正在回答，您直接说话即可打断'
                : voiceState === 'thinking'
                  ? '正在生成回复'
                  : '点击麦克风开始'}
          </p>
        </section>

        <section className={styles.callControls} aria-label="语音控制">
          <button className={styles.iconButton} type="button" title="界面预览">
            <Monitor size={28} />
          </button>
          <button
            className={`${styles.iconButton} ${showCaptions ? styles.iconButtonActive : ''}`}
            type="button"
            title={showCaptions ? '隐藏字幕' : '显示字幕'}
            onClick={() => setShowCaptions(value => !value)}
          >
            <MessageCircle size={28} />
          </button>
          <button
            className={`${styles.micButton} ${isRecording ? styles.micButtonActive : ''}`}
            onClick={() => startListening()}
            disabled={voiceState === 'booting'}
            title={isRecording ? '停止听' : voiceState === 'speaking' ? '打断并说话' : '开始说话'}
          >
            <Mic size={34} />
          </button>
          <button
            className={`${styles.iconButton} ${autoBargeInEnabled ? styles.iconButtonActive : ''}`}
            type="button"
            title={autoBargeInEnabled ? '自动语音打断已开启' : '开启自动语音打断'}
            onClick={() => setAutoBargeInEnabled(value => !value)}
          >
            <Activity size={28} />
          </button>
          <button className={styles.hangupButton} onClick={endCall} title="挂断并重开">
            <PhoneOff size={30} />
          </button>
        </section>

        {showCaptions && (
          <section className={styles.captionPanel} aria-label="对话字幕">
            <p className={styles.assistantText}>{lastAssistant?.content || '正在准备语音助手。'}</p>
            {lastUser && <p className={styles.userText}>我听到的是：{lastUser.content}</p>}
          </section>
        )}

        {showCaptions && (
          <section className={styles.textFallback} aria-label="文字输入">
            <textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder="麦克风不好用？在这里打字测试"
              rows={2}
            />
            <button onClick={() => sendMessage()} disabled={!input.trim() || voiceState === 'thinking'}>
              <Send size={22} />
              发送
            </button>
          </section>
        )}

        {showCaptions && (
          <section className={styles.transcript} aria-label="最近对话记录">
            {messages.slice(-6).map((message, index) => (
              <div key={`${message.timestamp}-${index}`} className={message.role === 'assistant' ? styles.assistantBubble : styles.userBubble}>
                {message.role === 'assistant' && <Volume2 size={18} />}
                <span>{message.content || (message.streaming ? '...' : '')}</span>
              </div>
            ))}
          </section>
        )}

        {memoryCandidates.length > 0 && (
          <aside className={styles.memoryPanel}>
            <h2>候选记忆确认</h2>
            {memoryCandidates.slice(0, 4).map(candidate => (
              <article key={candidate.id} className={styles.memoryItem}>
                <p>{candidate.content}</p>
                <small>原话：{candidate.evidenceText}</small>
                <div className={styles.memoryActions}>
                  <button onClick={() => updateMemoryCandidate(candidate.id, 'confirm')} disabled={candidate.status === 'confirmed' || candidate.status === 'rejected'}>
                    可以记住
                  </button>
                  <button onClick={() => updateMemoryCandidate(candidate.id, 'reject')} disabled={candidate.status === 'confirmed' || candidate.status === 'rejected'}>
                    不要记
                  </button>
                  <span>{candidate.status === 'confirmed' ? '已记住' : candidate.status === 'rejected' ? '已忽略' : '待确认'}</span>
                </div>
              </article>
            ))}
          </aside>
        )}
      </section>
    </main>
  );
}
