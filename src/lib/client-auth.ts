/**
 * AI 回忆录助手 - 前端 Token 管理模块
 * 管理用户认证状态和 API 请求头
 */

import { logger } from './logger';

// Token 存储键名
const TOKEN_KEY = 'ai-memoir-auth-token';
const USER_ID_KEY = 'ai-memoir-user-id';

// Token 刷新锁，防止并发刷新
let refreshPromise: Promise<boolean> | null = null;

/**
 * 保存认证信息
 */
export function setAuth(token: string, userId: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_ID_KEY, userId);
    } catch (error) {
      logger.error('保存认证信息失败', { error: String(error) });
    }
  }
}

/**
 * 获取 Token
 */
export function getToken(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 获取用户 ID
 */
export function getUserId(): string | null {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem(USER_ID_KEY);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * 清除认证信息
 */
export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_ID_KEY);
    } catch {
      // 忽略清除失败
    }
  }
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  const token = getToken();
  const userId = getUserId();
  return !!(token && userId);
}

/**
 * 获取带认证的请求头
 */
export function getAuthHeaders(): HeadersInit {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

/**
 * 带认证的 API 请求封装
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = getAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
}

/**
 * 刷新 Token
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch('/api/user', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ action: 'refresh' }),
    });
    
    const result = await response.json();
    
    if (result.success && result.data.token) {
      setAuth(result.data.token, result.data.user.id);
      return true;
    }
    
    return false;
  } catch (error) {
    logger.error('刷新 Token 失败', { error: String(error) });
    return false;
  }
}

/**
 * API 错误类型
 */
export interface ApiError {
  code?: string;
  message: string;
}

/**
 * API 调用结果类型
 */
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

/**
 * 创建带认证的 API 调用函数
 * 自动处理 token 过期刷新，防止并发刷新竞态条件
 */
export function createApiCaller(baseUrl: string = '') {
  return async function apiCall<T extends object = object>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResult<T>> {
    const url = baseUrl + endpoint;
    
    try {
      const response = await authenticatedFetch(url, options);
      const result: ApiResult<T> = await response.json();
      
      // 如果 token 过期，尝试刷新
      if (result.error?.code === 'UNAUTHORIZED') {
        // 如果已经有刷新请求在进行，等待它完成
        if (refreshPromise) {
          const refreshed = await refreshPromise;
          if (refreshed) {
            const retryResponse = await authenticatedFetch(url, options);
            return await retryResponse.json() as ApiResult<T>;
          }
        } else {
          // 开始新的刷新请求
          refreshPromise = refreshToken();
          const refreshed = await refreshPromise;
          refreshPromise = null;
          
          if (refreshed) {
            // 重试请求
            const retryResponse = await authenticatedFetch(url, options);
            return await retryResponse.json() as ApiResult<T>;
          } else {
            // 刷新失败，清除认证
            clearAuth();
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
          }
        }
      }
      
      return result;
    } catch (error) {
      logger.error('API 调用失败', { error: String(error), endpoint: url });
      return {
        success: false,
        error: { message: '网络请求失败' },
      };
    }
  };
}

// 创建默认的 API 调用函数
export const apiCall = createApiCaller();
