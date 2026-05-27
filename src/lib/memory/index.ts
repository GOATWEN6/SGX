import {
  createInterviewMaterial,
  createMemoryCandidate,
  createMemoryCard,
  getMemoryCandidateById,
  updateMemoryCandidate,
} from '@/lib/db';
import { MemoryCandidate, MemoryCandidateType } from '@/types';

const tabooPatterns = ['别再提', '不要再提', '不想聊', '别问', '不要问', '不愿意说'];
const familyPatterns = ['儿子', '女儿', '老伴', '丈夫', '妻子', '孙子', '孙女', '爸爸', '妈妈'];
const preferencePatterns = ['我喜欢', '我爱', '我愿意', '我习惯', '我平时'];
const lifeEventPatterns = ['以前', '年轻时', '小时候', '那一年', '当年', '退休', '结婚', '工作'];

function hasAny(text: string, patterns: string[]): boolean {
  return patterns.some(pattern => text.includes(pattern));
}

function inferCandidateType(text: string): MemoryCandidateType | null {
  if (hasAny(text, tabooPatterns)) return 'taboo_topic';
  if (hasAny(text, familyPatterns)) return 'family_member';
  if (hasAny(text, preferencePatterns)) return 'preference';
  if (hasAny(text, lifeEventPatterns)) return 'life_event';
  if (text.includes('我叫') || text.includes('我是') || text.includes('我今年')) return 'profile';
  if (text.length >= 18) return 'quote';
  return null;
}

function buildCandidateContent(type: MemoryCandidateType, text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (type === 'taboo_topic') return `老人表达了不希望继续主动提起的内容：${clean}`;
  if (type === 'family_member') return `老人提到了家庭成员或家庭关系：${clean}`;
  if (type === 'preference') return `老人表达了偏好或习惯：${clean}`;
  if (type === 'life_event') return `可作为后续往事访谈素材的经历线索：${clean}`;
  if (type === 'profile') return `老人补充了个人基础信息：${clean}`;
  return `老人原话片段：${clean}`;
}

export function extractMemoryCandidatesFromText(params: {
  userId: string;
  sourceSessionId: string;
  sourceMessageId?: string;
  text: string;
}): MemoryCandidate[] {
  const text = params.text.trim();
  if (!text) return [];

  const type = inferCandidateType(text);
  if (!type) return [];

  const candidate = createMemoryCandidate({
    userId: params.userId,
    sourceSessionId: params.sourceSessionId,
    sourceMessageId: params.sourceMessageId,
    type,
    content: buildCandidateContent(type, text),
    evidenceText: text.slice(0, 280),
    confidence: type === 'quote' ? 0.62 : 0.78,
  });

  if (type === 'life_event' || type === 'quote') {
    createInterviewMaterial({
      userId: params.userId,
      sourceSessionId: params.sourceSessionId,
      title: text.slice(0, 18) || '新的访谈素材',
      excerpt: text.slice(0, 360),
      suggestedTopic: type === 'life_event' ? '往事线索' : '原话片段',
    });
  }

  return [candidate];
}

export function confirmMemoryCandidate(candidateId: string, userId: string): MemoryCandidate | null {
  const candidate = getMemoryCandidateById(candidateId);
  if (!candidate || candidate.userId !== userId) return null;
  if (candidate.status === 'confirmed') return candidate;
  if (candidate.status === 'rejected') return null;

  const cardType = candidate.type === 'family_member'
    ? 'person'
    : candidate.type === 'taboo_topic'
      ? 'uncertain_fact'
      : candidate.type === 'quote'
        ? 'quote_snippet'
        : candidate.type === 'profile'
          ? 'theme_tag'
          : 'event';

  const card = createMemoryCard(userId, {
    type: cardType,
    title: candidate.content.slice(0, 24),
    content: candidate.content,
    sourceMessageId: candidate.sourceMessageId || candidate.sourceSessionId,
    isOriginal: candidate.type === 'quote',
    isSummary: candidate.type !== 'quote',
    isUncertain: false,
    confidence: candidate.confidence,
    tags: [candidate.type],
    themes: [],
    relatedPersons: [],
    relatedPlaces: [],
    relatedEvents: [],
  });

  return updateMemoryCandidate(candidateId, {
    status: 'confirmed',
    confirmedMemoryCardId: card.id,
  });
}

export function rejectMemoryCandidate(candidateId: string, userId: string): MemoryCandidate | null {
  const candidate = getMemoryCandidateById(candidateId);
  if (!candidate || candidate.userId !== userId) return null;
  return updateMemoryCandidate(candidateId, { status: 'rejected' });
}

export function editMemoryCandidate(candidateId: string, userId: string, content: string): MemoryCandidate | null {
  const candidate = getMemoryCandidateById(candidateId);
  if (!candidate || candidate.userId !== userId) return null;
  return updateMemoryCandidate(candidateId, {
    content: content.trim(),
    status: 'edited',
  });
}
