/**
 * AI 回忆录助手 - 回忆录 API
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getUserById,
  getUserDrafts,
  getDraftById,
  saveMemoirDraft,
  updateDraft,
  deleteDraft,
  getUserMemoryCards,
} from '@/lib/db';
import { generateMemoir } from '@/lib/llm';
import { getStyleProfileById } from '@/lib/llm';
import { extractUserIdFromAuth } from '@/lib/auth';
import { handleError, ErrorCodes } from '@/lib/errors';
import { createRateLimiter } from '@/lib/rate-limit';

const rateLimiter = createRateLimiter();

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
    const { userId, action } = body;

    // 验证用户只能操作自己的数据
    if (userId && userId !== tokenUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权操作其他用户的数据' } },
        { status: 403 }
      );
    }

    const validUserId = userId || tokenUserId;

    // 获取用户信息
    const user = getUserById(validUserId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.USER_NOT_FOUND, message: '用户不存在' } },
        { status: 404 }
      );
    }

    // 生成回忆录
    if (action === 'generate') {
      const { type, styleId, length } = body;
      
      // 验证类型
      const validTypes = ['fragment', 'short_essay', 'chapter', 'book_outline', 'character_bio', 'family_preface', 'letter', 'oral_history'];
      if (!type || !validTypes.includes(type)) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.INVALID_PARAMS, message: '无效的回忆录类型' } },
          { status: 400 }
        );
      }
      
      // 获取用户的记忆卡片
      const memoryResult = getUserMemoryCards(validUserId);
      const memoryCards = memoryResult.items;
      
      if (memoryCards.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'NO_MEMORY_CARDS', message: '暂无足够的素材，请先进行更多对话' } },
          { status: 400 }
        );
      }
      
      // 获取文风配置
      const styleProfile = getStyleProfileById(styleId || user.preferredStyle);
      if (!styleProfile) {
        return NextResponse.json(
          { success: false, error: { code: 'STYLE_NOT_FOUND', message: '文风配置不存在' } },
          { status: 400 }
        );
      }
      
      // 生成回忆录
      const result = await generateMemoir(
        {
          userId: validUserId,
          type,
          styleId: styleId || user.preferredStyle,
          length: length || 'medium',
        },
        user,
        memoryCards,
        styleProfile
      );
      
      // 保存草稿
      const draft = saveMemoirDraft({
        userId: validUserId,
        type,
        styleId: styleId || user.preferredStyle,
        title: result.draft.title || '未命名回忆录',
        content: result.draft.content,
        status: 'draft',
        version: 1,
        reviewRounds: [],
        referencedCards: result.usedCards,
        exportedFormats: [],
      });
      
      return NextResponse.json({
        success: true,
        data: { draft },
      });
    }

    // 获取草稿列表
    if (action === 'list') {
      const result = getUserDrafts(validUserId);
      return NextResponse.json({
        success: true,
        data: { drafts: result.items, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: '无效的操作' } },
      { status: 400 }
    );
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}

export async function PUT(request: NextRequest) {
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
    
    const body = await request.json();
    const { userId, draftId, updates } = body;

    // 验证用户只能操作自己的数据
    if (userId && userId !== tokenUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权操作其他用户的数据' } },
        { status: 403 }
      );
    }

    const validUserId = userId || tokenUserId;

    // 获取草稿
    const draft = getDraftById(draftId);
    if (!draft) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.DRAFT_NOT_FOUND, message: '草稿不存在' } },
        { status: 404 }
      );
    }

    // 验证草稿属于当前用户
    if (draft.userId !== validUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权修改其他用户的草稿' } },
        { status: 403 }
      );
    }

    // 更新草稿
    const updated = updateDraft(draftId, updates);
    
    return NextResponse.json({
      success: true,
      data: { draft: updated },
    });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}

export async function DELETE(request: NextRequest) {
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
    
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');
    const userId = searchParams.get('userId');

    // 验证参数
    if (!draftId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.INVALID_PARAMS, message: '缺少草稿ID' } },
        { status: 400 }
      );
    }

    // 验证用户只能操作自己的数据
    const validUserId = userId || tokenUserId;
    if (userId && userId !== tokenUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权删除其他用户的草稿' } },
        { status: 403 }
      );
    }

    // 获取草稿
    const draft = getDraftById(draftId);
    if (!draft) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.DRAFT_NOT_FOUND, message: '草稿不存在' } },
        { status: 404 }
      );
    }

    // 验证草稿属于当前用户
    if (draft.userId !== validUserId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权删除其他用户的草稿' } },
        { status: 403 }
      );
    }

    // 删除草稿
    deleteDraft(draftId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}