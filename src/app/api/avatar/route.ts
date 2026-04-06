/**
 * AI 回忆录助手 - 陪伴角色 API
 * 获取陪伴角色信息（用于前端展示）
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUserAvatarProfiles, getUserVoicePersonas } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { AvatarActionSchema, validateRequest } from '@/lib/validators';

const rateLimiter = createRateLimiter();

// 默认陪伴角色配置
const DEFAULT_AVATARS = [
  {
    id: 'default_warm_sister',
    label: '温暖姐姐',
    description: '温柔的AI助手，像一位善解人意的姐姐，耐心倾听您的故事',
    visualStyle: '2d',
    colorTone: 'warm',
    personaTraits: ['耐心', '温柔', '善解人意', '温暖'],
    isFamilyInspired: false,
    isActive: true,
  },
  {
    id: 'default_wise_elder',
    label: '智慧长者',
    description: '像一位有阅历的长辈，用智慧和温暖陪伴您回忆往事',
    visualStyle: '2d',
    colorTone: 'warm',
    personaTraits: ['智慧', '沉稳', '温暖', '有阅历'],
    isFamilyInspired: false,
    isActive: true,
  },
];

const DEFAULT_VOICES = [
  {
    id: 'default_warm_female',
    label: '温柔女声',
    description: '柔和、温暖的女声，语速适中，适合老人聆听',
    voiceStyle: 'warm',
    speakingSpeed: 0.9,
    warmthLevel: 4,
    pauseStyle: 'natural',
    isFamilyInspired: false,
    isActive: true,
  },
  {
    id: 'default_gentle_male',
    label: '温和男声',
    description: '沉稳、温和的男声，给人安全感和信任感',
    voiceStyle: 'calm',
    speakingSpeed: 0.85,
    warmthLevel: 3,
    pauseStyle: 'natural',
    isFamilyInspired: false,
    isActive: true,
  },
];

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

    // 认证 - 从 token 获取 userId，不再信任请求体中的 userId
    const tokenUserId = requireAuth(request);

    const body = await request.json();
    const validatedBody = validateRequest(AvatarActionSchema, body);
    const { action } = validatedBody;

    // 获取陪伴角色列表
    if (action === 'list_avatars') {
      // 使用 token 中的 userId（不再信任 body 中的 userId）
      let avatars = DEFAULT_AVATARS;
      
      const userAvatars = getUserAvatarProfiles(tokenUserId);
      if (userAvatars.length > 0) {
        const userAvatarData = userAvatars.map(a => ({
          id: a.id,
          label: a.label,
          description: a.description || '',
          visualStyle: a.visualStyle,
          colorTone: a.colorTone,
          personaTraits: a.personaTraits,
          isFamilyInspired: a.isFamilyInspired,
          isActive: a.isActive,
        }));
        avatars = [...userAvatarData, ...DEFAULT_AVATARS];
      }

      return NextResponse.json({
        success: true,
        data: { avatars },
      });
    }

    // 获取语音角色列表
    if (action === 'list_voices') {
      let voices = DEFAULT_VOICES;
      
      const userVoices = getUserVoicePersonas(tokenUserId);
      if (userVoices.length > 0) {
        const userVoiceData = userVoices.map(v => ({
          id: v.id,
          label: v.label,
          description: v.description || '',
          voiceStyle: v.voiceStyle,
          speakingSpeed: v.speakingSpeed,
          warmthLevel: v.warmthLevel,
          pauseStyle: v.pauseStyle,
          isFamilyInspired: v.isFamilyInspired,
          isActive: v.isActive,
        }));
        voices = [...userVoiceData, ...DEFAULT_VOICES];
      }

      return NextResponse.json({
        success: true,
        data: { voices },
      });
    }

    // 获取当前活跃的角色
    if (action === 'get_active') {
      const avatars = DEFAULT_AVATARS;
      const voices = DEFAULT_VOICES;

      return NextResponse.json({
        success: true,
        data: {
          activeAvatar: avatars[0],
          activeVoice: voices[0],
        },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: '无效的操作' } },
      { status: 400 }
    );
  } catch (error) {
    logger.error('陪伴角色 API 错误: {error}', { error: String(error) });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate limiting
  const rateLimit = rateLimiter(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
    );
  }

  // 返回默认角色信息（无需认证）
  return NextResponse.json({
    success: true,
    data: {
      avatars: DEFAULT_AVATARS,
      voices: DEFAULT_VOICES,
    },
  });
}
