/**
 * 访谈引擎 - 核心模块
 *
 * 负责管理整个访谈流程：
 * - 阶段管理
 * - 话题排序
 * - 追问决策
 * - 上下文构建
 */

export * from './types';
export * from './phase-manager';
export * from './topic-ranker';
export * from './follow-up-decider';

import { InterviewPhase, UserProfile, MemoryCard, Topic } from '@/types';
import {
  InterviewContext,
  SessionProgress,
  KnownFact,
  RankedTopic,
} from './types';
import {
  getPhaseConfig,
  getNextPhase,
  shouldAdvancePhase,
  getPhaseSensitivity,
} from './phase-manager';
import { rankTopics, getCandidateTopics, getBlockedTopics } from './topic-ranker';
import { decideFollowUp, analyzeUserSignals } from './follow-up-decider';
import { logger } from '../logger';

/**
 * 构建访谈上下文
 */
export function buildInterviewContext(params: {
  userId: string;
  sessionId: string;
  currentPhase: InterviewPhase;
  userProfile: UserProfile;
  memoryCards: MemoryCard[];
  recentMessages: string[];
  sessionMessageCount: number;
  lastTopicAsked?: string;
}): InterviewContext {
  const { userId, sessionId, currentPhase, userProfile, memoryCards, recentMessages, sessionMessageCount, lastTopicAsked } = params;

  const phaseConfig = getPhaseConfig(currentPhase);

  // 从记忆卡片中提取已知事实
  const knownFacts = extractKnownFacts(memoryCards);

  // 加载话题库并排序
  const topics = loadTopics();
  const context: InterviewContext = {
    userId,
    sessionId,
    currentPhase,
    phaseConfig,
    knownFacts,
    recentMessages,
    candidateTopics: [],
    blockedTopics: [],
    sessionMessageCount,
    lastTopicAsked,
    sensitivityLevel: getPhaseSensitivity(currentPhase),
  };

  // 排序话题
  const rankedTopics = rankTopics(topics, context, userProfile);
  context.candidateTopics = rankedTopics;
  context.blockedTopics = getBlockedTopics(rankedTopics);

  return context;
}

/**
 * 从记忆卡片中提取已知事实
 */
function extractKnownFacts(cards: MemoryCard[]): KnownFact[] {
  return cards.map(card => ({
    key: card.title,
    value: card.content,
    sourceCardId: card.id,
    confidence: card.confidence,
    isUncertain: card.isUncertain,
  }));
}

/**
 * 加载话题库
 */
function loadTopics(): Topic[] {
  try {
    const fs = require('fs');
    const path = require('path');
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
 * 获取会话进度
 */
export function getSessionProgress(params: {
  currentPhase: InterviewPhase;
  messageCount: number;
  cardsExtracted: number;
  coveredTopics: string[];
}): SessionProgress {
  const { currentPhase, messageCount, cardsExtracted, coveredTopics } = params;

  const phaseConfig = getPhaseConfig(currentPhase);
  const nextPhase = getNextPhase(currentPhase);

  // 计算进度
  const criteriaCount = phaseConfig.completionCriteria.length;
  const completedCount = phaseConfig.completionCriteria.filter(criterion =>
    coveredTopics.some(topic => criterion.includes(topic))
  ).length;

  const progress = criteriaCount > 0
    ? Math.round((completedCount / criteriaCount) * 100)
    : Math.min(100, Math.round((messageCount / 10) * 100));

  // 获取剩余话题
  const remainingTopics = phaseConfig.recommendedTopics.filter(
    topic => !coveredTopics.includes(topic)
  );

  return {
    phase: currentPhase,
    progress,
    messageCount,
    cardsExtracted,
    keyTopicsCovered: coveredTopics,
    remainingTopics,
  };
}

/**
 * 决定是否推进阶段
 */
export function shouldProgressToNextPhase(params: {
  currentPhase: InterviewPhase;
  messageCount: number;
  cardsExtracted: number;
  coveredTopics: string[];
}): { shouldAdvance: boolean; nextPhase?: InterviewPhase; progress: number } {
  const { currentPhase, messageCount, cardsExtracted, coveredTopics } = params;

  const decision = shouldAdvancePhase(
    currentPhase,
    messageCount,
    cardsExtracted,
    coveredTopics
  );

  return {
    shouldAdvance: decision.shouldAdvance,
    nextPhase: decision.nextPhase,
    progress: decision.progress,
  };
}

/**
 * 决定追问
 */
export function makeFollowUpDecision(params: {
  userMessage: string;
  currentDepth: number;
  previousMessages: string[];
}): { shouldFollowUp: boolean; question?: string; shouldStop: boolean } {
  const { userMessage, currentDepth, previousMessages } = params;

  const userSignals = analyzeUserSignals(userMessage, previousMessages);
  const decision = decideFollowUp(userMessage, currentDepth, userSignals);

  return {
    shouldFollowUp: decision.shouldFollowUp,
    question: decision.followUpQuestion,
    shouldStop: decision.shouldStop,
  };
}

/**
 * 获取当前阶段的推荐话题
 */
export function getRecommendedTopics(params: {
  currentPhase: InterviewPhase;
  userProfile: UserProfile;
  limit?: number;
}): RankedTopic[] {
  const { currentPhase, userProfile, limit = 5 } = params;

  const context = buildInterviewContext({
    userId: '',
    sessionId: '',
    currentPhase,
    userProfile,
    memoryCards: [],
    recentMessages: [],
    sessionMessageCount: 0,
  });

  return getCandidateTopics(context.candidateTopics, limit);
}

/**
 * 获取阶段描述（兼容旧接口）
 */
export function getPhaseDescription(phase: string): { description: string; details: string; objective: string; completion: string } {
  const config = getPhaseConfig(phase as InterviewPhase);
  return {
    description: config.description,
    details: config.details,
    objective: config.objective,
    completion: config.completionCriteria.join('; '),
  };
}
