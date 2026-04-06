/**
 * 话题排序器 - 决定下一个应该问什么问题
 */
import { Topic, UserProfile } from '@/types';
import { RankedTopic, InterviewContext, KnownFact } from './types';
import { getPhaseConfig } from './phase-manager';

/**
 * 对话题进行排序
 */
export function rankTopics(
  topics: Topic[],
  context: InterviewContext,
  userProfile: UserProfile
): RankedTopic[] {
  const phaseConfig = getPhaseConfig(context.currentPhase);

  // 计算每个话题的得分
  const rankedTopics = topics.map(topic => {
    let score = 0;
    const reasons: string[] = [];

    // 1. 阶段匹配度 (最高 30 分)
    if (topic.phases.includes(context.currentPhase)) {
      score += 30;
      reasons.push('当前阶段适合');
    }

    // 2. 用户偏好匹配 (最高 20 分)
    const userAccepts = checkUserAcceptance(userProfile, topic);
    if (userAccepts) {
      score += 20;
      reasons.push('用户接受此类话题');
    } else {
      score -= 50;
      reasons.push('用户不接受此类话题');
    }

    // 3. 敏感度匹配 (最高 15 分)
    if (topic.sensitivity <= context.sensitivityLevel) {
      score += 15;
      reasons.push('敏感度合适');
    } else {
      score -= 30;
      reasons.push('敏感度过高');
    }

    // 4. 最近是否问过 (最高 -20 分)
    if (context.lastTopicAsked === topic.id) {
      score -= 20;
      reasons.push('刚刚问过');
    } else if (isRecentlyAsked(context.recentMessages, topic)) {
      score -= 10;
      reasons.push('最近问过');
    }

    // 5. 阶段推荐话题 (最高 15 分)
    if (phaseConfig.recommendedTopics.some(rt => topic.tags.includes(rt))) {
      score += 15;
      reasons.push('阶段推荐');
    }

    // 6. 已有事实关联 (最高 10 分)
    const relatedFacts = findRelatedFacts(topic, context.knownFacts);
    if (relatedFacts.length > 0) {
      score += 10;
      reasons.push('与已知信息关联');
    }

    // 7. 卡片提取潜力 (最高 10 分)
    if (hasCardExtractionPotential(topic)) {
      score += 10;
      reasons.push('可以提取记忆卡片');
    }

    // 8. 阻止话题检查
    const isBlocked = checkIfBlocked(topic, context.blockedTopics, phaseConfig.tabooTopics);

    return {
      topic,
      score,
      reasons,
      isBlocked,
    };
  });

  // 排序并过滤阻止的话题
  return rankedTopics
    .filter(rt => !rt.isBlocked)
    .sort((a, b) => b.score - a.score);
}

/**
 * 检查用户是否接受该话题
 */
function checkUserAcceptance(userProfile: UserProfile, topic: Topic): boolean {
  // 检查是否涉及战争话题
  if (topic.tags.includes('war') && !userProfile.acceptWarTopics) {
    return false;
  }

  // 检查是否涉及疾病话题
  if (topic.tags.includes('illness') && !userProfile.acceptIllnessTopics) {
    return false;
  }

  // 检查是否涉及家庭话题
  if (topic.tags.includes('family') && !userProfile.acceptFamilyTopics) {
    return false;
  }

  // 检查是否涉及职业话题
  if (topic.tags.includes('career') && !userProfile.acceptCareerTopics) {
    return false;
  }

  // 检查是否涉及离别话题
  if (topic.tags.includes('loss') && !userProfile.acceptLossTopics) {
    return false;
  }

  return true;
}

/**
 * 检查话题是否最近问过
 */
function isRecentlyAsked(recentMessages: string[], topic: Topic): boolean {
  const keywords = topic.questions[0]?.split('').slice(0, 5) || [];
  return recentMessages.some(msg =>
    keywords.some(kw => msg.includes(kw))
  );
}

/**
 * 查找与话题相关的已知事实
 */
function findRelatedFacts(topic: Topic, knownFacts: KnownFact[]): KnownFact[] {
  return knownFacts.filter(fact =>
    topic.tags.some(tag => fact.key.includes(tag))
  );
}

/**
 * 检查话题是否有卡片提取潜力
 */
function hasCardExtractionPotential(topic: Topic): boolean {
  // 涉及人物、事件、地点的话题更容易提取卡片
  const cardPotentialTags = ['person', 'event', 'place', 'time', 'object'];
  return topic.tags.some(tag => cardPotentialTags.includes(tag));
}

/**
 * 检查话题是否被阻止
 */
function checkIfBlocked(
  topic: Topic,
  blockedTopics: string[],
  tabooTopics: string[]
): boolean {
  // 检查是否在阻止列表中
  if (blockedTopics.includes(topic.id)) {
    return true;
  }

  // 检查是否在禁忌列表中
  if (tabooTopics.some(taboo => topic.tags.includes(taboo))) {
    return true;
  }

  // 敏感度为 5 的话题默认阻止
  if (topic.sensitivity >= 5) {
    return true;
  }

  return false;
}

/**
 * 获取候选话题列表
 */
export function getCandidateTopics(
  rankedTopics: RankedTopic[],
  limit: number = 5
): RankedTopic[] {
  return rankedTopics
    .filter(rt => !rt.isBlocked && rt.score > 0)
    .slice(0, limit);
}

/**
 * 获取应该阻止的话题列表
 */
export function getBlockedTopics(
  rankedTopics: RankedTopic[]
): string[] {
  return rankedTopics
    .filter(rt => rt.isBlocked)
    .map(rt => rt.topic.id);
}
