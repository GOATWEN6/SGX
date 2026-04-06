/**
 * AI 回忆录助手 - Rate Limiting 限流中间件
 * 基于内存的简单限流实现
 */

// 内存存储（生产环境应使用 Redis）
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// 配置
const DEFAULT_WINDOW_MS = 60 * 1000; // 1分钟
const DEFAULT_MAX_REQUESTS = 30; // 每分钟最多30次

interface RateLimitConfig {
  windowMs?: number;
  maxRequests?: number;
  message?: string;
}

const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  windowMs: DEFAULT_WINDOW_MS,
  maxRequests: DEFAULT_MAX_REQUESTS,
  message: '请求过于频繁，请稍后再试',
};

/**
 * 清理过期记录
 */
function cleanup(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// 每分钟清理一次
setInterval(cleanup, 60000);

// 预导入 auth 模块，避免动态 require
let authModule: typeof import('./auth') | null = null;
try {
  authModule = require('./auth');
} catch {
  // auth 模块可能不存在，忽略
}

/**
 * 创建限流中间件
 */
export function createRateLimiter(config: RateLimitConfig = {}) {
  const { windowMs, maxRequests } = { ...DEFAULT_CONFIG, ...config };

  return function rateLimit(request: Request): { allowed: boolean; remaining: number; resetTime: number } {
    // 获取客户端标识（优先使用用户ID，否则使用IP）
    const authHeader = request.headers.get('authorization');
    let clientId = request.headers.get('x-forwarded-for') || 'unknown';
    
    if (authHeader && authModule) {
      // 如果有认证，使用用户ID作为标识
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
      const userId = authModule.verifyToken(token);
      if (userId) {
        clientId = `user:${userId}`;
      }
    }

    const now = Date.now();
    const record = rateLimitStore.get(clientId);

    // 如果记录不存在或已过期，创建新记录
    if (!record || record.resetTime < now) {
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + windowMs,
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetTime: now + windowMs,
      };
    }

    // 检查是否超过限制
    if (record.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
      };
    }

    // 增加计数
    record.count++;
    rateLimitStore.set(clientId, record);

    return {
      allowed: true,
      remaining: maxRequests - record.count,
      resetTime: record.resetTime,
    };
  };
}

/**
 * 限流检查结果
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
}

/**
 * 速率限制错误
 */
export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export default createRateLimiter;