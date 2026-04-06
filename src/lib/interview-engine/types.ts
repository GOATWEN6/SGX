/**
 * 访谈引擎 - 类型定义
 */
import { InterviewPhase, MemoryCard, Topic } from '@/types';

// 阶段配置
export interface PhaseConfig {
  phase: InterviewPhase;
  description: string;
  details: string;
  objective: string;
  completionCriteria: string[];
  tabooTopics: string[];
  recommendedTopics: string[];
}

// 访谈上下文
export interface InterviewContext {
  userId: string;
  sessionId: string;
  currentPhase: InterviewPhase;
  phaseConfig: PhaseConfig;
  knownFacts: KnownFact[];
  recentMessages: string[];
  candidateTopics: RankedTopic[];
  blockedTopics: string[];
  sessionMessageCount: number;
  lastTopicAsked?: string;
  sensitivityLevel: number;
}

// 已知事实
export interface KnownFact {
  key: string;
  value: string;
  sourceCardId?: string;
  confidence: number;
  isUncertain: boolean;
}

// 排序后的话题
export interface RankedTopic {
  topic: Topic;
  score: number;
  reasons: string[];
  isBlocked: boolean;
}

// 追问决策
export interface FollowUpDecision {
  shouldFollowUp: boolean;
  followUpType?: 'detail' | 'emotion' | 'time' | 'person' | 'place' | 'object';
  followUpQuestion?: string;
  depth: number; // 追问深度，同一事件最多2层
  shouldStop: boolean;
  stopReason?: string;
}

// 阶段推进决策
export interface PhaseAdvanceDecision {
  shouldAdvance: boolean;
  nextPhase?: InterviewPhase;
  reason?: string;
  progress: number; // 0-100
}

// 会话进度
export interface SessionProgress {
  phase: InterviewPhase;
  progress: number;
  messageCount: number;
  cardsExtracted: number;
  keyTopicsCovered: string[];
  remainingTopics: string[];
}
