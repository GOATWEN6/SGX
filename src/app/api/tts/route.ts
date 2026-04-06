/**
 * AI 回忆录助手 - 语音合成 API
 * 使用浏览器原生 Web Speech API
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';

const rateLimiter = createRateLimiter();

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = rateLimiter(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // 认证
    requireAuth(request);

    const body = await request.json();
    const { text, voice, rate, pitch } = body;

    if (!text) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_TEXT', message: '请提供要播报的文本' } },
        { status: 400 }
      );
    }

    // 返回 TTS 配置信息，前端使用 Web Speech API
    // 浏览器原生支持，无需后端合成
    const ttsConfig = {
      // 可用的语音列表（浏览器会动态获取）
      voices: [
        { name: 'Microsoft Xiaoxiao - Chinese', lang: 'zh-CN', gender: 'female' },
        { name: 'Microsoft Yunyang - Chinese', lang: 'zh-CN', gender: 'male' },
        { name: 'Google 简体中文', lang: 'zh-CN', gender: 'female' },
        { name: 'Google 國語', lang: 'zh-TW', gender: 'female' },
      ],
      // 推荐设置
      recommendedSettings: {
        rate: rate || 0.9,  // 稍慢的语速，适合老人
        pitch: pitch || 1.0,
        volume: 1.0,
      },
      // 前端使用说明
      usage: `
        // 前端调用示例：
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;  // 稍慢
        utterance.pitch = 1.0;
        utterance.lang = 'zh-CN';
        
        // 选择声音
        const voices = speechSynthesis.getVoices();
        const chineseVoice = voices.find(v => v.lang.includes('zh'));
        if (chineseVoice) utterance.voice = chineseVoice;
        
        speechSynthesis.speak(utterance);
      `,
      // 是否支持语音识别（实时对话）
      speechRecognitionSupported: typeof window !== 'undefined' && 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
    };

    return NextResponse.json({
      success: true,
      data: ttsConfig,
    });
  } catch (error) {
    logger.error('TTS API 错误: {error}', { error: String(error) });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    );
  }
}

// 获取可用的语音列表
export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = rateLimiter(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      voices: [
        { name: 'Microsoft Xiaoxiao - Chinese', lang: 'zh-CN', gender: 'female' },
        { name: 'Microsoft Yunyang - Chinese', lang: 'zh-CN', gender: 'male' },
        { name: 'Google 简体中文', lang: 'zh-CN', gender: 'female' },
        { name: 'Google 國語', lang: 'zh-TW', gender: 'female' },
      ],
      recommendedRate: 0.9,
      recommendedPitch: 1.0,
    },
  });
}
