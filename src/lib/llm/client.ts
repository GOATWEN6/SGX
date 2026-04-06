/**
 * LLM Client - 统一的 LLM 调用接口
 */
import { createLLMClient, getProviderConfig, isProviderConfigured } from './provider-registry';
import { LLMProvider, LLMRequest, LLMResponse } from './provider-types';

let globalClient: LLMProvider | null = null;

/**
 * 获取全局 LLM Client（单例）
 */
export function getLLMClient(): LLMProvider {
  if (!globalClient) {
    if (!isProviderConfigured()) {
      throw new Error('LLM Provider 未配置，请设置环境变量');
    }
    globalClient = createLLMClient();
  }
  return globalClient;
}

/**
 * 调用 LLM（兼容旧接口）
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const client = getLLMClient();

  const response = await client.call({
    systemPrompt,
    userPrompt,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  return response.rawText;
}

/**
 * 调用 LLM 并返回完整响应
 */
export async function callLLMFull(
  request: LLMRequest
): Promise<LLMResponse> {
  const client = getLLMClient();
  return client.call(request);
}

/**
 * 安全解析 JSON（带多种兜底策略）
 */
export function parseJsonSafely<T>(text: string, fallback: T | null): T | null {
  if (!text || typeof text !== 'string') {
    return fallback;
  }

  // 策略1: 直接解析
  try {
    const direct = JSON.parse(text);
    if (direct && typeof direct === 'object') {
      return direct as T;
    }
  } catch {
    // 继续下一个策略
  }

  // 策略2: 提取 fenced JSON (```json ... ```)
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch && fencedMatch[1]) {
    try {
      const fenced = JSON.parse(fencedMatch[1].trim());
      if (fenced && typeof fenced === 'object') {
        return fenced as T;
      }
    } catch {
      // 继续下一个策略
    }
  }

  // 策略3: 提取首个对象 {...}
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]);
      if (obj && typeof obj === 'object') {
        return obj as T;
      }
    } catch {
      // 继续下一个策略
    }
  }

  // 策略4: 提取数组 [...], 用于列表类响应
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    try {
      const arr = JSON.parse(arrayMatch[0]);
      if (Array.isArray(arr)) {
        return arr as T;
      }
    } catch {
      // 继续下一个策略
    }
  }

  // 兜底: 返回默认值
  return fallback;
}

/**
 * 获取当前 Provider 信息
 */
export function getCurrentProviderInfo(): { provider: string; model: string } {
  const config = getProviderConfig();
  return {
    provider: config.provider,
    model: config.model,
  };
}

/**
 * 重置 LLM Client（用于切换 Provider）
 */
export function resetLLMClient(): void {
  globalClient = null;
}
