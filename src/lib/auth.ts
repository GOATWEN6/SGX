/**
 * AI 回忆录助手 - 认证模块
 * 提供 JWT token 生成和验证功能
 */

import { sign, verify, TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken';
import { getUserById } from './db';
import { logger } from './logger';

// JWT 密钥 - 必须从环境变量读取
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 环境变量未设置，请设置 JWT_SECRET 后再启动服务');
}
const TOKEN_EXPIRY = '30d'; // 30天过期

// 类型断言：因为上面已经检查过 JWT_SECRET 不为空
const safeJwtSecret: string = JWT_SECRET;

/**
 * 生成 JWT Token
 */
export function createToken(userId: string): string {
  return sign({ userId }, safeJwtSecret, { expiresIn: TOKEN_EXPIRY });
}

/**
 * 验证 JWT Token
 * @returns userId 或 null（token无效或过期）
 */
export function verifyToken(token: string): string | null {
  try {
    const decoded = verify(token, safeJwtSecret) as { userId: string };
    return decoded.userId || null;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      logger.warn('Token 已过期');
    } else if (error instanceof JsonWebTokenError) {
      logger.warn('Token 格式错误: {message}', { message: error.message });
    }
    return null;
  }
}

/**
 * 从 Authorization header 提取 userId
 * 支持格式: "Bearer <token>"
 */
export function extractUserIdFromAuth(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  // 支持 "Bearer <token>" 或直接传 token
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
  
  if (!token) return null;
  
  return verifyToken(token);
}

/**
 * 验证用户是否存在
 * 用于 Token 验证通过后确认用户仍然有效
 */
export async function validateUserExists(userId: string): Promise<boolean> {
  const user = getUserById(userId);
  return user !== null;
}

/**
 * 创建带用户信息的 Token 响应
 */
export function createAuthResponse(userId: string) {
  return {
    token: createToken(userId),
    userId,
    expiresIn: TOKEN_EXPIRY,
  };
}

/**
 * 验证请求并返回 userId
 * 用于 API 路由中快速获取已验证的 userId
 * @throws 如果未认证，抛出错误
 */
export function requireAuth(request: Request): string {
  const authHeader = request.headers.get('authorization');
  const userId = extractUserIdFromAuth(authHeader);
  
  if (!userId) {
    throw new AuthenticationError('未登录或 token 已过期', 'UNAUTHORIZED', 401);
  }
  
  return userId;
}

/**
 * 认证错误类
 */
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * 权限错误类
 */
export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string = 'FORBIDDEN',
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * 验证用户只能操作自己的数据
 */
export function validateUserAccess(userId: string, targetUserId: string): void {
  if (userId !== targetUserId) {
    throw new AuthorizationError('无权访问其他用户的数据', 'FORBIDDEN', 403);
  }
}