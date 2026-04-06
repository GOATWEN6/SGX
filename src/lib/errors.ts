/**
 * AI 回忆录助手 - 统一错误处理模块
 * 提供标准化的错误类和响应格式
 */

import { logger } from './logger';

// 错误代码枚举
export const ErrorCodes = {
  // 认证相关
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  
  // 验证相关
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMS: 'INVALID_PARAMS',
  INVALID_JSON: 'INVALID_JSON',
  
  // 资源相关
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  DRAFT_NOT_FOUND: 'DRAFT_NOT_FOUND',
  CARD_NOT_FOUND: 'CARD_NOT_FOUND',
  
  // 业务相关
  MAX_REWRITE: 'MAX_REWRITE',
  SESSION_ALREADY_ENDED: 'SESSION_ALREADY_ENDED',
  NO_MEMORY_CARDS: 'NO_MEMORY_CARDS',
  
  // 外部服务
  LLM_ERROR: 'LLM_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  
  // 系统
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

/**
 * 基础应用错误类
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isInternal: boolean = true,
    public details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    
    // 确保错误堆栈正确捕获
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * 转换为 API 响应格式
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(process.env.NODE_ENV === 'development' && this.details
          ? { details: this.details }
          : {}),
      },
    };
  }
}

/**
 * 认证错误 - 401
 */
export class AuthenticationError extends AppError {
  constructor(message: string = '未登录或 token 已过期', code: string = ErrorCodes.UNAUTHORIZED) {
    super(message, code, 401, false);
    this.name = 'AuthenticationError';
  }
}

/**
 * 权限错误 - 403
 */
export class AuthorizationError extends AppError {
  constructor(message: string = '无权访问', code: string = ErrorCodes.FORBIDDEN) {
    super(message, code, 403, false);
    this.name = 'AuthorizationError';
  }
}

/**
 * 验证错误 - 400
 */
export class ValidationError extends AppError {
  public errors: Array<{ path: string; message: string }>;
  
  constructor(
    message: string = '请求参数验证失败',
    code: string = ErrorCodes.VALIDATION_ERROR,
    errors: Array<{ path: string; message: string }> = []
  ) {
    super(message, code, 400, false, errors);
    this.name = 'ValidationError';
    this.errors = errors;
  }
  
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        errors: this.errors,
      },
    };
  }
}

/**
 * 资源未找到错误 - 404
 */
export class NotFoundError extends AppError {
  constructor(message: string = '资源不存在', code: string = 'NOT_FOUND') {
    super(message, code, 404, false);
    this.name = 'NotFoundError';
  }
}

/**
 * 业务逻辑错误 - 400
 */
export class BusinessError extends AppError {
  constructor(message: string, code: string, statusCode: number = 400) {
    super(message, code, statusCode, false);
    this.name = 'BusinessError';
  }
}

/**
 * 外部服务错误 - 502/503
 */
export class ExternalServiceError extends AppError {
  constructor(message: string = '外部服务调用失败', code: string = ErrorCodes.EXTERNAL_API_ERROR) {
    super(message, code, 502, true);
    this.name = 'ExternalServiceError';
  }
}

/**
 * 处理错误并返回标准化响应
 */
export function handleError(error: unknown) {
  // 如果已经是 AppError，直接返回
  if (error instanceof AppError) {
    return {
      response: error.toResponse(),
      statusCode: error.statusCode,
    };
  }
  
  // Zod 验证错误
  if (error instanceof z?.ZodError) {
    const validationError = new ValidationError(
      '请求参数格式错误',
      ErrorCodes.INVALID_JSON,
      error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
      }))
    );
    return {
      response: validationError.toResponse(),
      statusCode: 400,
    };
  }
  
  // 其他未知错误
    logger.error('未预期的错误: {error}', { error: String(error) });
  
  const internalError = new AppError(
    '服务器内部错误',
    ErrorCodes.INTERNAL_ERROR,
    500,
    true,
    error instanceof Error ? error.message : String(error)
  );
  
  return {
    response: internalError.toResponse(),
    statusCode: 500,
  };
}

/**
 * API 路由错误处理包装器
 * 用于 Next.js API 路由中自动处理错误
 */
export function withErrorHandling(handler: (request: Request) => Promise<Response>) {
  return async function (request: Request): Promise<Response> {
    try {
      return await handler(request);
    } catch (error) {
      const { response, statusCode } = handleError(error);
      return new Response(JSON.stringify(response), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  };
}

// 导入 zod 用于类型检查
import { z } from 'zod';