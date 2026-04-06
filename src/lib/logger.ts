/**
 * AI 回忆录助手 - 日志模块
 * 简单的控制台日志记录
 * 支持 Node.js 和浏览器环境
 */

// 日志级别
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const levels = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const currentLevel = levels[LOG_LEVEL as keyof typeof levels] ?? levels.info;

// 检测是否为浏览器环境
const isBrowser = typeof window !== 'undefined';

function formatMessage(level: string, message: string, meta: Record<string, any> = {}) {
  if (isBrowser) {
    // 浏览器环境：直接返回消息
    return { level, message, ...meta };
  }
  // Node.js 环境：返回 JSON 字符串
  return JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  });
}

export const logger = {
  trace(message: string, meta?: Record<string, any>) {
    if (currentLevel <= levels.trace) {
      console.log(formatMessage('trace', message, meta));
    }
  },
  
  debug(message: string, meta?: Record<string, any>) {
    if (currentLevel <= levels.debug) {
      if (isBrowser) {
        console.debug(message, meta);
      } else {
        console.debug(formatMessage('debug', message, meta));
      }
    }
  },
  
  info(message: string, meta?: Record<string, any>) {
    if (currentLevel <= levels.info) {
      if (isBrowser) {
        console.info(message, meta);
      } else {
        console.info(formatMessage('info', message, meta));
      }
    }
  },
  
  warn(message: string, meta?: Record<string, any>) {
    if (currentLevel <= levels.warn) {
      if (isBrowser) {
        console.warn(message, meta);
      } else {
        console.warn(formatMessage('warn', message, meta));
      }
    }
  },
  
  error(message: string, meta?: Record<string, any>) {
    if (currentLevel <= levels.error) {
      if (isBrowser) {
        console.error(message, meta);
      } else {
        console.error(formatMessage('error', message, meta));
      }
    }
  },
};

/**
 * API 请求日志
 */
export function logApiRequest(method: string, url: string, userId?: string) {
  logger.info(`${method} ${url}`, { type: 'api_request', userId });
}

/**
 * API 响应日志
 */
export function logApiResponse(method: string, url: string, statusCode: number, duration: number) {
  logger.info(`${method} ${url} - ${statusCode} (${duration}ms)`, {
    type: 'api_response',
    statusCode,
    duration,
  });
}

/**
 * 错误日志
 */
export function logError(error: Error, context: Record<string, any> = {}) {
  logger.error(error.message, {
    type: 'application_error',
    name: error.name,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    ...context,
  });
}

/**
 * LLM 调用日志
 */
export function logLLMCall(promptLength: number, responseLength: number, duration: number, success: boolean) {
  logger.info(`LLM call ${success ? 'succeeded' : 'failed'} in ${duration}ms`, {
    type: 'llm_call',
    promptLength,
    responseLength,
    duration,
    success,
  });
}

/**
 * 用户行为日志
 */
export function logUserAction(userId: string, action: string, details: Record<string, any> = {}) {
  logger.info(`User action: ${action}`, { type: 'user_action', userId, ...details });
}

export default logger;