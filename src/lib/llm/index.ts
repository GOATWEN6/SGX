/**
 * LLM 模块 - 多 Provider 兼容层
 *
 * 使用方法：
 * 1. 设置环境变量（推荐使用统一变量）：
 *    LLM_PROVIDER=siliconflow
 *    LLM_API_KEY=your-api-key
 *    LLM_MODEL=Qwen/Qwen2.5-7B-Instruct
 *
 * 2. 或者使用平台专用变量：
 *    SILICONFLOW_API_KEY=...
 *    OPENAI_API_KEY=...
 *    VOLCENGINE_API_KEY=...
 *    QWEN_API_KEY=...
 *    ZHIPU_API_KEY=...
 *
 * 3. 调用方式：
 *    import { callLLM, getCurrentProviderInfo } from '@/lib/llm';
 *
 *    const response = await callLLM(systemPrompt, userPrompt);
 */
export * from './client';
export * from './provider-registry';
export * from './provider-types';
