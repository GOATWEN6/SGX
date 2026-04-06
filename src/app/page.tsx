'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './page.module.css';
import { setAuth, getToken, getUserId, getAuthHeaders, clearAuth, isAuthenticated, authenticatedFetch } from '@/lib/client-auth';
import { logger } from '@/lib/client-logger';
import { OnboardingFlow, OnboardingFormData, OnboardingTrack } from '@/components/OnboardingV2';

// 类型定义
interface User {
  id: string;
  name: string;
  ageGroup?: string;
  gender?: string;
  birthPlace?: string;
  grewUpPlace?: string;
  education?: string;
  useHonorific: boolean;
  preferredStyle: string;
  conversationDuration: number;
  memoirGoal: string;
  currentPhase: string;
  totalSessions: number;
  totalMessages: number;
}

interface Session {
  id: string;
  createdAt: string;
  phase: string;
  messageCount: number;
}

// AI 分析结果（测试调试用）
interface AIAnalysis {
  nextQuestion?: string;
  emotionAnalysis?: {
    overall?: string;
    detectedEmotions?: string[];
    intensity?: string;
  };
  suggestedTopics?: string[];
  detectedCards?: Array<{
    type?: string;
    title?: string;
    content?: string;
  }>;
  shouldFollowUp?: boolean;
  sessionSummary?: string;
  phaseProgress?: {
    // 阶段基础信息
    currentPhase?: string;
    currentPhaseName?: string;
    currentQuestionIndex?: number;
    phaseQuestionCount?: number;
    phaseMessageCount?: number;
    totalMessageCount?: number;
    visitedPhases?: string[];
    // 推进判断
    shouldAdvance?: boolean;
    nextPhase?: string;
    reason?: string;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  analysis?: AIAnalysis;
}

interface ReviewScore {
  authenticity: number;
  coherence: number;
  detailLevel: number;
  characterPresence: number;
  emotionalDepth: number;
  eraAtmosphere: number;
  languageNaturalness: number;
  voicePreservation: number;
  readability: number;
  safety: number;
  total: number;
}

// 阶段名称映射
const phaseNames: Record<string, string> = {
  onboarding: '欢迎设置',
  ice_breaker: '破冰与信任',
  basic_info: '基本人生信息',
  childhood: '童年与家庭',
  education: '学校与成长',
  career: '工作与事业',
  family: '婚恋与家庭',
  marriage_family: '婚恋与家庭',
  migration: '迁徙与时代',
  friendship: '友谊与社会',
  challenges: '困难与转折',
  hardship: '困难与转折',
  proud_moments: '骄傲与成就',
  reflections: '感悟与和解',
  legacy: '留给后代的话',
};

// 阶段进度映射
const phaseProgress: Record<string, number> = {
  onboarding: 0,
  ice_breaker: 10,
  basic_info: 20,
  childhood: 30,
  education: 40,
  career: 50,
  family: 60,
  marriage_family: 60,
  migration: 70,
  friendship: 75,
  challenges: 80,
  hardship: 80,
  proud_moments: 85,
  reflections: 90,
  legacy: 100,
};

export default function Home() {
  // 状态管理
  const [currentView, setCurrentView] = useState<'onboarding' | 'onboarding_v2' | 'chat' | 'drafts' | 'timeline'>('onboarding_v2');
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [todaySummary, setTodaySummary] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [displayMode, setDisplayMode] = useState<'normal' | 'large' | 'high_contrast'>('normal');
  const [autoSpeak, setAutoSpeak] = useState(false);  // 自动语音播报（默认关闭）
  const [showMemoirPanel, setShowMemoirPanel] = useState(false);  // 回忆录面板
  const [companionAvatar, setCompanionAvatar] = useState({ label: 'AI 助手', colorTone: 'warm' });  // 陪伴角色
  const [drafts, setDrafts] = useState<any[]>([]);  // 草稿列表
  const [isGeneratingMemoir, setIsGeneratingMemoir] = useState(false);  // 是否正在生成
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // 语音识别
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 语音播报（TTS）
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakRef = useRef<any>(null);

  // 语音播报功能
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // 停止当前播报
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9; // 语速稍慢，适合老人
      utterance.pitch = 1.0;
      
      // 尝试选择中文语音
      const voices = speechSynthesis.getVoices();
      const chineseVoice = voices.find(v => v.lang.includes('zh'));
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthesis.speak(utterance);
    }
  };

  // 停止播报
  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    ageGroup: '',
    gender: '',
    birthPlace: '',
    grewUpPlace: '',
    education: '',
    useHonorific: true,
    preferredStyle: 'narrative',
    conversationDuration: 10,
    memoirGoal: 'self',
  });

  // 新版 onboarding 数据
  const [onboardingV2Data, setOnboardingV2Data] = useState<OnboardingFormData | null>(null);
  const [onboardingV2Track, setOnboardingV2Track] = useState<OnboardingTrack>(null);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化语音识别
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'zh-CN';
        
        recognitionRef.current.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
              transcript += event.results[i][0].transcript;
            }
          }
          if (transcript) {
            setInputValue((prev) => prev + transcript);
          }
        };
        
        recognitionRef.current.onerror = (event: any) => {
          logger.error('语音识别错误', { error: event.error });
          setIsRecording(false);
        };
        
        recognitionRef.current.onend = () => {
          setIsRecording(false);
        };
      }
    }

    // 清理函数：组件卸载时停止语音识别，防止内存泄漏
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // 忽略已在停止状态的错误
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // 开始/停止语音输入
  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert('您的浏览器不支持语音识别功能');
      return;
    }
    
    if (isRecording) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (error) {
        logger.error('启动语音识别失败', { error: String(error) });
      }
    }
  };

  // 开始新用户
  const handleStart = async () => {
    if (!formData.name.trim()) {
      alert('请输入您的称呼');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          ...formData,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // 保存 token 和用户信息
        setAuth(result.data.token, result.data.user.id);
        setUser(result.data.user);
        setCurrentView('chat');
        // 自动开始会话
        await startSession(result.data.user.id);
      } else {
        alert('创建用户失败: ' + result.error.message);
      }
    } catch (error) {
      logger.error('错误', { error: String(error) });
      alert('发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 根据出生年份获取年龄段
  const getAgeGroup = (year: number): string => {
    const age = new Date().getFullYear() - year;
    if (age < 65) return '60-65';
    if (age < 70) return '65-70';
    if (age < 75) return '70-75';
    if (age < 80) return '75-80';
    return '80+';
  };

  // 处理 v2 onboarding 完成
  const handleStartV2 = async (data: OnboardingFormData, track: OnboardingTrack) => {
    if (!data.name.trim()) {
      return;
    }

    setIsLoading(true);
    try {
      // 转换 v2 数据为 API 格式
      const apiData = {
        action: 'create',
        name: data.name,
        ageGroup: getAgeGroup(data.year),
        birthPlace: data.city,
        useHonorific: true,
        preferredStyle: 'narrative',
        memoirGoal: data.privacy === 'public' ? 'family_heirloom' : 'self',
      };

      const response = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiData),
      });

      const result = await response.json();

      if (result.success) {
        // 保存 token 和用户信息
        setAuth(result.data.token, result.data.user.id);
        setUser(result.data.user);
        setCurrentView('chat');
        // 自动开始会话
        await startSession(result.data.user.id);
      } else {
        alert('创建用户失败: ' + result.error.message);
      }
    } catch (error) {
      logger.error('错误', { error: String(error) });
      alert('发生错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 开始会话
  const startSession = async (userId: string) => {
    try {
      const response = await authenticatedFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          action: 'start_session',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setSession(result.data.session);
        setTodaySummary(result.data.todaySummary || '');
        
        // 添加欢迎消息
        const welcomeMessage: Message = {
          role: 'assistant',
          content: getWelcomeMessage(formData.useHonorific),
          timestamp: new Date().toISOString(),
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      logger.error('开始会话错误', { error: String(error) });
    }
  };

  // 获取欢迎消息
  const getWelcomeMessage = (useHonorific: boolean): string => {
    const prefix = useHonorific ? '您好，' : '你好，';
    const suffix = useHonorific ? '您' : '你';
    return `${prefix}我是AI回忆录助手，很高兴认识${suffix}！\n\n我们可以慢慢聊，您可以告诉我一些关于${suffix}的事情。比如，${suffix}今天感觉怎么样？或者，${suffix}还记得小时候最难忘的事情吗？\n\n不用着急，想说什么就说什么，我们一步一步来。`;
  };

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || !user || !session) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await authenticatedFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          sessionId: session.id,
          message: inputValue,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const aiMessage: Message = {
          role: 'assistant',
          content: result.data.message.message,
          timestamp: new Date().toISOString(),
          analysis: {
            nextQuestion: result.data.message.nextQuestion,
            emotionAnalysis: result.data.message.emotionAnalysis,
            suggestedTopics: result.data.message.suggestedTopics,
            detectedCards: result.data.message.detectedCards,
            shouldFollowUp: result.data.message.shouldFollowUp,
            sessionSummary: result.data.sessionSummary,
            phaseProgress: {
              currentPhase: result.data.phaseProgress?.currentPhase,
              currentPhaseName: result.data.phaseProgress?.currentPhaseName,
              currentQuestionIndex: result.data.phaseProgress?.currentQuestionIndex,
              phaseQuestionCount: result.data.phaseProgress?.phaseQuestionCount,
              phaseMessageCount: result.data.phaseProgress?.phaseMessageCount,
              totalMessageCount: result.data.phaseProgress?.totalMessageCount,
              visitedPhases: result.data.phaseProgress?.visitedPhases,
              shouldAdvance: result.data.phaseProgress?.shouldAdvance,
              nextPhase: result.data.phaseProgress?.nextPhase,
              reason: result.data.phaseProgress?.reason,
            },
          },
        };
        setMessages(prev => [...prev, aiMessage]);
      } else {
        // 显示错误信息
        logger.error('API 错误', result.error);
        alert('发送失败: ' + (result.error?.message || '未知错误'));
      }
    } catch (error) {
      logger.error('发送消息错误', { error: String(error) });
      alert('发送失败，请检查网络或服务器状态');
    } finally {
      setIsLoading(false);
    }
  };

  // 结束会话
  const handleEndSession = async () => {
    if (!user || !session) return;

    try {
      await authenticatedFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          sessionId: session.id,
          action: 'end_session',
        }),
      });
      
      setSession(null);
    } catch (error) {
      logger.error('结束会话错误', { error: String(error) });
    }
  };

  // 跳过当前话题
  const handleSkip = () => {
    const skipMessages = [
      '好的，我们换个话题。',
      '没问题，我们聊点别的吧。',
      '理解，让我们换一个话题。',
    ];
    
    const randomMessage = skipMessages[Math.floor(Math.random() * skipMessages.length)];
    
    const aiMessage: Message = {
      role: 'assistant',
      content: randomMessage + '\n\n您想聊些什么呢？',
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, aiMessage]);
  };

  // 休息一下
  const handleRest = () => {
    const restMessages = [
      '好的访谈很重要的。今天就先到这里，您好好休息。',
      '好的我们随时可以继续。祝您愉快！',
      '好的，记得喝点水。我们下次再聊。',
    ];
    
    const randomMessage = restMessages[Math.floor(Math.random() * restMessages.length)];
    
    const aiMessage: Message = {
      role: 'assistant',
      content: randomMessage,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, aiMessage]);
    handleEndSession();
  };

  // 渲染调试面板（测试模式）
  const renderDebugPanel = (analysis: AIAnalysis) => {
    if (!analysis) return null;

    return (
      <div className={styles.debugPanel}>
        <div className={styles.debugHeader}>
          <span>🔬 AI 内部分析</span>
        </div>
        <div className={styles.debugBody}>
          {/* 阶段进度 */}
          {analysis.phaseProgress && (
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>📊 阶段进度</div>
              <div className={styles.debugValue}>
                <div className={styles.debugPhaseInfo}>
                  <span className={styles.debugPhaseName}>当前阶段: <strong>{analysis.phaseProgress.currentPhaseName || analysis.phaseProgress.currentPhase}</strong></span>
                  <span className={styles.debugPhaseCount}>
                    第 {analysis.phaseProgress.phaseMessageCount || 0} 轮 / 问题 {analysis.phaseProgress.currentQuestionIndex !== undefined ? analysis.phaseProgress.currentQuestionIndex + 1 : '?'}/{analysis.phaseProgress.phaseQuestionCount || '?'}
                  </span>
                </div>
                <div className={styles.debugProgressBar}>
                  <div className={styles.debugProgressFill} style={{ width: `${Math.min(100, ((analysis.phaseProgress.phaseMessageCount || 0) / 3) * 100)}%` }}></div>
                </div>
                {(analysis.phaseProgress.visitedPhases?.length ?? 0) > 0 && (
                  <div className={styles.debugVisitedPhases}>
                    已访问: {(analysis.phaseProgress.visitedPhases ?? []).map(p => phaseNames[p] || p).join(' → ')}
                  </div>
                )}
                {analysis.phaseProgress.shouldAdvance && (
                  <div className={styles.debugAdvance}>
                    ⚠️ 建议推进 → {analysis.phaseProgress.nextPhase} ({analysis.phaseProgress.reason})
                  </div>
                )}
              </div>
            </div>
          )}

          {analysis.nextQuestion && (
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>📌 追问 (nextQuestion)</div>
              <div className={styles.debugValue}>{analysis.nextQuestion}</div>
            </div>
          )}

          {analysis.emotionAnalysis && (
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>💬 情感分析 (emotionAnalysis)</div>
              <div className={styles.debugValue}>
                {analysis.emotionAnalysis.overall && (
                  <div>整体情绪: {analysis.emotionAnalysis.overall}</div>
                )}
                {(analysis.emotionAnalysis.detectedEmotions?.length ?? 0) > 0 && (
                  <div>检测到情绪: {(analysis.emotionAnalysis.detectedEmotions ?? []).join(', ')}</div>
                )}
                {analysis.emotionAnalysis.intensity && (
                  <div>情绪强度: {analysis.emotionAnalysis.intensity}</div>
                )}
                {!analysis.emotionAnalysis.overall && !analysis.emotionAnalysis.detectedEmotions?.length && !analysis.emotionAnalysis.intensity && (
                  <div>{JSON.stringify(analysis.emotionAnalysis)}</div>
                )}
              </div>
            </div>
          )}

          {(analysis.suggestedTopics?.length ?? 0) > 0 && (
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>🎯 建议话题 (suggestedTopics)</div>
              <div className={styles.debugValue}>
                {(analysis.suggestedTopics ?? []).map((topic, i) => (
                  <span key={i} className={styles.debugTag}>{topic}</span>
                ))}
              </div>
            </div>
          )}

          {(analysis.detectedCards?.length ?? 0) > 0 && (
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>🗂️ 检测到的记忆卡片 (detectedCards)</div>
              <div className={styles.debugCards}>
                {(analysis.detectedCards ?? []).map((card, i) => (
                  <div key={i} className={styles.debugCard}>
                    <div className={styles.debugCardTitle}>
                      [{card.type || 'event'}] {card.title || '未命名'}
                    </div>
                    {card.content && (
                      <div className={styles.debugCardContent}>{card.content}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysis.sessionSummary && (
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>📝 会话摘要 (sessionSummary)</div>
              <div className={styles.debugValue}>{analysis.sessionSummary}</div>
            </div>
          )}

          {analysis.shouldFollowUp !== undefined && (
            <div className={styles.debugSection}>
              <div className={styles.debugLabel}>🔄 跟进标记 (shouldFollowUp)</div>
              <div className={styles.debugValue}>{analysis.shouldFollowUp ? '是 ✓' : '否'}</div>
            </div>
          )}

          {!analysis.nextQuestion && !analysis.emotionAnalysis && !analysis.suggestedTopics?.length && !analysis.detectedCards?.length && !analysis.sessionSummary && !analysis.phaseProgress && (
            <div className={styles.debugEmpty}>暂无分析数据</div>
          )}
        </div>
      </div>
    );
  };

  // 渲染设置面板
  const renderSettings = () => (
    <div className={styles.settingsPanel}>
      <h3>显示设置</h3>
      <div className={styles.settingsOptions}>
        <button
          className={`${styles.settingsBtn} ${displayMode === 'normal' ? styles.active : ''}`}
          onClick={() => setDisplayMode('normal')}
        >
          标准模式
        </button>
        <button
          className={`${styles.settingsBtn} ${displayMode === 'large' ? styles.active : ''}`}
          onClick={() => setDisplayMode('large')}
        >
          大字模式
        </button>
        <button
          className={`${styles.settingsBtn} ${displayMode === 'high_contrast' ? styles.active : ''}`}
          onClick={() => setDisplayMode('high_contrast')}
        >
          高对比度
        </button>
      </div>
      
      <h3 style={{ marginTop: '1rem' }}>语音设置</h3>
      <div className={styles.settingsOptions}>
        <button
          className={`${styles.settingsBtn} ${autoSpeak ? '' : styles.active}`}
          onClick={() => setAutoSpeak(false)}
        >
          🔇 关闭播报
        </button>
        <button
          className={`${styles.settingsBtn} ${autoSpeak ? styles.active : ''}`}
          onClick={() => setAutoSpeak(true)}
        >
          🔊 自动播放
        </button>
      </div>
    </div>
  );

  // 渲染回忆录面板
  const renderMemoirPanel = () => (
    <div className={styles.memoirPanel}>
      <h3>📚 我的回忆录</h3>
      <div className={styles.memoirContent}>
        <p>在这里您可以生成文章、管理草稿</p>
        
        <button 
          className={styles.startBtn} 
          onClick={handleGenerateMemoir}
          disabled={isGeneratingMemoir}
        >
          {isGeneratingMemoir ? '正在生成...' : '✨ 生成回忆文章'}
        </button>

        {drafts.length > 0 && (
          <div className={styles.draftsList}>
            <h4>我的草稿</h4>
            {drafts.map((draft: any, index: number) => (
              <div key={index} className={styles.draftItem}>
                <h5>{draft.title || `草稿 ${index + 1}`}</h5>
                <p>{draft.content?.substring(0, 100)}...</p>
                <div className={styles.draftActions}>
                  <button onClick={() => handleReview(draft.id)}>评审</button>
                  <button onClick={() => handleRewrite(draft.id)}>重写</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // 生成回忆录
  const handleGenerateMemoir = async () => {
    if (!user) return;
    
    setIsGeneratingMemoir(true);
    try {
      const response = await authenticatedFetch('/api/memoir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'generate',
          type: 'short_essay',
          styleId: user.preferredStyle || 'narrative',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setDrafts([...drafts, result.data.draft]);
        alert('文章生成成功！');
      } else {
        alert('生成失败: ' + result.error.message);
      }
    } catch (error) {
      logger.error('生成回忆录错误', { error: String(error) });
      alert('生成失败，请先进行更多对话');
    } finally {
      setIsGeneratingMemoir(false);
    }
  };

  // 评审草稿
  const handleReview = async (draftId: string) => {
    if (!user) return;
    
    try {
      const response = await authenticatedFetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'review',
          draftId,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`评审完成！得分: ${result.data.review.scores.total}/100`);
      } else {
        alert('评审失败: ' + result.error.message);
      }
    } catch (error) {
      logger.error('评审错误', { error: String(error) });
    }
  };

  // 重写草稿
  const handleRewrite = async (draftId: string) => {
    if (!user) return;
    
    try {
      const response = await authenticatedFetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          action: 'rewrite',
          draftId,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert('重写完成！');
        // 更新草稿列表
        setDrafts(drafts.map(d => d.id === draftId ? result.data.draft : d));
      } else {
        alert('重写失败: ' + result.error.message);
      }
    } catch (error) {
      logger.error('重写错误', { error: String(error) });
    }
  };

  // 渲染进度条
  // 11阶段导航条
  const ALL_PHASES = [
    { id: 'ice_breaker', name: '破冰' },
    { id: 'basic_info', name: '基本信息' },
    { id: 'childhood', name: '童年' },
    { id: 'education', name: '求学' },
    { id: 'career', name: '工作' },
    { id: 'marriage_family', name: '家庭' },
    { id: 'hardship', name: '困难' },
    { id: 'proud_moments', name: '骄傲' },
    { id: 'friendship', name: '友情' },
    { id: 'reflections', name: '感悟' },
    { id: 'legacy', name: '传承' },
  ];

  const renderProgress = () => {
    // 从最新 AI 消息中获取当前阶段
    const latestAI = [...messages].reverse().find(m => m.role === 'assistant' && m.analysis?.phaseProgress);
    const currentPhaseId = latestAI?.analysis?.phaseProgress?.currentPhase || user?.currentPhase || 'ice_breaker';
    const currentPhaseName = latestAI?.analysis?.phaseProgress?.currentPhaseName || phaseNames[currentPhaseId] || '访谈中';
    const phaseMsgCount = latestAI?.analysis?.phaseProgress?.phaseMessageCount ?? 0;
    const totalMsgCount = latestAI?.analysis?.phaseProgress?.totalMessageCount ?? 0;
    const questionIdx = (latestAI?.analysis?.phaseProgress?.currentQuestionIndex ?? 0) + 1;
    const questionTotal = latestAI?.analysis?.phaseProgress?.phaseQuestionCount ?? 11;
    const currentIdx = ALL_PHASES.findIndex(p => p.id === currentPhaseId);

    return (
      <div className={styles.phaseNav}>
        {/* 阶段进度文字 */}
        <div className={styles.phaseNavHeader}>
          <span className={styles.phaseNavLabel}>📍 {currentPhaseName}</span>
          <span className={styles.phaseNavStats}>
            第 {phaseMsgCount} 轮 / 问题 {questionIdx}/{questionTotal} / 共 {totalMsgCount} 轮
          </span>
        </div>
        {/* 11阶段进度条 */}
        <div className={styles.phaseBar}>
          {ALL_PHASES.map((phase, idx) => {
            const isActive = phase.id === currentPhaseId;
            const isPast = idx < currentIdx;
            const isFuture = idx > currentIdx;
            return (
              <div
                key={phase.id}
                className={`${styles.phaseDot} ${isActive ? styles.phaseDotActive : ''} ${isPast ? styles.phaseDotPast : ''} ${isFuture ? styles.phaseDotFuture : ''}`}
                title={`${phase.name}${isActive ? '（当前）' : ''}`}
              >
                <div className={styles.phaseDotInner}>
                  {isPast ? '✓' : idx + 1}
                </div>
                <div className={styles.phaseDotLabel}>{phase.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 渲染今日摘要
  const renderTodaySummary = () => {
    if (!todaySummary) return null;
    
    return (
      <div className={styles.todaySummary}>
        <h4>今日记录</h4>
        <p>{todaySummary}</p>
      </div>
    );
  };

  // 渲染欢迎页面（设置）
  if (currentView === 'onboarding') {
    return (
      <main className={`${styles.main} ${displayMode === 'large' ? styles.largeText : ''} ${displayMode === 'high_contrast' ? styles.highContrast : ''}`}>
        <div className={styles.onboardingContainer}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>📖</span>
            <h1>AI 回忆录助手</h1>
          </div>
          
          <p className={styles.subtitle}>
            通过温和的对话，帮助您记录和书写人生故事
          </p>

          <div className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="name">您希望我怎么称呼您？</label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入您的称呼"
              />
            </div>

            <div className={styles.formGroup}>
              <label>您希望我用"您"还是"你"来称呼您？</label>
              <div className={styles.radioGroup}>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    name="useHonorific"
                    checked={formData.useHonorific}
                    onChange={() => setFormData({ ...formData, useHonorific: true })}
                  />
                  <span>用"您"</span>
                </label>
                <label className={styles.radio}>
                  <input
                    type="radio"
                    name="useHonorific"
                    checked={!formData.useHonorific}
                    onChange={() => setFormData({ ...formData, useHonorific: false })}
                  />
                  <span>用"你"</span>
                </label>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="ageGroup">您大概属于哪个年龄段？</label>
              <select
                id="ageGroup"
                value={formData.ageGroup}
                onChange={(e) => setFormData({ ...formData, ageGroup: e.target.value })}
              >
                <option value="">请选择</option>
                <option value="60-65">60-65岁</option>
                <option value="65-70">65-70岁</option>
                <option value="70-75">70-75岁</option>
                <option value="75-80">75-80岁</option>
                <option value="80+">80岁以上</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="birthPlace">您出生在哪里？（可选）</label>
              <input
                type="text"
                id="birthPlace"
                value={formData.birthPlace}
                onChange={(e) => setFormData({ ...formData, birthPlace: e.target.value })}
                placeholder="例如：江苏省南京市"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="education">您的受教育程度？（可选）</label>
              <select
                id="education"
                value={formData.education}
                onChange={(e) => setFormData({ ...formData, education: e.target.value })}
              >
                <option value="">请选择</option>
                <option value="小学">小学</option>
                <option value="初中">初中</option>
                <option value="高中">高中/中专</option>
                <option value="大专">大专</option>
                <option value="本科">本科</option>
                <option value="研究生">研究生及以上</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="preferredStyle">您喜欢什么风格的文字？</label>
              <select
                id="preferredStyle"
                value={formData.preferredStyle}
                onChange={(e) => setFormData({ ...formData, preferredStyle: e.target.value })}
              >
                <option value="narrative">朴素记叙 - 平实清楚</option>
                <option value="o3ical">清丽抒情 - 细腻优美</option>
                <option value="rustic">乡土温润 - 有地方味</option>
                <option value="daily">温厚日常 - 平淡温暖</option>
                <option value="philosophical">哲思沉静 - 深思熟虑</option>
                <option value="letter">家书口吻 - 亲切自然</option>
                <option value="oral">口述实录 - 口语化</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="memoirGoal">您希望这本回忆录给谁看？</label>
              <select
                id="memoirGoal"
                value={formData.memoirGoal}
                onChange={(e) => setFormData({ ...formData, memoirGoal: e.target.value })}
              >
                <option value="self">给自己留档</option>
                <option value="children">给子女</option>
                <option value="grandchildren">给孙辈</option>
                <option value="family_heirloom">家庭纪念册</option>
                <option value="publish">出版草稿</option>
              </select>
            </div>

            <button
              className={styles.startBtn}
              onClick={handleStart}
              disabled={isLoading}
            >
              {isLoading ? '正在准备...' : '开始我们的回忆之旅'}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // 渲染拾光叙 v2 欢迎页面
  if (currentView === 'onboarding_v2') {
    return (
      <OnboardingFlow
        onComplete={(data, track) => {
logger.debug('Onboarding v2 完成', { data, track });
          // 将 v2 数据转换为兼容格式并继续
          setOnboardingV2Data(data);
          setOnboardingV2Track(track);

          // 转换为旧版格式并开始
          handleStartV2(data, track);
        }}
      />
    );
  }

  // 渲染主聊天界面
  return (
    <main className={`${styles.main} ${displayMode === 'large' ? styles.largeText : ''} ${displayMode === 'high_contrast' ? styles.highContrast : ''}`}>
      {/* 顶部导航 */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.logoIcon}>📖</span>
          <span className={styles.headerTitle}>AI 回忆录助手</span>
          <span className={styles.companionBadge}>温暖陪伴</span>
        </div>
        <div className={styles.headerRight}>
          {/* 陪伴角色展示 */}
          <div className={styles.companionDisplay}>
            <span className={styles.companionAvatar}>👩‍🦰</span>
            <span className={styles.companionName}>AI 助手</span>
          </div>
          <button
            className={styles.iconBtn}
            onClick={() => {
              logger.debug('点击了回忆录按钮');
              setShowMemoirPanel(!showMemoirPanel);
            }}
            title="我的回忆录"
          >
            📚 回忆录
          </button>
          <button
            className={styles.iconBtn}
            onClick={() => {
              logger.debug('点击了设置按钮');
              setShowSettings(!showSettings);
            }}
            title="显示设置"
          >
            ⚙️ 设置
          </button>
        </div>
      </header>

      {/* 设置面板 */}
      {showSettings && renderSettings()}

      {/* 回忆录面板 */}
      {showMemoirPanel && renderMemoirPanel()}

      {/* 进度条 */}
      {renderProgress()}

      {/* 今日摘要 */}
      {renderTodaySummary()}

      {/* 聊天区域 */}
      <div className={styles.chatContainer}>
        <div className={styles.messages}>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}
            >
              <div className={styles.messageContent}>
                {msg.content.split('\n').map((line, i) => (
                  <p key={i}>{line || <br />}</p>
                ))}
              </div>
              {msg.role === 'assistant' && (
                <button
                  className={styles.speakBtn}
                  onClick={() => speakText(msg.content)}
                  title="播放"
                >
                  🔊
                </button>
              )}
            </div>
          ))}
          {messages.map((msg, index) => {
            if (msg.role !== 'assistant' || !msg.analysis) return null;
            return (
              <div key={`debug-${index}`} className={styles.debugWrapper}>
                {renderDebugPanel(msg.analysis)}
              </div>
            );
          })}
          {isLoading && (
            <div className={`${styles.message} ${styles.aiMessage}`}>
              <div className={styles.messageContent}>
                <p>正在思考...</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className={styles.inputArea}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={isRecording ? "正在录音，请说话..." : "请输入您想说的话，或点击麦克风语音输入"}
            disabled={isLoading}
            rows={2}
          />
          <div className={styles.inputButtons}>
            <button
              className={`${styles.voiceBtn} ${isRecording ? styles.voiceBtnActive : ''}`}
              onClick={toggleVoiceInput}
              disabled={isLoading}
              title={isRecording ? "停止录音" : "语音输入"}
            >
              {isRecording ? '🔴' : '🎤'}
            </button>
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
            >
              发送
            </button>
          </div>
        </div>

        {/* 快捷操作按钮 */}
        <div className={styles.actionButtons}>
          <button className={styles.skipBtn} onClick={handleSkip}>
            跳过这个话题
          </button>
          <button className={styles.restBtn} onClick={handleRest}>
            我想休息一下
          </button>
        </div>
      </div>
    </main>
  );
}
