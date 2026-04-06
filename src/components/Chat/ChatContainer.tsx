/**
 * AI 回忆录助手 - Chat 聊天组件
 * 负责显示消息列表和处理用户输入
 */
import { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '@/lib/client-auth';
import { logger } from '@/lib/client-logger';
import styles from './ChatContainer.module.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatContainerProps {
  user: any;
  session: any;
  displayMode: 'normal' | 'large' | 'high_contrast';
  onSessionEnd: () => void;
  onSkip: () => void;
  onRest: () => void;
}

export default function ChatContainer({
  user,
  session,
  displayMode,
  onSessionEnd,
  onSkip,
  onRest,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

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
  }, []);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 语音播报功能
  const speakText = (text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      
      const voices = speechSynthesis.getVoices();
      const chineseVoice = voices.find((v: any) => v.lang.includes('zh'));
      if (chineseVoice) {
        utterance.voice = chineseVoice;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      speechSynthesis.speak(utterance);
    }
  };

  // 切换语音输入
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

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || !user || !session) return;

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
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
        };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
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
      onSessionEnd();
    } catch (error) {
      logger.error('结束会话错误', { error: String(error) });
    }
  };

  return (
    <div className={styles.container}>
      {/* 消息列表 */}
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
        <button className={styles.skipBtn} onClick={onSkip}>
          跳过这个话题
        </button>
        <button className={styles.restBtn} onClick={handleEndSession}>
          我想休息一下
        </button>
      </div>
    </div>
  );
}