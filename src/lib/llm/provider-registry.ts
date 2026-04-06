/**
 * Provider Registry - Provider 注册与管理
 */
import { LLMProvider, LLMProviderConfig, ProviderType } from './provider-types';
import { OpenAICompatibleProvider } from './providers/openai-compatible';

// 预定义的 Provider 配置
const PROVIDER_CONFIGS: Record<ProviderType, { defaultBaseURL: string; defaultModel: string }> = {
  siliconflow: {
    defaultBaseURL: 'https://api.siliconflow.cn/v1',
    defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
  },
  openai: {
    defaultBaseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-3.5-turbo',
  },
  volcengine: {
    defaultBaseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultModel: 'doubao-pro-32k',
  },
  qwen: {
    defaultBaseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo',
  },
  zhipu: {
    defaultBaseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash',
  },
  custom: {
    defaultBaseURL: '',
    defaultModel: '',
  },
};

/**
 * 获取 Provider 配置
 * 优先使用统一变量，回退到平台专用变量
 */
export function getProviderConfig(): LLMProviderConfig {
  // 优先读取统一变量
  const unifiedProvider = process.env.LLM_PROVIDER as ProviderType | undefined;
  const unifiedBaseURL = process.env.LLM_BASE_URL;
  const unifiedApiKey = process.env.LLM_API_KEY;
  const unifiedModel = process.env.LLM_MODEL;

  if (unifiedProvider && unifiedApiKey) {
    const providerConfig = PROVIDER_CONFIGS[unifiedProvider] || PROVIDER_CONFIGS.custom;

    return {
      provider: unifiedProvider,
      baseURL: unifiedBaseURL || providerConfig.defaultBaseURL,
      apiKey: unifiedApiKey,
      model: unifiedModel || providerConfig.defaultModel,
      timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS || '60000', 10),
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048', 10),
    };
  }

  // 回退到平台专用变量
  // SiliconFlow
  const siliconflowKey = process.env.SILICONFLOW_API_KEY;
  if (siliconflowKey) {
    return {
      provider: 'siliconflow',
      baseURL: process.env.SILICONFLOW_BASE_URL || PROVIDER_CONFIGS.siliconflow.defaultBaseURL,
      apiKey: siliconflowKey,
      model: process.env.SILICONFLOW_MODEL || PROVIDER_CONFIGS.siliconflow.defaultModel,
    };
  }

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      provider: 'openai',
      baseURL: process.env.OPENAI_BASE_URL || PROVIDER_CONFIGS.openai.defaultBaseURL,
      apiKey: openaiKey,
      model: process.env.OPENAI_MODEL || PROVIDER_CONFIGS.openai.defaultModel,
    };
  }

  // VolcEngine
  const volcengineKey = process.env.VOLCENGINE_API_KEY;
  if (volcengineKey) {
    return {
      provider: 'volcengine',
      baseURL: process.env.VOLCENGINE_BASE_URL || PROVIDER_CONFIGS.volcengine.defaultBaseURL,
      apiKey: volcengineKey,
      model: process.env.VOLCENGINE_MODEL || PROVIDER_CONFIGS.volcengine.defaultModel,
    };
  }

  // Qwen
  const qwenKey = process.env.QWEN_API_KEY;
  if (qwenKey) {
    return {
      provider: 'qwen',
      baseURL: process.env.QWEN_BASE_URL || PROVIDER_CONFIGS.qwen.defaultBaseURL,
      apiKey: qwenKey,
      model: process.env.QWEN_MODEL || PROVIDER_CONFIGS.qwen.defaultModel,
    };
  }

  // Zhipu
  const zhipuKey = process.env.ZHIPU_API_KEY;
  if (zhipuKey) {
    return {
      provider: 'zhipu',
      baseURL: process.env.ZHIPU_BASE_URL || PROVIDER_CONFIGS.zhipu.defaultBaseURL,
      apiKey: zhipuKey,
      model: process.env.ZHIPU_MODEL || PROVIDER_CONFIGS.zhipu.defaultModel,
    };
  }

  // 没有配置任何 Provider
  throw new Error('未配置任何 LLM Provider，请设置环境变量');
}

/**
 * 创建 LLM Provider
 */
export function createLLMClient(config?: LLMProviderConfig): LLMProvider {
  const providerConfig = config || getProviderConfig();
  return new OpenAICompatibleProvider(providerConfig);
}

/**
 * 列出所有可用的 Provider
 */
export function listProviders(): string[] {
  return Object.keys(PROVIDER_CONFIGS);
}

/**
 * 检查是否配置了 Provider
 */
export function isProviderConfigured(): boolean {
  try {
    getProviderConfig();
    return true;
  } catch {
    return false;
  }
}
