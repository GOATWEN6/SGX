/**
 * OpenAI 兼容 Provider 实现
 * 作为大多数 Provider 的基础实现
 */
import OpenAI from 'openai';
import { LLMProvider, LLMRequest, LLMResponse, LLMProviderConfig } from '../provider-types';
import { logger } from '../../logger';

export class OpenAICompatibleProvider implements LLMProvider {
  private client: OpenAI;
  private config: LLMProviderConfig;
  private providerName: string;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.providerName = config.provider;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || this.getDefaultBaseURL(),
      timeout: config.timeoutMs || 60000,
      maxRetries: 2,
    });
  }

  private getDefaultBaseURL(): string {
    switch (this.config.provider) {
      case 'siliconflow':
        return 'https://api.siliconflow.cn/v1';
      case 'openai':
        return 'https://api.openai.com/v1';
      case 'volcengine':
        return 'https://ark.cn-beijing.volces.com/api/v3';
      case 'qwen':
        return 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      case 'zhipu':
        return 'https://open.bigmodel.cn/api/paas/v4';
      default:
        return 'https://api.openai.com/v1';
    }
  }

  async call(request: LLMRequest): Promise<LLMResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt },
        ],
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2048,
        response_format: request.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      });

      const rawText = response.choices[0]?.message?.content || '';

      // 尝试解析 JSON
      let parsed: unknown = undefined;
      if (request.responseFormat === 'json') {
        try {
          parsed = JSON.parse(rawText);
        } catch {
          // JSON 解析失败，保持 undefined
        }
      }

      return {
        rawText,
        parsed,
        provider: this.providerName,
        model: this.config.model,
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      logger.error(`[${this.providerName}] LLM 调用失败: {error}`, { error: String(error) });
      throw new Error(`LLM 调用失败 (${this.providerName}): ${error}`);
    }
  }

  getProviderName(): string {
    return this.providerName;
  }

  getModel(): string {
    return this.config.model;
  }
}
