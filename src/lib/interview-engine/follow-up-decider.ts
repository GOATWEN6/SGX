/**
 * 追问决策器 - 决定是否追问以及如何追问
 */

import { FollowUpDecision } from './types';

// 追问模式
type FollowUpType = 'detail' | 'emotion' | 'time' | 'person' | 'place' | 'object';

// 追问关键词
const FOLLOW_UP_PATTERNS: Record<FollowUpType, string[]> = {
  detail: ['那', '怎么', '什么样', '什么样', '哪个', '多少'],
  emotion: ['感觉', '心情', '当时', '想到', '记得'],
  time: ['什么时候', '那年', '那天', '多大', '几岁', '哪一年'],
  person: ['谁', '和谁', '旁边', '一起', '家里有谁'],
  place: ['哪里', '在哪儿', '去的', '住在哪'],
  object: ['什么', '那个', '东西', '用来', '长什么样'],
};

// 最大追问深度
const MAX_FOLLOW_UP_DEPTH = 2;

/**
 * 决定是否追问
 */
export function decideFollowUp(
  userMessage: string,
  currentDepth: number = 0,
  userSignals: {
    isEngaged: boolean;
    isUncomfortable: boolean;
    isTired: boolean;
    wantsToStop: boolean;
  }
): FollowUpDecision {
  // 如果用户表现出不舒服或疲倦，停止追问
  if (userSignals.isUncomfortable || userSignals.isTired || userSignals.wantsToStop) {
    return {
      shouldFollowUp: false,
      shouldStop: true,
      depth: currentDepth,
      stopReason: userSignals.isUncomfortable
        ? '用户表现出不舒服'
        : userSignals.isTired
        ? '用户看起来累了'
        : '用户想要停止',
    };
  }

  // 如果用户回答很短，可能只是敷衍，不追问
  if (userMessage.length < 10) {
    return {
      shouldFollowUp: false,
      shouldStop: false,
      depth: currentDepth,
    };
  }

  // 如果已经达到最大追问深度，停止追问
  if (currentDepth >= MAX_FOLLOW_UP_DEPTH) {
    return {
      shouldFollowUp: false,
      shouldStop: true,
      depth: currentDepth,
      stopReason: '已达到最大追问深度',
    };
  }

  // 如果用户非常积极分享，可以追问
  if (userSignals.isEngaged && userMessage.length > 30) {
    const followUpType = detectFollowUpType(userMessage);
    const followUpQuestion = generateFollowUpQuestion(userMessage, followUpType);

    return {
      shouldFollowUp: true,
      followUpType,
      followUpQuestion,
      depth: currentDepth + 1,
      shouldStop: false,
    };
  }

  // 默认不追问
  return {
    shouldFollowUp: false,
    shouldStop: false,
    depth: currentDepth,
  };
}

/**
 * 检测适合的追问类型
 */
function detectFollowUpType(userMessage: string): FollowUpType {
  const message = userMessage.toLowerCase();

  // 检查时间相关
  if (FOLLOW_UP_PATTERNS.time.some(pattern => message.includes(pattern))) {
    return 'time';
  }

  // 检查人物相关
  if (FOLLOW_UP_PATTERNS.person.some(pattern => message.includes(pattern))) {
    return 'person';
  }

  // 检查地点相关
  if (FOLLOW_UP_PATTERNS.place.some(pattern => message.includes(pattern))) {
    return 'place';
  }

  // 检查物品相关
  if (FOLLOW_UP_PATTERNS.object.some(pattern => message.includes(pattern))) {
    return 'object';
  }

  // 检查情感相关
  if (FOLLOW_UP_PATTERNS.emotion.some(pattern => message.includes(pattern))) {
    return 'emotion';
  }

  // 默认追问细节
  return 'detail';
}

/**
 * 生成追问问题
 */
function generateFollowUpQuestion(userMessage: string, type: FollowUpType): string {
  // 常见的追问模板
  const templates: Record<FollowUpType, string[]> = {
    detail: [
      '能跟我多讲讲吗？',
      '那后来怎么样了呢？',
      '具体是怎样的？',
      '能举个例子吗？',
    ],
    emotion: [
      '当时您是什么心情？',
      '那件事让您有什么感受？',
      '想起来的时候，您有什么感觉？',
    ],
    time: [
      '那是哪一年的事？',
      '当时您多大年纪？',
      '那件事持续了多久？',
    ],
    person: [
      '那个人是谁？',
      '当时旁边还有谁？',
      '您和他是什么关系？',
    ],
    place: [
      '那是哪个地方？',
      '那个地方现在还在吗？',
      '是在哪里发生的呢？',
    ],
    object: [
      '那东西现在还在吗？',
      '具体是什么样子的？',
    ],
  };

  const pattern = userMessage.toLowerCase();

  // 更智能的追问生成
  if (pattern.includes('第一次')) {
    return '那第一次让您有什么特别的感觉？';
  }

  if (pattern.includes('记得')) {
    return '那记得当时是什么场景吗？';
  }

  if (pattern.includes('很') || pattern.includes('特别')) {
    return '有什么特别的原因吗？';
  }

  // 随机选择一个模板
  const typeTemplates = templates[type];
  if (Array.isArray(typeTemplates)) {
    return typeTemplates[Math.floor(Math.random() * typeTemplates.length)];
  }

  // 回退到 detail 模板
  return templates.detail[0];
}

/**
 * 分析用户信号
 */
export function analyzeUserSignals(
  userMessage: string,
  previousMessages: string[]
): {
  isEngaged: boolean;
  isUncomfortable: boolean;
  isTired: boolean;
  wantsToStop: boolean;
} {
  const message = userMessage.toLowerCase();
  const previousCombined = previousMessages.join(' ').toLowerCase();

  // 积极信号
  const engagedPatterns = ['很好', '记得', '那時候', '当时', '后来', '然后', '我记得'];
  const isEngaged = engagedPatterns.some(p => message.includes(p)) || message.length > 50;

  // 不舒服信号
  const uncomfortablePatterns = ['不想说', '不太好', '不记得了', '忘了', '算了'];
  const isUncomfortable = uncomfortablePatterns.some(p => message.includes(p));

  // 疲倦信号
  const tiredPatterns = ['累了', '困了', '想休息', '下次吧', '今天够了'];
  const isTired = tiredPatterns.some(p => message.includes(p)) || message.includes('不说了');

  // 想停止信号
  const stopPatterns = ['结束', '停止', '不聊了', '就这样'];
  const wantsToStop = stopPatterns.some(p => message.includes(p));

  return { isEngaged, isUncomfortable, isTired, wantsToStop };
}
