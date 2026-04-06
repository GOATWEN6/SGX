/**
 * AI 回忆录助手 - 记忆片段（Episode）API
 * 本轮重构新增
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getEpisodeById,
  getUserEpisodes,
  createEpisode,
  updateEpisode,
  archiveEpisode,
  getUserMemoryCards,
  getSessionMessages,
  createArticle,
} from '@/lib/db';
import { callLLM, getStyleProfileById, readPromptFile } from '@/lib/llm';
import { parseJsonSafely } from '@/lib/llm/client';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { Episode, UserProfile, MemoryCard } from '@/types';
import {
  CreateEpisodeSchema,
  ListEpisodeSchema,
  GetEpisodeSchema,
  UpdateEpisodeSchema,
  ArchiveEpisodeSchema,
  GenerateArticleSchema,
  validateRequest,
} from '@/lib/validators';

const rateLimiter = createRateLimiter();

/**
 * 从 Episode 生成文章
 */
async function generateArticleFromEpisode(
  episode: Episode,
  user: { preferredStyle?: string },
  memoryCards: MemoryCard[]
) {
  // 准备素材
  const episodeCards = memoryCards.filter(c => 
    episode.relatedCardIds.includes(c.id)
  );
  
  const materials = episodeCards.map(card => 
    `- ${card.title}: ${card.content}`
  ).join('\n');

  // 获取关联会话的消息作为引用
  let relatedMessages = '';
  if (episode.relatedSessionIds && episode.relatedSessionIds.length > 0) {
    const sessions = episode.relatedSessionIds.slice(0, 2); // 最多取2个会话
    for (const sessionId of sessions) {
      const messages = getSessionMessages(sessionId);
      const userMsgs = messages.filter(m => m.role === 'user').slice(-3);
      relatedMessages += userMsgs.map(m => m.content).join('\n');
    }
  }

  const prompt = `
请根据以下记忆片段素材，撰写一篇温暖的回忆文章。

## 记忆片段信息
- 标题：${episode.title}
- 摘要：${episode.summary || '无'}
- 人生阶段：${episode.stage || '未分类'}

## 素材卡片
${materials || '无素材卡片'}

## 用户原话引用
${relatedMessages || '无'}

## 要求
1. 文章风格温暖、真诚，保留老人原话质感
2. 字数控制在 800-1500 字
3. 结构：开头引入 -> 细节展开 -> 情感升华
4. 使用第一人称"我"来叙述
5. 可以适当使用细节描写，但不要虚构

请直接返回 JSON 格式：
{
  "title": "文章标题",
  "content": "文章内容",
  "keyMemories": ["关键记忆点1", "关键记忆点2"]
}
`;

  const systemPrompt = '你是一位温暖的回忆录作家，擅长用真诚的语言记录老人的故事。';

  const response = await callLLM(systemPrompt, prompt, {
    temperature: 0.7,
    maxTokens: 2048,
  });

  const parsed = parseJsonSafely<{
    title?: string;
    content?: string;
    keyMemories?: string[];
  }>(response, { title: '', content: '', keyMemories: [] });

  return {
    title: parsed?.title || episode.title,
    content: parsed?.content || '生成失败，请重试',
    keyMemories: parsed?.keyMemories || [],
  };
}

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

    // 认证 - 从 token 获取 userId
    const tokenUserId = requireAuth(request);

    const body = await request.json();
    const { action } = body;

    // 创建记忆片段
    if (action === 'create') {
      const validatedData = validateRequest(CreateEpisodeSchema, body);
      const { title, summary, stage, themeTags, relatedSessionIds, relatedCardIds, importance } = validatedData;
      
      const episode = createEpisode(tokenUserId, {
        title,
        summary,
        stage,
        themeTags,
        relatedSessionIds,
        relatedCardIds,
        importance,
      });

      return NextResponse.json({
        success: true,
        data: { episode },
      });
    }

    // 获取记忆片段列表
    if (action === 'list') {
      validateRequest(ListEpisodeSchema, body);
      const result = getUserEpisodes(tokenUserId);
      return NextResponse.json({
        success: true,
        data: { episodes: result.items, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
      });
    }

    // 获取单个记忆片段
    if (action === 'get') {
      const validatedData = validateRequest(GetEpisodeSchema, body);
      const episode = getEpisodeById(validatedData.episodeId);
      
      if (!episode) {
        return NextResponse.json(
          { success: false, error: { code: 'EPISODE_NOT_FOUND', message: '记忆片段不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (episode.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { episode },
      });
    }

    // 更新记忆片段
    if (action === 'update') {
      const validatedData = validateRequest(UpdateEpisodeSchema, body);
      const episode = getEpisodeById(validatedData.episodeId);
      
      if (!episode) {
        return NextResponse.json(
          { success: false, error: { code: 'EPISODE_NOT_FOUND', message: '记忆片段不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (episode.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      const { episodeId, ...updates } = validatedData;
      const updated = updateEpisode(episodeId, updates);

      return NextResponse.json({
        success: true,
        data: { episode: updated },
      });
    }

    // 归档记忆片段
    if (action === 'archive') {
      const validatedData = validateRequest(ArchiveEpisodeSchema, body);
      const episode = getEpisodeById(validatedData.episodeId);
      
      if (!episode) {
        return NextResponse.json(
          { success: false, error: { code: 'EPISODE_NOT_FOUND', message: '记忆片段不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (episode.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      const archived = archiveEpisode(validatedData.episodeId);

      return NextResponse.json({
        success: true,
        data: { episode: archived },
      });
    }

    // 从记忆片段生成文章
    if (action === 'generate_article') {
      const validatedData = validateRequest(GenerateArticleSchema, body);
      
      // 获取记忆片段
      const episode = getEpisodeById(validatedData.episodeId);
      if (!episode) {
        return NextResponse.json(
          { success: false, error: { code: 'EPISODE_NOT_FOUND', message: '记忆片段不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (episode.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      // 获取用户的记忆卡片
      const memoryResult = getUserMemoryCards(tokenUserId);
      const memoryCards = memoryResult.items;

      // 生成文章
      const articleResult = await generateArticleFromEpisode(episode, { preferredStyle: validatedData.styleId }, memoryCards);

      // 保存文章草稿
      const article = createArticle(tokenUserId, {
        title: articleResult.title,
        content: articleResult.content,
        episodeId: episode.id,
        sourceCardIds: episode.relatedCardIds || [],
        styleId: validatedData.styleId || 'narrative',
        status: 'draft',
      });

      // 更新 Episode 关联的文章
      updateEpisode(validatedData.episodeId, {
        articleDraftIds: [...(episode.articleDraftIds || []), article.id],
      });

      return NextResponse.json({
        success: true,
        data: { article, episode },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: '无效的操作' } },
      { status: 400 }
    );
  } catch (error) {
    logger.error('记忆片段 API 错误: {error}', { error: String(error) });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    );
  }
}
