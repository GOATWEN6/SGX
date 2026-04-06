/**
 * AI 回忆录助手 - 回忆录项目（BookProject）API
 * 本轮重构新增
 */
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { requireAuth } from '@/lib/auth';
import { createRateLimiter } from '@/lib/rate-limit';
import { BookProjectActionSchema, CreateBookProjectSchema, validateRequest } from '@/lib/validators';
import {
  getBookProjectById,
  getUserBookProjects,
  createBookProject,
  updateBookProject,
  getProjectChapters,
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

    // 认证 - 从 token 获取 userId，不再信任请求体中的 userId
    const tokenUserId = requireAuth(request);

    const body = await request.json();
    const { action } = body;

    // 创建回忆录项目
    if (action === 'create') {
      const validatedData = validateRequest(CreateBookProjectSchema, body);
      const { title, subtitle, description, styleId, targetWordCount } = validatedData;
      
      const project = createBookProject(tokenUserId, {
        title,
        subtitle,
        description,
        styleId,
        targetWordCount,
      });

      return NextResponse.json({
        success: true,
        data: { project },
      });
    }

    // 获取回忆录项目列表
    if (action === 'list') {
      const result = getUserBookProjects(tokenUserId);
      return NextResponse.json({
        success: true,
        data: { projects: result.items, total: result.total, page: result.page, pageSize: result.pageSize, totalPages: result.totalPages },
      });
    }

    // 获取单个回忆录项目
    if (action === 'get') {
      const { projectId } = body;
      const project = getBookProjectById(projectId);
      
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: '回忆录项目不存在' } },
          { status: 404 }
        );
      }

      // 使用 token 中的 userId 验证所有权（而非请求体中的 userId）
      if (project.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      // 获取项目章节
      const chapters = getProjectChapters(projectId);

      return NextResponse.json({
        success: true,
        data: { project, chapters },
      });
    }

    // 更新回忆录项目
    if (action === 'update') {
      const { projectId, ...updates } = body;
      const project = getBookProjectById(projectId);
      
      if (!project) {
        return NextResponse.json(
          { success: false, error: { code: 'PROJECT_NOT_FOUND', message: '回忆录项目不存在' } },
          { status: 404 }
        );
      }

      // 使用 token 中的 userId 验证所有权
      if (project.userId !== tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '无权访问' } },
          { status: 403 }
        );
      }

      const updated = updateBookProject(projectId, updates);

      return NextResponse.json({
        success: true,
        data: { project: updated },
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: '无效的操作' } },
      { status: 400 }
    );
  } catch (error) {
    logger.error('回忆录项目 API 错误: {error}', { error: String(error) });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      { status: 500 }
    );
  }
}
