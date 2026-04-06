/**
 * AI 回忆录助手 - 评审 API
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  getUserById,
  getDraftById,
  updateDraft,
  getUserMemoryCards,
} from '@/lib/db';
import { reviewMemoir, getStyleProfileById, rewriteMemoir } from '@/lib/llm';
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

    // 评审回忆录
    if (action === 'review') {
      const { draftId, focusAreas } = body;
      
      // 验证参数
      if (!draftId) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.INVALID_PARAMS, message: '缺少草稿ID' } },
          { status: 400 }
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
          { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权评审其他用户的草稿' } },
          { status: 403 }
        );
      }

      // 获取文风配置
      const styleProfile = getStyleProfileById(draft.styleId);
      if (!styleProfile) {
        return NextResponse.json(
          { success: false, error: { code: 'STYLE_NOT_FOUND', message: '文风配置不存在' } },
          { status: 400 }
        );
      }

      // 获取用户的记忆卡片（用于评审参考）
      const memoryResult = getUserMemoryCards(validUserId);
      const memoryCards = memoryResult.items;

      // 进行评审
      const result = await reviewMemoir(
        { draftId, focusAreas },
        draft,
        user,
        styleProfile,
        memoryCards
      );

      // 更新草稿状态
      const newReviewRounds = [...draft.reviewRounds, result.review];
      updateDraft(draftId, {
        reviewRounds: newReviewRounds,
        status: result.review.shouldRewrite ? 'reviewing' : 'revised',
      });

      return NextResponse.json({
        success: true,
        data: {
          review: result.review,
          comparisonWithPrevious: result.comparisonWithPrevious,
          totalReviewRounds: newReviewRounds.length,
        },
      });
    }

    // 重写回忆录
    if (action === 'rewrite') {
      const { draftId, rewriteFocus } = body;
      
      // 验证参数
      if (!draftId) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.INVALID_PARAMS, message: '缺少草稿ID' } },
          { status: 400 }
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
          { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权重写其他用户的草稿' } },
          { status: 403 }
        );
      }

      // 检查重写次数
      if (draft.reviewRounds.length >= 3) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.MAX_REWRITE, message: '已达到最大重写次数（3次）' } },
          { status: 400 }
        );
      }

      // 获取文风配置
      const styleProfile = getStyleProfileById(draft.styleId);
      if (!styleProfile) {
        return NextResponse.json(
          { success: false, error: { code: 'STYLE_NOT_FOUND', message: '文风配置不存在' } },
          { status: 400 }
        );
      }

      // 获取用户的记忆卡片
      const memoryResult = getUserMemoryCards(validUserId);
      const memoryCards = memoryResult.items;

      // 执行重写
      const rewriteResult = await rewriteMemoir(
        draft,
        user,
        styleProfile,
        memoryCards
      );

      // 更新草稿
      const updated = updateDraft(draftId, {
        title: rewriteResult.title,
        content: rewriteResult.content,
        version: draft.version + 1,
        referencedCards: rewriteResult.referencedCards,
        status: 'draft',
      });

      return NextResponse.json({
        success: true,
        data: {
          draft: updated,
          changesSummary: rewriteResult.changesSummary,
        },
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