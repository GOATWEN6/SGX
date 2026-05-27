/**
 * LLM Provider 类型定义
 */

// Provider 类型
export type ProviderType = 'siliconflow' | 'openai' | 'volcengine' | 'qwen' | 'zhipu' | 'custom';

// Provider 配置
export interface LLMProviderConfig {
  provider: ProviderType;
  baseURL?: string;
  apiKey: string;
  model: string;
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

// LLM 请求
export interface LLMRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json' | 'text';
}

// LLM 响应
export interface LLMResponse {
  rawText: string;
  parsed?: unknown;
  provider: string;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// Provider 接口
export interface LLMProvider {
  call(request: LLMRequest): Promise<LLMResponse>;
  stream?(request: LLMRequest): AsyncIterable<string>;
  getProviderName(): string;
  getModel(): string;
}

// Provider 注册表
export interface ProviderRegistry {
  getProvider(config: LLMProviderConfig): LLMProvider;
  listProviders(): string[];
}
