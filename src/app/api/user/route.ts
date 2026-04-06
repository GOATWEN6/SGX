/**
 * AI 回忆录助手 - 用户 API
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  createUser,
  getUserById,
  updateUser,
} from '@/lib/db';
import {
  createToken,
  extractUserIdFromAuth,
  validateUserAccess,
  AuthenticationError,
  AuthorizationError,
} from '@/lib/auth';
import {
  CreateUserSchema,
  UpdateUserSchema,
  validateRequest,
} from '@/lib/validators';
import { handleError, ErrorCodes } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createRateLimiter } from '@/lib/rate-limit';

const rateLimiter = createRateLimiter();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // 创建用户（注册）- 无需认证但需要限流
    if (action === 'create') {
      // Rate limiting
      const rateLimit = rateLimiter(request);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
        );
      }
      try {
        // 验证输入
        const { action: _action, ...profile } = body;
        const validatedData = validateRequest(CreateUserSchema, profile);
        
        // 创建用户
        const user = createUser(validatedData as any);
        
        // 生成 token
        const token = createToken(user.id);
        
        return NextResponse.json({
          success: true,
          data: {
            user,
            token,
          },
        });
      } catch (error) {
        if (error instanceof Error) {
        logger.error('创建用户错误: {error}', { error: String(error) });
          return NextResponse.json(
            { success: false, error: { code: 'CREATE_FAILED', message: error.message } },
            { status: 400 }
          );
        }
        throw error;
      }
    }

    // 获取用户信息 - 需要认证
    if (action === 'get') {
      // Rate limiting
      const rateLimit = rateLimiter(request);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
        );
      }

      // 验证认证
      const authHeader = request.headers.get('authorization');
      const userId = extractUserIdFromAuth(authHeader);
      
      if (!userId) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: '请先登录' } },
          { status: 401 }
        );
      }
      
      const { userId: targetUserId } = body;
      
      // 验证权限：只能查看自己的信息
      if (targetUserId && targetUserId !== userId) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权查看其他用户信息' } },
          { status: 403 }
        );
      }
      
      const user = getUserById(targetUserId || userId);
      
      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.USER_NOT_FOUND, message: '用户不存在' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { user },
      });
    }

    // 刷新 token
    if (action === 'refresh') {
      // Rate limiting
      const rateLimit = rateLimiter(request);
      if (!rateLimit.allowed) {
        return NextResponse.json(
          { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
        );
      }

      const authHeader = request.headers.get('authorization');
      const tokenUserId = extractUserIdFromAuth(authHeader);
      
      if (!tokenUserId) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: '无效的 token' } },
          { status: 401 }
        );
      }
      
      const user = getUserById(tokenUserId);
      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: ErrorCodes.USER_NOT_FOUND, message: '用户不存在' } },
          { status: 404 }
        );
      }
      
      // 生成新 token
      const newToken = createToken(user.id);
      
      return NextResponse.json({
        success: true,
        data: {
          token: newToken,
          user,
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

export async function PUT(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimit = rateLimiter(request);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后再试' } },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)) } }
      );
    }

    // 验证认证
    const authHeader = request.headers.get('authorization');
    const userId = extractUserIdFromAuth(authHeader);
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.UNAUTHORIZED, message: '请先登录' } },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { userId: targetUserId, updates } = body;

    // 验证权限
    if (targetUserId && targetUserId !== userId) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.FORBIDDEN, message: '无权修改其他用户信息' } },
        { status: 403 }
      );
    }
    
    // 验证输入
    const validatedUpdates = validateRequest(UpdateUserSchema, updates);

    // 创建用户
    const user = updateUser(userId, validatedUpdates as any);
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: ErrorCodes.USER_NOT_FOUND, message: '用户不存在' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return NextResponse.json(response, { status: statusCode });
  }
}