/**
 * 记忆提取器 - 从对话中提取结构化记忆
 */

import {
  MemoryCard,
  PersonCard,
  EventCard,
  QuoteSnippet,
  UncertainFact,
} from '@/types';
import { saveMemoryCard } from '../db';

// 提取上下文
export interface ExtractionContext {
  sessionId: string;
  messageId: string;
  userId: string;
  currentPhase: string;
}

// 提取结果
export interface ExtractedCards {
  persons: Partial<PersonCard>[];
  events: Partial<EventCard>[];
  quotes: Partial<QuoteSnippet>[];
  uncertainFacts: Partial<UncertainFact>[];
}

/**
 * 从用户消息中提取记忆卡片
 */
export function extractFromMessage(
  message: string,
  context: ExtractionContext
): ExtractedCards {
  const result: ExtractedCards = {
    persons: extractPersons(message),
    events: extractEvents(message),
    quotes: extractQuotes(message, context),
    uncertainFacts: extractUncertainFacts(message),
  };

  return result;
}

/**
 * 提取人物
 */
function extractPersons(message: string): Partial<PersonCard>[] {
  const persons: Partial<PersonCard>[] = [];

  // 人物相关的关键词模式
  const personPatterns = [
    /(父母|父亲|母亲|爸爸|妈妈|爷爷|奶奶|外公|外婆)/g,
    /(哥哥|姐姐|弟弟|妹妹)/g,
    /(丈夫|妻子|老公|老婆|老伴)/g,
    /(儿子|女儿|孩子|小孩)/g,
    /(老师|同学|同事|朋友|邻居)/g,
  ];

  // 检测人物提及
  const mentionedPersons: Record<string, string> = {
    '父亲': '父亲',
    '母亲': '母亲',
    '爸爸': '父亲',
    '妈妈': '母亲',
    '爷爷': '祖父',
    '奶奶': '祖母',
    '外公': '外祖父',
    '外婆': '外祖母',
    '哥哥': '兄长',
    '姐姐': '姐姐',
    '弟弟': '弟弟',
    '妹妹': '妹妹',
    '丈夫': '配偶',
    '妻子': '配偶',
    '老公': '配偶',
    '老婆': '配偶',
    '老伴': '配偶',
    '儿子': '子女',
    '女儿': '子女',
    '老师': '老师',
    '同学': '同学',
    '同事': '同事',
    '朋友': '朋友',
  };

  for (const [mention, relationship] of Object.entries(mentionedPersons)) {
    if (message.includes(mention)) {
      // 检查是否已经提取过
      if (!persons.some(p => p.fullName === mention)) {
        persons.push({
          type: 'person',
          title: mention,
          fullName: mention,
          relationship,
          content: `在对话中提及的${relationship}`,
          isOriginal: false,
          isSummary: true,
          isUncertain: false,
          confidence: 0.8,
        });
      }
    }
  }

  return persons;
}

/**
 * 提取事件
 */
function extractEvents(message: string): Partial<EventCard>[] {
  const events: Partial<EventCard>[] = [];

  // 时间相关词汇
  const timeIndicators = ['那一年', '那年', '有一天', '那时候', '后来', '以前', '小时候', '年轻时', '结婚', '搬家', '工作', '上学'];

  // 检测是否有事件描述
  const hasTimeIndicator = timeIndicators.some(indicator => message.includes(indicator));

  if (hasTimeIndicator) {
    events.push({
      type: 'event',
      title: '回忆事件',
      description: message.substring(0, 100),
      yearApproximate: true,
      participants: [],
      importance: 3,
    });
  }

  return events;
}

/**
 * 提取引用（用户原话）
 */
function extractQuotes(message: string, context: ExtractionContext): Partial<QuoteSnippet>[] {
  const quotes: Partial<QuoteSnippet>[] = [];

  // 查找引号内的内容
  const quoteMatches = message.match(/"([^"]+)"/g);

  if (quoteMatches) {
    for (const match of quoteMatches) {
      const quoteText = match.replace(/"/g, '');
      if (quoteText.length > 5) {
        quotes.push({
          type: 'quote_snippet',
          title: '原话引用',
          content: quoteText,
          quote: quoteText,
          isOriginal: true,
          isSummary: false,
          isUncertain: false,
          confidence: 1.0,
        });
      }
    }
  }

  // 如果没有引号，但消息较长，也可以作为重要引用
  if (quotes.length === 0 && message.length > 50) {
    quotes.push({
      type: 'quote_snippet',
      title: '重要陈述',
      content: message.substring(0, 100),
      quote: message.substring(0, 100),
      isOriginal: true,
      isSummary: true,
      isUncertain: false,
      confidence: 0.9,
    });
  }

  return quotes;
}

/**
 * 提取不确定事实
 */
function extractUncertainFacts(message: string): Partial<UncertainFact>[] {
  const uncertainFacts: Partial<UncertainFact>[] = [];

  // 不确定性词汇
  const uncertaintyIndicators = [
    '可能',
    '大概',
    '应该是',
    '好像是',
    '记不清了',
    '不太确定',
    '也许',
    '应该是吧',
  ];

  const hasUncertainty = uncertaintyIndicators.some(indicator => message.includes(indicator));

  if (hasUncertainty) {
    uncertainFacts.push({
      type: 'uncertain_fact',
      title: '待确认信息',
      content: message.substring(0, 100),
      fact: message.substring(0, 100),
      uncertaintyReason: '用户在表述时使用了不确定的词汇',
      verificationStatus: 'unverified',
      isOriginal: false,
      isSummary: true,
      isUncertain: true,
      confidence: 0.5,
    });
  }

  return uncertainFacts;
}

/**
 * 判断消息是否值得提取
 */
export function shouldExtract(message: string): boolean {
  // 消息太短，不提取
  if (message.length < 10) return false;

  // 包含关键词才提取
  const keywords = [
    '记得', '那時候', '以前', '小时候', '年轻',
    '家人', '父母', '孩子', '结婚', '工作',
    '上学', '搬家', '朋友', '老师', '同学',
  ];

  return keywords.some(kw => message.includes(kw));
}

/**
 * 创建完整的记忆卡片
 */
export function createMemoryCardFromExtraction(
  extraction: ExtractedCards,
  context: ExtractionContext
): Omit<MemoryCard, 'id' | 'createdAt' | 'updatedAt'>[] {
  const cards: Omit<MemoryCard, 'id' | 'createdAt' | 'updatedAt'>[] = [];

  // 添加人物卡片
  for (const person of extraction.persons) {
    cards.push({
      userId: context.userId,
      type: 'person',
      title: person.title || '',
      content: person.content || '',
      sourceMessageId: context.messageId,
      isOriginal: person.isOriginal || false,
      isSummary: person.isSummary || true,
      isUncertain: person.isUncertain || false,
      confidence: person.confidence || 0.8,
      tags: [],
      themes: [],
      relatedPersons: [],
      relatedPlaces: [],
      relatedEvents: [],
    });
  }

  // 添加事件卡片
  for (const event of extraction.events) {
    cards.push({
      userId: context.userId,
      type: 'event',
      title: event.title || '',
      content: event.description || '',
      sourceMessageId: context.messageId,
      isOriginal: event.isOriginal || false,
      isSummary: event.isSummary || true,
      isUncertain: event.isUncertain || false,
      confidence: event.confidence || 0.7,
      tags: [],
      themes: [],
      relatedPersons: [],
      relatedPlaces: [],
      relatedEvents: [],
    });
  }

  // 添加引用卡片
  for (const quote of extraction.quotes) {
    cards.push({
      userId: context.userId,
      type: 'quote_snippet',
      title: quote.title || '',
      content: quote.content || '',
      sourceMessageId: context.messageId,
      isOriginal: quote.isOriginal || true,
      isSummary: quote.isSummary || false,
      isUncertain: quote.isUncertain || false,
      confidence: quote.confidence || 1.0,
      tags: [],
      themes: [],
      relatedPersons: [],
      relatedPlaces: [],
      relatedEvents: [],
    });
  }

  // 添加不确定事实卡片
  for (const fact of extraction.uncertainFacts) {
    cards.push({
      userId: context.userId,
      type: 'uncertain_fact',
      title: fact.title || '',
      content: fact.content || '',
      sourceMessageId: context.messageId,
      isOriginal: fact.isOriginal || false,
      isSummary: fact.isSummary || true,
      isUncertain: fact.isUncertain || true,
      confidence: fact.confidence || 0.5,
      tags: [],
      themes: [],
      relatedPersons: [],
      relatedPlaces: [],
      relatedEvents: [],
    });
  }

  return cards;
}
