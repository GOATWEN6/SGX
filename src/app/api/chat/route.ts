/**
 * AI 回忆录助手 - 对话 API
 * 处理用户与 AI 的访谈对话
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getUserById,
  getSessionById,
  getSessionMessages,
  createSession,
  updateSession,
  addMessage,
  createMemoryCard,
  updateUser,
  getTodaySummary,
  createEpisode,
  getUserEpisodes,
  getUserMemoryCards,
} from '@/lib/db';
import { summarizeMessage, getTopicsByPhase } from '@/lib/llm';
import {
  processChatMessage as engineProcessChat,
  createInitialInterviewState,
  checkPhaseAdvance,
  getPhaseProgress,
  getPhaseMeta,
  InterviewState,
} from '@/lib/interview-engine';
import { extractUserIdFromAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createRateLimiter } from '@/lib/rate-limit';

const rateLimiter = createRateLimiter();

// 会话级访谈状态存储（内存中，测试用）
const interviewStateMap = new Map<string, InterviewState>();

export async function POST(request: NextRequest) {
  try {
    // 验证认证
    const authHeader = request.headers.get('authorization');
    const tokenUserId = extractUserIdFromAuth(authHeader);
    
    if (!tokenUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: '请先登录' } },
        { status: 401 }
      );
    }
    
    // Rate limiting
    const rateLimit = rateLimiter(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }
    
    const body = await request.json();
    const { userId, message, sessionId, action } = body;

    // 验证用户只能操作自己的数据
    if (userId && userId !== tokenUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权操作其他用户的数据' } },
        { status: 403 }
      );
    }

    // 使用 token 中的 userId
    const validUserId = userId || tokenUserId;

    // 获取用户信息
    const user = getUserById(validUserId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.USER_NOT_FOUND, message: '用户不存在' } },
        { status: 404 }
      );
    }

    // 处理不同动作
    if (action === 'start_session') {
      // 开始新会话
      const newSession = createSession(validUserId, user.currentPhase);
      return NextResponse.json({
        success: true,
        data: {
          session: newSession,
          todaySummary: getTodaySummary(validUserId),
          suggestedTopics: getTopicsByPhase(user.currentPhase).slice(0, 3),
        },
      });
    }

    if (action === 'end_session') {
      // 结束会话
      if (sessionId) {
        const session = getSessionById(sessionId);
        if (session) {
          // 验证会话属于当前用户
          if (session.userId !== validUserId) {
            return NextResponse.json(
              { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权结束其他用户的会话' } },
              { status: 403 }
            );
          }
          
          // 计算会话时长
          const startTime = new Date(session.createdAt).getTime();
          const endTime = Date.now();
          const duration = Math.round((endTime - startTime) / 60000);
          
          updateSession(sessionId, {
            endedAt: new Date().toISOString(),
            duration,
          });

          // 从会话中提取内容，如果对话足够长则创建 Episode
          const sessionMessages = getSessionMessages(sessionId);
          const userMessages = sessionMessages.filter(m => m.role === 'user');
          
          if (userMessages.length >= 3) {
            // 创建 Episode（记忆片段）
            const firstMessage = userMessages[0]?.content || '';
            const lastMessage = userMessages[userMessages.length - 1]?.content || '';
            
            // 简单提取标题 - 取第一句话的前20个字符
            const title = firstMessage.substring(0, 20) + (firstMessage.length > 20 ? '...' : '');
            
            // 检查是否已有���名 Episode，避免重复
            const existingResult = getUserEpisodes(validUserId);
            const existingEpisodes = existingResult.items;
            const hasSimilar = existingEpisodes.some(ep => 
              ep.title.includes(title.substring(0, 10))
            );
            
            if (!hasSimilar) {
              createEpisode(validUserId, {
                title,
                summary: lastMessage.substring(0, 100),
                stage: session.phase,
                relatedSessionIds: [sessionId],
                importance: 3,
              });
            }
          }
        }
      }
      return NextResponse.json({ success: true });
    }

    // 处理聊天消息
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_SESSION', message: '请先开始会话' } },
        { status: 400 }
      );
    }

    const session = getSessionById(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.SESSION_NOT_FOUND, message: '会话不存在' } },
        { status: 404 }
      );
    }

    // 验证会话属于当前用户
    if (session.userId !== validUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权操作其他用户的会话' } },
        { status: 403 }
      );
    }

    // 验证消息内容
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.INVALID_PARAMS, message: '消息不能为空' } },
        { status: 400 }
      );
    }

    // 获取会话历史 - 优化 token 使用，只保留最近 4 轮（8条消息）
    const allMessages = getSessionMessages(sessionId);
    const recentMessages = allMessages.slice(-8); // 最近 8 条消息（约4轮）
    const sessionHistory = recentMessages
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content.substring(0, 200)}`)  // 截断每条消息长度
      .join('\n');

    // 保存用户消息 - 使用正确的参数调用方式
    const userMessage = addMessage({
      sessionId,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      isQuestion: false,
      isFollowUp: false,
      phase: user.currentPhase,
      containsSensitiveTopic: false,
    });

    // 获取或初始化访谈状态
    let interviewState = interviewStateMap.get(sessionId);
    if (!interviewState) {
      interviewState = createInitialInterviewState();
      interviewStateMap.set(sessionId, interviewState);
    }

    // 处理 AI 响应（使用新的访谈引擎）
    const engineResult = await engineProcessChat(
      { userId: validUserId, message },
      session,
      user,
      sessionHistory,
      interviewState
    );

    const aiResponse = engineResult.response;
    interviewState = engineResult.updatedState;
    interviewStateMap.set(sessionId, interviewState);

    // 获取阶段进度信息（用于前端显示）
    const phaseProgressInfo = getPhaseProgress(interviewState.currentPhase);

    // 保存 AI 消息 - 使用正确的参数调用方式
    const assistantMessage = addMessage({
      sessionId,
      role: 'assistant',
      content: aiResponse.message,
      timestamp: new Date().toISOString(),
      isQuestion: !!aiResponse.nextQuestion,
      isFollowUp: aiResponse.shouldFollowUp,
      topicId: aiResponse.suggestedTopics?.[0],
      phase: user.currentPhase,
      containsSensitiveTopic: false,
    });

    // 提取记忆卡片 - 使用正确的参数调用方式
    if (aiResponse.detectedCards && aiResponse.detectedCards.length > 0) {
      for (const card of aiResponse.detectedCards) {
        createMemoryCard(validUserId, {
          type: card.type || 'event',
          title: card.title || '未命名',
          content: card.content || '',
          sourceMessageId: userMessage.id,
          isOriginal: false,
          isSummary: true,
          isUncertain: false,
          confidence: 0.8,
          tags: [],
          themes: [],
          relatedPersons: [],
          relatedPlaces: [],
          relatedEvents: [],
        });
      }
    }

    // 只在关键轮触发总结（每 5 轮或出现多个新事件/人物时）
    const shouldSummarize = 
      allMessages.length > 0 && 
      allMessages.length % 5 === 0 &&
      message.length > 50;

    if (shouldSummarize) {
      const summary = await summarizeMessage(
        user,
        user.currentPhase,
        getCollectedInfoSummary(user),
        message
      );

      // 如果需要确认某些信息
      if (summary.confirmationNeeded && summary.confirmationText) {
        aiResponse.message += `\n\n${summary.confirmationText}`;
      }
    }

    // 检查是否需要推进阶段
    const memoryResult = getUserMemoryCards(validUserId);
    const memoryCards = memoryResult.items;
    const coveredTopics = allMessages
      .filter(m => m.topicId)
      .map(m => m.topicId as string);

    // 检查是否需要推进阶段（使用引擎的状态）
    const phaseAdvanceResult = checkPhaseAdvance(interviewState);

    if (phaseAdvanceResult.shouldAdvance && phaseAdvanceResult.nextPhase) {
      const nextPhase = phaseAdvanceResult.nextPhase;
      const prevPhaseName = getPhaseMeta(interviewState.currentPhase).name;
      updateUser(validUserId, { currentPhase: nextPhase });
      const nextPhaseName = getPhaseMeta(nextPhase).name;
      aiResponse.message += `\n\n我们已经聊了不少关于「${prevPhaseName}」的内容。接下来，想请您再聊聊「${nextPhaseName}」方面的事情，您觉得可以吗？`;

      // 重置新阶段的计数器
      interviewState = {
        ...interviewState,
        currentPhase: nextPhase,
        phaseMessageCount: 0,
        visitedPhases: [...interviewState.visitedPhases, nextPhase],
        currentQuestionIndex: 0,
      };
      interviewStateMap.set(sessionId, interviewState);
    }

    // 构建完整的阶段进度信息
    const phaseProgressFull = {
      ...phaseAdvanceResult,
      currentPhase: interviewState.currentPhase,
      currentPhaseName: getPhaseMeta(interviewState.currentPhase).name,
      currentQuestionIndex: interviewState.currentQuestionIndex,
      phaseQuestionCount: getPhaseMeta(interviewState.currentPhase).questions.length,
      phaseMessageCount: interviewState.phaseMessageCount,
      totalMessageCount: interviewState.totalMessageCount,
      visitedPhases: interviewState.visitedPhases,
      phaseProgressInfo: phaseProgressInfo,
    };

    return NextResponse.json({
      success: true,
      data: {
        message: aiResponse,
        sessionSummary: aiResponse.sessionSummary,
        currentPhase: interviewState.currentPhase,
        messageCount: allMessages.length + 2,
        phaseProgress: phaseProgressFull,
      },
    });
  } catch (error) {
    logger.error('对话 API 错误: {error}', { error: String(error) });
    const { response, statusCode } = handleError(error);
    
    // 提供更友好的错误提示
    const errorMessage = error instanceof Error ? error.message : String(error);
    let customMessage = null;
    
    if (errorMessage.includes('LLM Provider 未配置') || errorMessage.includes('API Key')) {
      customMessage = '请在 .env.local 中配置 LLM_API_KEY';
    } else if (errorMessage.includes('LLM 调用失败')) {
      customMessage = 'AI 服务连接失败，请检查网络或 API 配置';
    }
    
    if (customMessage && statusCode === 500) {
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: customMessage } },
        { status: 500 }
      );
    }
    
    return NextResponse.json(response, { status: statusCode });
  }
}

function getCollectedInfoSummary(user: any): string {
  const info: string[] = [];
  if (user.birthPlace) info.push(`出生地: ${user.birthPlace}`);
  if (user.grewUpPlace) info.push(`成长地: ${user.grewUpPlace}`);
  if (user.education) info.push(`教育: ${user.education}`);
  return info.length > 0 ? info.join('\n') : '暂无收集到基本信息';
}