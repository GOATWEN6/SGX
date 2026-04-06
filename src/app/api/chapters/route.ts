/**
 * AI 回忆录助手 - 章节（Chapter）API
 * 本轮重构新增
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { CreateChapterSchema, UpdateChapterSchema, ReorderChapterSchema, ListChapterSchema, GetChapterSchema, validateRequest } from '@/lib/validators';
import {
  getBookProjectById,
  getChapterById,
  getProjectChapters,
  createChapter,
  updateChapter,
} from '@/lib/db';

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

    // 认证 - 从 token 获取 userId
    const tokenUserId = requireAuth(request);

    const body = await request.json();
    const { action } = body;

    // 创建章节
    if (action === 'create') {
      const validatedData = validateRequest(CreateChapterSchema, body);
      const { bookProjectId, title, summary, stageOrTheme, order } = validatedData;
      
      // 验证项目存在且属于该用户
      const project = getBookProjectById(bookProjectId);
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: '回忆录项目不存在' } },
          { status: 404 }
        );
      }
      // 使用 token userId 验证所有权
      if (project.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }
      
      const chapter = createChapter(tokenUserId, bookProjectId, {
        title,
        summary,
        stageOrTheme,
        order,
      });

      return NextResponse.json({
        success: true,
        data: { chapter },
      });
    }

    // 获取项目的章节列表
    if (action === 'list') {
      const validatedData = validateRequest(ListChapterSchema, body);
      const project = getBookProjectById(validatedData.bookProjectId);
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: '回忆录项目不存在' } },
          { status: 404 }
        );
      }
      if (project.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }
      const chapters = getProjectChapters(validatedData.bookProjectId);
      return NextResponse.json({
        success: true,
        data: { chapters },
      });
    }

    // 获取单个章节
    if (action === 'get') {
      const validatedData = validateRequest(GetChapterSchema, body);
      const chapter = getChapterById(validatedData.chapterId);
      
      if (!chapter) {
        return NextResponse.json(
          { success: false, error: { code: 'CHAPTER_NOT_FOUND', message: '章节不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (chapter.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { chapter },
      });
    }

    // 更新章节
    if (action === 'update') {
      const validatedData = validateRequest(UpdateChapterSchema, body);
      const { chapterId, ...updates } = validatedData;
      const chapter = getChapterById(chapterId);
      
      if (!chapter) {
        return NextResponse.json(
          { success: false, error: { code: 'CHAPTER_NOT_FOUND', message: '章节不存在' } },
          { status: 404 }
        );
      }

      // 使用 token userId 验证所有权
      if (chapter.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      const updated = updateChapter(chapterId, updates);

      return NextResponse.json({
        success: true,
        data: { chapter: updated },
      });
    }

    // 重新排序章节
    if (action === 'reorder') {
      const validatedData = validateRequest(ReorderChapterSchema, body);
      const { bookProjectId, chapterIds } = validatedData;
      
      const project = getBookProjectById(bookProjectId);
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: '回忆录项目不存在' } },
          { status: 404 }
        );
      }
      // 使用 token userId 验证所有权
      if (project.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }
      
      // 修复: 使用 Promise.all 等待所有更新完成，避免竞态条件
      await Promise.all(
        chapterIds.map((id: string, index: number) => 
          updateChapter(id, { order: index + 1 })
        )
      );
      
      const chapters = getProjectChapters(bookProjectId);
      return NextResponse.json({
        success: true,
        data: { chapters },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: '无效的操作' } },
      { status: 400 }
    );
  } catch (error) {
    logger.error('章节 API 错误: {error}', { error: String(error) });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    );
  }
}
