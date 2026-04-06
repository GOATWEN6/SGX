/**
 * Client-side logger utility
 * Provides consistent logging interface for browser environment
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
  const timestamp = getTimestamp();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('debug', message, meta));
    }
  },

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(formatMessage('info', message, meta));
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(formatMessage('warn', message, meta));
  },

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(formatMessage('error', message, meta));
  },

  // Log API request for debugging
  apiRequest(endpoint: string, options?: RequestInit): void {
    this.debug(`API 请求: ${options?.method || 'GET'} ${endpoint}`);
  },

  // Log API response for debugging
  apiResponse(endpoint: string, status: number, duration?: number): void {
    const meta = duration ? { duration: `${duration}ms` } : undefined;
    this.info(`API 响应: ${status} ${endpoint}`, meta);
  },

  // Log user action
  userAction(action: string, detail?: string): void {
    this.info(`用户操作: ${action}`, detail ? { detail } : undefined);
  },
};

export default logger;
