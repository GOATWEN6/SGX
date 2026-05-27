'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, PhoneOff, Send, Square, Volume2 } from 'lucide-react';
import { authenticatedFetch, getToken, setAuth } from '@/lib/client-auth';
import styles from './voice-assistant.module.css';

type VoiceState = 'booting' | 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'interrupted' | 'error';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface MemoryCandidateLite {
  id: string;
  content: string;
  evidenceText: string;
  status: string;
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

async function ensureTestUser(): Promise<string> {
  if (getToken()) return 'existing';

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

export default function VoiceAssistantPage() {
  const [voiceState, setVoiceState] = useState<VoiceState>('booting');
  const [conversationSessionId, setConversationSessionId] = useState<string | null>(null);
  const [voiceSessionId, setVoiceSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [memoryCandidates, setMemoryCandidates] = useState<MemoryCandidateLite[]>([]);

  const recognitionRef = useRef<any>(null);
  const voiceStateRef = useRef<VoiceState>('booting');
  const isSpeakingRef = useRef(false);
  const voiceSessionIdRef = useRef<string | null>(null);
  const callActiveRef = useRef(false);
  const sentFinalRef = useRef(false);
  const messageAbortRef = useRef<AbortController | null>(null);
  const interruptTimeoutRef = useRef<number | null>(null);
  const vadStreamRef = useRef<MediaStream | null>(null);
  const vadContextRef = useRef<AudioContext | null>(null);
  const vadAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadIntervalRef = useRef<number | null>(null);
  const vadHitCountRef = useRef(0);

  useEffect(() => {
    voiceStateRef.current = voiceState;
  }, [voiceState]);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    voiceSessionIdRef.current = voiceSessionId;
  }, [voiceSessionId]);

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
  };

  const stopSpeakingNow = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  const interruptSpeech = async (reason: 'user_speech' | 'manual_stop' = 'manual_stop') => {
    stopSpeakingNow();
    setVoiceState('interrupted');
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

  const startBargeInMonitor = async () => {
    if (!navigator.mediaDevices?.getUserMedia || vadIntervalRef.current !== null) return;

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

      const samples = new Uint8Array(analyser.fftSize);
      vadIntervalRef.current = window.setInterval(() => {
        if (!isSpeakingRef.current || voiceStateRef.current !== 'speaking') {
          vadHitCountRef.current = 0;
          return;
        }
        analyser.getByteTimeDomainData(samples);
        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / samples.length);
        vadHitCountRef.current = rms > 0.055 ? vadHitCountRef.current + 1 : Math.max(0, vadHitCountRef.current - 1);
        if (vadHitCountRef.current >= 3) {
          vadHitCountRef.current = 0;
          interruptSpeech('user_speech');
        }
      }, 120);
    } catch {
      setNotice('麦克风自动打断监听没有开启，仍可点击“打断”或用文字输入。');
      stopBargeInMonitor();
    }
  };

  const speakText = (text: string) => {
    if (!('speechSynthesis' in window)) {
      setNotice('当前浏览器不能播放语音，我会用大字幕显示回复。');
      setVoiceState('listening');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.86;
    utterance.pitch = 1;
    const chineseVoice = window.speechSynthesis.getVoices().find(voice => voice.lang.includes('zh'));
    if (chineseVoice) utterance.voice = chineseVoice;
    utterance.onstart = () => {
      if (!callActiveRef.current) return;
      void startBargeInMonitor();
      setIsSpeaking(true);
      setVoiceState('speaking');
    };
    utterance.onend = () => {
      if (!callActiveRef.current) return;
      setIsSpeaking(false);
      setVoiceState('listening');
    };
    utterance.onerror = () => {
      if (!callActiveRef.current) return;
      setIsSpeaking(false);
      setVoiceState('error');
      setNotice('语音播报失败了，可以先看大字幕或用文字继续。');
    };
    window.speechSynthesis.speak(utterance);
  };

  const boot = async () => {
    setVoiceState('booting');
    setNotice('');
    try {
      await ensureTestUser();
      const sessionResponse = await authenticatedFetch('/api/conversation/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'web_voice_call', conversationType: 'ai_chat' }),
      });
      const sessionResult = await sessionResponse.json();
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
        setNotice('当前是浏览器 ASR/TTS 测试模式，不是真实豆包实时语音流。');
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
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
    }
    boot();
    return () => {
      callActiveRef.current = false;
      messageAbortRef.current?.abort();
      recognitionRef.current?.abort?.();
      stopSpeakingNow();
      stopBargeInMonitor();
    };
    // The standalone test call should boot exactly once per page entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async (rawText?: string) => {
    const text = (rawText ?? input).trim();
    if (!text || !conversationSessionId) return;
    if (isSpeakingRef.current) await interruptSpeech('user_speech');

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text, timestamp: new Date().toISOString() }]);
    setVoiceState('thinking');
    messageAbortRef.current?.abort();
    const abortController = new AbortController();
    messageAbortRef.current = abortController;

    try {
      const response = await authenticatedFetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: conversationSessionId, message: text }),
        signal: abortController.signal,
      });
      const result = await response.json();
      if (!callActiveRef.current || abortController.signal.aborted) return;
      if (!result.success) throw new Error(result.error?.message || 'AI 回复失败');

      setMessages(prev => [...prev, { role: 'assistant', content: result.data.message, timestamp: new Date().toISOString() }]);
      if (result.data.memoryCandidates?.length) {
        setMemoryCandidates(prev => [...result.data.memoryCandidates, ...prev]);
      }
      if (result.data.usedWebSearch && !result.data.citations?.length) {
        setNotice('本轮识别为联网问题，但搜索服务未配置，因此没有实时来源。');
      }
      speakText(result.data.message);
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return;
      setVoiceState('error');
      setNotice(error instanceof Error ? error.message : '发送失败，请稍后再试。');
    }
  };

  const startListening = () => {
    if (!recognitionRef.current) {
      setNotice('当前浏览器不支持语音识别，请先用文字输入测试。');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
      setVoiceState('idle');
      return;
    }
    if (isSpeakingRef.current) interruptSpeech('user_speech');

    sentFinalRef.current = false;
    recognitionRef.current.onresult = (event: any) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      setInput(finalText || interimText);
      if (finalText.trim() && !sentFinalRef.current) {
        sentFinalRef.current = true;
        recognitionRef.current.stop();
        sendMessage(finalText);
      }
    };
    recognitionRef.current.onerror = (event: any) => {
      const errorMap: Record<string, string> = {
        'not-allowed': '麦克风权限被拒绝了，请在浏览器设置里允许麦克风。',
        'service-not-allowed': '浏览器暂时不允许使用语音识别服务，可以先打字。',
        'audio-capture': '没有检测到可用麦克风。',
        'no-speech': '我没有听到声音，可以靠近一点再说。',
      };
      setVoiceState('error');
      setNotice(errorMap[event.error] || '我没听清，可以再试一次。');
      setIsRecording(false);
    };
    recognitionRef.current.onend = () => {
      setIsRecording(false);
      if (voiceStateRef.current === 'listening') setVoiceState('idle');
    };
    recognitionRef.current.start();
    setIsRecording(true);
    setVoiceState('listening');
  };

  const endCall = async () => {
    callActiveRef.current = false;
    messageAbortRef.current?.abort();
    recognitionRef.current?.abort?.();
    stopSpeakingNow();
    stopBargeInMonitor();
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
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Standalone Voice Test</p>
            <h1>AI 语音助手</h1>
          </div>
          <div className={styles.status} role="status" aria-live="polite">
            <span className={`${styles.statusDot} ${styles[`state_${voiceState}`] || ''}`} />
            {stateLabel[voiceState]}
          </div>
        </header>

        {notice && <div className={styles.notice} role="alert">{notice}</div>}

        <section className={styles.captionPanel} aria-label="对话字幕">
          <p className={styles.assistantText}>{lastAssistant?.content || '正在准备语音助手。'}</p>
          {lastUser && <p className={styles.userText}>我听到的是：{lastUser.content}</p>}
        </section>

        <section className={styles.controls} aria-label="语音控制">
          <button className={styles.primaryButton} onClick={startListening} disabled={voiceState === 'thinking' || voiceState === 'booting'}>
            <Mic size={34} />
            {isRecording ? '停止听' : voiceState === 'speaking' ? '打断并说话' : '开始说话'}
          </button>
          <button className={styles.secondaryButton} onClick={() => interruptSpeech('manual_stop')} disabled={voiceState !== 'speaking'}>
            <Square size={24} />
            打断
          </button>
          <button className={styles.secondaryButton} onClick={endCall}>
            <PhoneOff size={24} />
            重开一轮
          </button>
        </section>

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

        <section className={styles.transcript} aria-label="最近对话记录">
          {messages.slice(-6).map((message, index) => (
            <div key={`${message.timestamp}-${index}`} className={message.role === 'assistant' ? styles.assistantBubble : styles.userBubble}>
              {message.role === 'assistant' && <Volume2 size={18} />}
              <span>{message.content}</span>
            </div>
          ))}
        </section>

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
