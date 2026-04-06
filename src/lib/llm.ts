/**
 * AI 回忆录助手 - LLM 调用模块
 * 统一使用 provider-registry 架构
 */

import fs from 'fs';
import path from 'path';
import {
  createLLMClient,
  getProviderConfig,
  isProviderConfigured,
} from './llm/provider-registry';
import { parseJsonSafely } from './llm/client';
import { logger } from './logger';
import {
  ChatRequest,
  ChatResponse,
  GenerateMemoirRequest,
  GenerateMemoirResponse,
  ReviewMemoirRequest,
  ReviewMemoirResponse,
  UserProfile,
  Session,
  MemoryCard,
  MemoirDraft,
  ReviewRound,
  StyleProfile,
  Topic,
} from '@/types';

// 检查 Provider 是否已配置
const checkProvider = () => {
  if (!isProviderConfigured()) {
    throw new Error('LLM Provider 未配置，请设置环境变量');
  }
};

// 缓存客户端实例
let llmClient: ReturnType<typeof createLLMClient> | null = null;

/**
 * 获取 LLM 客户端
 */
function getLLMClient() {
  if (!llmClient) {
    checkProvider();
    llmClient = createLLMClient();
  }
  return llmClient;
}

/**
 * 调用 LLM 生成响应
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  checkProvider();
  const client = getLLMClient();

  try {
    const response = await client.call({
      systemPrompt,
      userPrompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    return response.rawText;
  } catch (llmError) {
    logger.error('LLM 调用失败: {error}', { error: String(llmError) });
    throw new Error(`LLM 调用失败: ${String(llmError)}`);
  }
}

/**
 * 统一的安全 JSON 解析器
 * 支持多种兜底策略
 */
// 使用 any 作为中间类型来避免泛型问题
const safeParse = (text: string, fallback: any) => parseJsonSafely(text, fallback);

export function parseLLMResponse<T>(text: string, fallback: T): T {
  // 策略1: 直接解析
  const direct = safeParse(text, null);
  
  if (direct) return direct;
  
  // 策略2: 提取 fenced JSON
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fencedMatch) {
    const fenced = safeParse(fencedMatch[1].trim(), null);
    if (fenced) return fenced;
  }
  
  // 策略3: 提取首个对象
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    const obj = safeParse(objMatch[0], null);
    if (obj) return obj;
  }
  
  // 兜底: 返回默认值
  return fallback;
}

/**
 * 读取 Prompt 文件
 */
export function readPromptFile(filename: string): string {
  const filePath = path.join(process.cwd(), 'src', 'prompts', filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    logger.warn('读取 Prompt 文件失败: {filename}, {error}', { filename, error: String(error) });
    return '';
  }
}

// ==================== Prompt 模板函数 ====================

/**
 * 填充 System Prompt
 */
export function fillSystemPrompt(userProfile: UserProfile): string {
  const template = readPromptFile('system.md');
  return template
    .replace('{useHonorific}', userProfile.useHonorific ? '您' : '你')
    .replace('{userName}', userProfile.name);
}

/**
 * 填充 Interviewer Prompt
 */
export function fillInterviewerPrompt(params: {
  userProfile: UserProfile;
  currentPhase: string;
  phaseDescription: string;
  phaseDetails: string;
  collectedInfo: string;
  sessionHistory: string;
  latestUserMessage: string;
}): string {
  const template = readPromptFile('interviewer.md');

  return template
    .replace('{userName}', params.userProfile.name)
    .replace('{currentPhase}', params.currentPhase)
    .replace('{phaseDescription}', params.phaseDescription)
    .replace('{phaseDetails}', params.phaseDetails)
    .replace('{collectedInfo}', params.collectedInfo)
    .replace('{useHonorific}', params.userProfile.useHonorific ? '您' : '你')
    .replace('{latestUserMessage}', params.latestUserMessage || '（暂无）')
    .replace('{recentConversation}', params.sessionHistory || '（暂无历史对话）');
}

/**
 * 填充 Memoir Writer Prompt
 */
export function fillMemoirWriterPrompt(params: {
  userProfile: UserProfile;
  memoirMaterials: string;
  styleProfile: StyleProfile;
  memoirType: string;
  typeDescription: string;
}): string {
  const template = readPromptFile('memoir-writer.md');
  const style = params.styleProfile;
  
  return template
    .replace('{userName}', params.userProfile.name)
    .replace('{memoirGoal}', params.userProfile.memoirGoal)
    .replace('{styleName}', style.name)
    .replace('{useHonorific}', params.userProfile.useHonorific ? '您' : '你')
    .replace('{memoirMaterials}', params.memoirMaterials)
    .replace('{sentenceLength}', style.sentenceLength)
    .replace('{wordDensity}', style.wordDensity)
    .replace('{emotionalIntensity}', style.emotionalIntensity)
    .replace('{useImagery}', style.useImagery ? '是' : '否')
    .replace('{usePhilosophy}', style.usePhilosophy ? '是' : '否')
    .replace('{preserveColloquial}', style.preserveColloquial ? '是' : '否')
    .replace('{ProhibitedItems}', style.prohibited.join('\n'))
    .replace('{memoirType}', params.memoirType)
    .replace('{typeDescription}', params.typeDescription);
}

/**
 * 填充 Critic Prompt
 */
export function fillCriticPrompt(params: {
  memoirContent: string;
  userProfile: UserProfile;
  memoirType: string;
  styleName: string;
  wordCount: number;
  version: number;
  sourceCards?: string;
  quotes?: string;
  uncertainFacts?: string;
}): string {
  const template = readPromptFile('critic.md');

  const background = [
    params.userProfile.birthPlace && `出生地: ${params.userProfile.birthPlace}`,
    params.userProfile.grewUpPlace && `成长地: ${params.userProfile.grewUpPlace}`,
    params.userProfile.education && `受教育程度: ${params.userProfile.education}`,
  ].filter(Boolean).join(', ');

  return template
    .replace('{memoirType}', params.memoirType)
    .replace('{styleName}', params.styleName)
    .replace('{wordCount}', params.wordCount.toString())
    .replace('{version}', params.version.toString())
    .replace('{userName}', params.userProfile.name)
    .replace('{ageGroup}', params.userProfile.ageGroup || '未知')
    .replace('{background}', background || '无更多信息')
    .replace('{memoirContent}', params.memoirContent)
    .replace('{sourceCards}', params.sourceCards || '无素材卡片')
    .replace('{quotes}', params.quotes || '无引用')
    .replace('{uncertainFacts}', params.uncertainFacts || '无待确认事实');
}

/**
 * 填充 Summarizer Prompt
 */
export function fillSummarizerPrompt(params: {
  userProfile: UserProfile;
  currentPhase: string;
  previousInfo: string;
  userMessage: string;
}): string {
  const template = readPromptFile('summarizer.md');

  return template
    .replace('{userName}', params.userProfile.name)
    .replace('{currentPhase}', params.currentPhase)
    .replace('{previousInfo}', params.previousInfo)
    .replace('{userMessage}', params.userMessage);
}

/**
 * 填充 Rewriter Prompt
 */
export function fillRewriterPrompt(params: {
  memoirContent: string;
  userProfile: UserProfile;
  memoirType: string;
  styleName: string;
  version: number;
  review: ReviewRound;
  sourceCards: string;
  quotes: string;
  uncertainFacts: string;
}): string {
  const template = readPromptFile('rewriter.md');

  const scores = params.review.scores;

  // 构建问题与证据
  const issuesAndEvidence = params.review.evidence?.map(e => {
    return `- [${e.type}] ${e.issue}${e.quote ? ` "${e.quote}"` : ''}${e.suggestion ? ` 建议: ${e.suggestion}` : ''}`;
  }).join('\n') || params.review.issues.join('\n');

  return template
    .replace('{memoirType}', params.memoirType)
    .replace('{styleName}', params.styleName)
    .replace('{version}', (params.version + 1).toString())
    .replace('{userName}', params.userProfile.name)
    .replace('{ageGroup}', params.userProfile.ageGroup || '未知')
    .replace('{memoirContent}', params.memoirContent)
    .replace('{reviewRound}', params.review.roundNumber.toString())
    .replace('{authenticityScore}', scores.authenticity.toString())
    .replace('{coherenceScore}', scores.coherence.toString())
    .replace('{detailScore}', scores.detailLevel.toString())
    .replace('{characterScore}', scores.characterPresence.toString())
    .replace('{emotionScore}', scores.emotionalDepth.toString())
    .replace('{eraScore}', scores.eraAtmosphere.toString())
    .replace('{languageScore}', scores.languageNaturalness.toString())
    .replace('{voiceScore}', scores.voicePreservation.toString())
    .replace('{readabilityScore}', scores.readability.toString())
    .replace('{safetyScore}', scores.safety.toString())
    .replace('{totalScore}', scores.total.toString())
    .replace('{strengths}', params.review.strengths.join('\n- '))
    .replace('{issuesAndEvidence}', issuesAndEvidence)
    .replace('{suggestions}', params.review.suggestions.join('\n- '))
    .replace('{rewritePriority}', params.review.rewritePriority || 'medium')
    .replace('{rewriteFocus}', params.review.rewriteFocus || '无特定重点')
    .replace('{sourceCards}', params.sourceCards)
    .replace('{quotes}', params.quotes)
    .replace('{uncertainFacts}', params.uncertainFacts);
}

// ==================== 访谈功能 ====================

/**
 * 获取访谈阶段的描述
 */
export function getPhaseDescription(phase: string): { description: string; details: string } {
  const phases: Record<string, { description: string; details: string }> = {
    ice_breaker: {
      description: '破冰与信任建立',
      details: '使用轻松的话题，建立信任关系，让用户感到舒适。'
    },
    basic_info: {
      description: '基本人生信息',
      details: '了解用户的背景信息，但不要像填表格一样审问。'
    },
    childhood: {
      description: '童年与家庭',
      details: '鼓励回忆早年生活，关注家庭成员和场景细节。'
    },
    education: {
      description: '学校与成长',
      details: '了解求学经历，关注学校生活对人生的影响。'
    },
    career: {
      description: '工作与事业',
      details: '了解职业历程，第一份工作，最难忘的工作经历。'
    },
    family: {
      description: '婚恋与家庭生活',
      details: '谨慎处理婚恋话题，关注家庭生活的温暖细节。'
    },
    migration: {
      description: '迁徙与时代变化',
      details: '了解地理变迁，时代背景对个人的影响。'
    },
    challenges: {
      description: '重大困难与转折',
      details: '极其敏感，需要非常小心，用户不愿意说不要勉强。'
    },
    proud_moments: {
      description: '最骄傲的时刻',
      details: '让人感到自豪的经历，成就感。'
    },
    reflections: {
      description: '遗憾、和解、领悟',
      details: '人生感悟和智慧，与过去的和解。'
    },
    legacy: {
      description: '想留给后人的话',
      details: '最想说的话，人生总结，对后辈的期望。'
    },
  };
  
  return phases[phase] || { description: '访谈', details: '' };
}

/**
 * 处理用户消息，返回 AI 响应
 */
export async function processChatMessage(
  request: ChatRequest,
  session: Session,
  userProfile: UserProfile,
  sessionHistory: string
): Promise<ChatResponse> {
  // 获取当前阶段信息
  const phaseInfo = getPhaseDescription(userProfile.currentPhase);

  // 构建 prompt
  const systemPrompt = fillSystemPrompt(userProfile);
  const userPrompt = fillInterviewerPrompt({
    userProfile,
    currentPhase: userProfile.currentPhase,
    phaseDescription: phaseInfo.description,
    phaseDetails: phaseInfo.details,
    collectedInfo: getCollectedInfoSummary(userProfile),
    sessionHistory,
    latestUserMessage: request.message,
  });
  
  // 调用 LLM
  const response = await callLLM(systemPrompt, userPrompt, {
    temperature: 0.8,
    maxTokens: 1024,
  });
  
  // 解析响应 - 使用鲁棒解析器
  const parsed = parseLLMResponse<{
    message?: string;
    nextQuestion?: string;
    shouldFollowUp?: boolean;
    detectedTopics?: string[];
    suggestedCards?: any[];
    sessionSummary?: string;
  }>(response, {});
  
  if (parsed && parsed.message) {
    return {
      message: parsed.message,
      nextQuestion: parsed.nextQuestion,
      shouldFollowUp: parsed.shouldFollowUp || false,
      suggestedTopics: parsed.detectedTopics || [],
      detectedCards: parsed.suggestedCards || [],
      sessionSummary: parsed.sessionSummary,
    };
  }
  
  // 解析失败，直接返回原始响应
  return {
    message: response,
    nextQuestion: undefined,
    shouldFollowUp: false,
  };
}

/**
 * 获取已收集信息的摘要
 */
function getCollectedInfoSummary(userProfile: UserProfile): string {
  const info: string[] = [];
  
  if (userProfile.birthPlace) info.push(`出生地: ${userProfile.birthPlace}`);
  if (userProfile.grewUpPlace) info.push(`成长地: ${userProfile.grewUpPlace}`);
  if (userProfile.education) info.push(`教育: ${userProfile.education}`);
  if (userProfile.ageGroup) info.push(`年龄段: ${userProfile.ageGroup}`);
  
  return info.length > 0 ? info.join('\n') : '暂无收集到基本信息';
}

// ==================== 回忆录生成功能 ====================

/**
 * 生成回忆录
 */
export async function generateMemoir(
  request: GenerateMemoirRequest,
  userProfile: UserProfile,
  memoryCards: MemoryCard[],
  styleProfile: StyleProfile
): Promise<GenerateMemoirResponse> {
  // 准备素材
  const materials = prepareMemoirMaterials(memoryCards);
  
  // 获取类型描述
  const typeDescription = getMemoirTypeDescription(request.type);
  
  // 构建 prompt
  const systemPrompt = fillSystemPrompt(userProfile);
  const userPrompt = fillMemoirWriterPrompt({
    userProfile,
    memoirMaterials: materials,
    styleProfile,
    memoirType: request.type,
    typeDescription,
  });
  
  // 调用 LLM
  const response = await callLLM(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: request.length === 'long' ? 4096 : 2048,
  });
  
  // 解析响应 - 使用鲁棒解析器
  const parsed = parseLLMResponse<{
    title?: string;
    content?: string;
    referencedCards?: string[];
    notes?: string;
  }>(response, {});
  
  if (parsed && parsed.content) {
    return {
      draft: {
        id: '',
        userId: request.userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        type: request.type,
        styleId: request.styleId,
        title: parsed.title,
        content: parsed.content,
        status: 'draft',
        version: 1,
        reviewRounds: [],
        referencedCards: parsed.referencedCards || [],
        exportedFormats: [],
      },
      usedCards: parsed.referencedCards || [],
      generationNotes: parsed.notes,
    };
  }
  
  // 解析失败，返回原始内容
  return {
    draft: {
      id: '',
      userId: request.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      type: request.type,
      styleId: request.styleId,
      content: response,
      status: 'draft',
      version: 1,
      reviewRounds: [],
      referencedCards: [],
      exportedFormats: [],
    },
    usedCards: [],
  };
}

/**
 * 准备回忆录素材
 */
function prepareMemoirMaterials(cards: MemoryCard[]): string {
  const sections: string[] = [];

  // 按类型分组
  const personCards = cards.filter(c => c.type === 'person');
  const eventCards = cards.filter(c => c.type === 'event');
  const placeCards = cards.filter(c => c.type === 'place');
  const quotes = cards.filter(c => c.type === 'quote_snippet');
  const timeline = cards.filter(c => c.type === 'timeline_entry');

  if (personCards.length > 0) {
    sections.push('## 重要人物\n');
    personCards.forEach(card => {
      const p = card as any;
      sections.push(`- ${p.fullName || card.title} (${p.relationship || '相关人物'}): ${card.content}`);
    });
  }

  if (eventCards.length > 0) {
    sections.push('\n## 重要事件\n');
    eventCards.forEach(card => {
      const e = card as any;
      sections.push(`- ${card.title} (${e.year || '年份不详'}): ${card.content}`);
    });
  }

  if (placeCards.length > 0) {
    sections.push('\n## 重要地点\n');
    placeCards.forEach(card => {
      const p = card as any;
      sections.push(`- ${card.title}: ${card.content}`);
    });
  }

  if (quotes.length > 0) {
    sections.push('\n## 经典语录\n');
    quotes.forEach(card => {
      const q = card as any;
      sections.push(`- "${q.quote}" - 用户`);
    });
  }

  if (timeline.length > 0) {
    sections.push('\n## 时间线\n');
    timeline.forEach(card => {
      const t = card as any;
      sections.push(`- ${t.year}: ${card.title}`);
    });
  }

  return sections.join('\n');
}

/**
 * 准备素材卡片摘要（用于 Critic）
 */
function prepareSourceCardsSummary(cards: MemoryCard[]): string {
  if (!cards || cards.length === 0) {
    return '无素材卡片';
  }

  const sections: string[] = [];

  const personCards = cards.filter(c => c.type === 'person');
  const eventCards = cards.filter(c => c.type === 'event');
  const placeCards = cards.filter(c => c.type === 'place');

  if (personCards.length > 0) {
    sections.push('【人物】');
    personCards.forEach(card => {
      const p = card as any;
      sections.push(`- ${p.fullName || card.title} (${p.relationship || '相关'}): ${card.content}`);
    });
  }

  if (eventCards.length > 0) {
    sections.push('【事件】');
    eventCards.forEach(card => {
      const e = card as any;
      sections.push(`- ${card.title}: ${card.content}`);
    });
  }

  if (placeCards.length > 0) {
    sections.push('【地点】');
    placeCards.forEach(card => {
      sections.push(`- ${card.title}: ${card.content}`);
    });
  }

  return sections.join('\n');
}

/**
 * 准备引用摘要（用于 Critic）
 */
function prepareQuotesSummary(cards: MemoryCard[]): string {
  const quotes = cards.filter(c => c.type === 'quote_snippet');

  if (quotes.length === 0) {
    return '无引用';
  }

  return quotes.map(q => {
    const quote = q as any;
    return `- "${quote.quote}"`;
  }).join('\n');
}

/**
 * 准备待确认事实摘要（用于 Critic）
 */
function prepareUncertainFactsSummary(cards: MemoryCard[]): string {
  const uncertainFacts = cards.filter(c => c.type === 'uncertain_fact' || c.isUncertain);

  if (uncertainFacts.length === 0) {
    return '无待确认事实';
  }

  return uncertainFacts.map(f => {
    return `- ${f.title}: ${f.content}`;
  }).join('\n');
}

/**
 * 获取回忆录类型描述
 */
export function getMemoirTypeDescription(type: string): string {
  const types: Record<string, string> = {
    fragment: '100-300字的片段，捕捉一个瞬间或一个小场景',
    short_essay: '800-1500字的短篇，讲述一个完整的故事或主题',
    chapter: '3000-5000字的章节，可以讲述人生的一个阶段或主题',
    book_outline: '全书目录草案，规划整本回忆录的结构',
    character_bio: '人物小传，详细描述一个重要人物',
    family_preface: '家族纪念版前言，表达对家族的情感',
    letter: '给晚辈的一封信，亲切而真挚',
    oral_history: '口述实录，保留口语质感',
  };
  return types[type] || '回忆录内容';
}

// ==================== 评审功能 ====================

/**
 * 评审回忆录
 */
export async function reviewMemoir(
  request: ReviewMemoirRequest,
  draft: MemoirDraft,
  userProfile: UserProfile,
  styleProfile: StyleProfile,
  memoryCards: MemoryCard[]
): Promise<ReviewMemoirResponse> {
  // 准备素材信息
  const sourceCards = prepareSourceCardsSummary(memoryCards);
  const quotes = prepareQuotesSummary(memoryCards);
  const uncertainFacts = prepareUncertainFactsSummary(memoryCards);

  // 构建 prompt
  const systemPrompt = fillSystemPrompt(userProfile);
  const userPrompt = fillCriticPrompt({
    memoirContent: draft.content,
    userProfile,
    memoirType: draft.type,
    styleName: styleProfile.name,
    wordCount: draft.content.length,
    version: draft.version,
    sourceCards,
    quotes,
    uncertainFacts,
  });
  
  // 调用 LLM
  const response = await callLLM(systemPrompt, userPrompt, {
    temperature: 0.5,
    maxTokens: 2048,
  });
  
  // 解析响应 - 使用鲁棒解析器
  const parsed = parseLLMResponse<{
    scores?: any;
    strengths?: string[];
    issues?: string[];
    evidence?: any[];
    suggestions?: string[];
    shouldRewrite?: boolean;
    rewritePriority?: string;
    rewriteFocus?: string;
  }>(response, {});
  
  const review: ReviewRound = {
    roundNumber: draft.reviewRounds.length + 1,
    timestamp: new Date().toISOString(),
    scores: parsed?.scores || {
      authenticity: 5,
      coherence: 5,
      detailLevel: 5,
      characterPresence: 5,
      emotionalDepth: 5,
      eraAtmosphere: 5,
      languageNaturalness: 5,
      voicePreservation: 5,
      readability: 5,
      safety: 5,
      total: 50,
    },
    strengths: parsed?.strengths || [],
    issues: parsed?.issues || [],
    evidence: parsed?.evidence || [],
    suggestions: parsed?.suggestions || [],
    shouldRewrite: parsed?.shouldRewrite || false,
    rewritePriority: parsed?.rewritePriority as ReviewRound['rewritePriority'],
    rewriteFocus: parsed?.rewriteFocus,
  };

  return { review };
}

// ==================== 重写功能 ====================

/**
 * 重写回忆录
 */
export async function rewriteMemoir(
  draft: MemoirDraft,
  userProfile: UserProfile,
  styleProfile: StyleProfile,
  memoryCards: MemoryCard[]
): Promise<{
  title?: string;
  content: string;
  changesSummary: string;
  referencedCards: string[];
  uncertainFactsUsed: string[];
}> {
  // 获取最后一次评审
  const lastReview = draft.reviewRounds[draft.reviewRounds.length - 1];
  if (!lastReview) {
    throw new Error('没有评审记录，无法重写');
  }

  // 准备素材信息
  const sourceCards = prepareSourceCardsSummary(memoryCards);
  const quotes = prepareQuotesSummary(memoryCards);
  const uncertainFacts = prepareUncertainFactsSummary(memoryCards);

  // 构建 prompt
  const systemPrompt = fillSystemPrompt(userProfile);
  const userPrompt = fillRewriterPrompt({
    memoirContent: draft.content,
    userProfile,
    memoirType: draft.type,
    styleName: styleProfile.name,
    version: draft.version,
    review: lastReview,
    sourceCards,
    quotes,
    uncertainFacts,
  });

  // 调用 LLM
  const response = await callLLM(systemPrompt, userPrompt, {
    temperature: 0.7,
    maxTokens: 4096,
  });

  // 解析响应 - 使用鲁棒解析器
  const parsed = parseLLMResponse<{
    title?: string;
    content?: string;
    changesSummary?: string;
    referencedCards?: string[];
    uncertainFactsUsed?: string[];
  }>(response, {});
  
  if (parsed && parsed.content) {
    return {
      title: parsed.title || draft.title,
      content: parsed.content,
      changesSummary: parsed.changesSummary || '根据评审意见进行了修改',
      referencedCards: parsed.referencedCards || draft.referencedCards,
      uncertainFactsUsed: parsed.uncertainFactsUsed || [],
    };
  }
  
  // 解析失败，返回原始内容
  return {
    title: draft.title,
    content: response,
    changesSummary: '重写失败，返回原始内容',
    referencedCards: draft.referencedCards,
    uncertainFactsUsed: [],
  };
}

// ==================== 总结功能 ====================

/**
 * 总结用户消息
 */
export async function summarizeMessage(
  userProfile: UserProfile,
  currentPhase: string,
  previousInfo: string,
  userMessage: string
): Promise<any> {
  const systemPrompt = '你是一个对话总结专家，请从用户的回答中提取关键信息。';
  const userPrompt = fillSummarizerPrompt({
    userProfile,
    currentPhase,
    previousInfo,
    userMessage,
  });
  
  const response = await callLLM(systemPrompt, userPrompt, {
    temperature: 0.3,
    maxTokens: 1024,
  });
  
  const parsed = safeParse(response, null);
  if (parsed) return parsed;
  
  return {
    summary: userMessage.substring(0, 100),
    keyPoints: [],
  };
}

// ==================== 工具函数 ====================

/**
 * 加载文风配置
 */
export function loadStyleProfiles(): StyleProfile[] {
  try {
    const data = fs.readFileSync(
      path.join(process.cwd(), 'src', 'data', 'styles.json'),
      'utf-8'
    );
    const parsed = JSON.parse(data);
    return parsed.styles || [];
  } catch (error) {
    logger.error('加载文风配置失败: {error}', { error: String(error) });
    return [];
  }
}

/**
 * 根据 ID 获取文风配置
 */
export function getStyleProfileById(id: string): StyleProfile | null {
  const styles = loadStyleProfiles();
  return styles.find(s => s.id === id) || null;
}

/**
 * 加载话题库
 */
export function loadTopics(): Topic[] {
  try {
    const data = fs.readFileSync(
      path.join(process.cwd(), 'src', 'data', 'topics.json'),
      'utf-8'
    );
    const parsed = JSON.parse(data);
    return parsed.topics || [];
  } catch (error) {
    logger.error('加载话题库失败: {error}', { error: String(error) });
    return [];
  }
}

/**
 * 根据阶段获取适合的话题
 */
/** 访谈引擎阶段 ID → topics.json 中使用的 phase 标签 */
const PHASE_ALIASES_FOR_TOPICS: Record<string, string[]> = {
  marriage_family: ['family', 'marriage_family'],
  hardship: ['challenges', 'hardship'],
  friendship: ['migration', 'friendship'],
};

export function getTopicsByPhase(phase: string): Topic[] {
  const topics = loadTopics();
  const match = PHASE_ALIASES_FOR_TOPICS[phase] ?? [phase];
  return topics.filter(t => t.phases.some(p => match.includes(p)));
}

/**
 * 根据敏感度过滤话题
 */
export function filterTopicsBySensitivity(
  topics: Topic[],
  userProfile: UserProfile
): Topic[] {
  return topics.filter(topic => {
    if (topic.sensitivity > 3) {
      if (topic.sensitivity === 4 && !userProfile.acceptLossTopics) return false;
      if (topic.sensitivity === 5 && !userProfile.acceptWarTopics) return false;
    }
    return true;
  });
}
