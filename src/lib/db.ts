/**
 * AI 回忆录助手 - 数据库操作模块
 * 使用 JSON 文件存储用户数据（无需原生编译）
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { logger } from './logger';
import {
  UserProfile,
  Session,
  MemoryCard,
  InterviewMessage,
  PersonCard,
  EventCard,
  PlaceCard,
  TimelineEntry,
  QuoteSnippet,
  UncertainFact,
  MemoirDraft,
  ReviewRound,
  ImportedFile,
  Episode,
  ArticleDraft,
  Chapter,
  BookProject,
  FamilyMember,
  FamilyContribution,
  ConsentRecord,
  EditActionLog,
  VoicePersona,
  AvatarProfile,
  InterviewPhase,
  ExportFormat,
  ConversationSession,
  MemoryCandidate,
  InterviewMaterial,
  ChildVisibleSummary,
  VoiceSessionRecord,
} from '@/types';

// 数据文件路径
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');
const MEMORY_CARDS_FILE = path.join(DATA_DIR, 'memory-cards.json');
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');
const FILES_FILE = path.join(DATA_DIR, 'files.json');
// 新增数据文件路径（本轮重构）
const EPISODES_FILE = path.join(DATA_DIR, 'episodes.json');
const ARTICLES_FILE = path.join(DATA_DIR, 'articles.json');
const CHAPTERS_FILE = path.join(DATA_DIR, 'chapters.json');
const BOOKS_FILE = path.join(DATA_DIR, 'books.json');
const FAMILY_FILE = path.join(DATA_DIR, 'family.json');
const CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'contributions.json');
const CONSENTS_FILE = path.join(DATA_DIR, 'consents.json');
const ACTION_LOGS_FILE = path.join(DATA_DIR, 'action-logs.json');
const VOICE_PERSONAS_FILE = path.join(DATA_DIR, 'voice-personas.json');
const AVATARS_FILE = path.join(DATA_DIR, 'avatars.json');
const CONVERSATION_SESSIONS_FILE = path.join(DATA_DIR, 'conversation-sessions.json');
const MEMORY_CANDIDATES_FILE = path.join(DATA_DIR, 'memory-candidates.json');
const INTERVIEW_MATERIALS_FILE = path.join(DATA_DIR, 'interview-materials.json');
const CHILD_SUMMARIES_FILE = path.join(DATA_DIR, 'child-summaries.json');
const VOICE_SESSIONS_FILE = path.join(DATA_DIR, 'voice-sessions.json');

// 标记是否已初始化
let isInitialized = false;

// 确保数据目录存在
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// 初始化所有数据文件（如果不存在）
function ensureDataFiles(): void {
  if (isInitialized) return;

  ensureDataDir();

  // 直接初始化文件，不调用 readJsonFile 以避免递归
  const initFile = (filePath: string) => {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]', 'utf-8');
    }
  };

  // 初始化基础数据文件
  initFile(USERS_FILE);
  initFile(SESSIONS_FILE);
  initFile(MESSAGES_FILE);
  initFile(MEMORY_CARDS_FILE);
  initFile(DRAFTS_FILE);
  initFile(FILES_FILE);

  // 初始化新增数据文件
  initFile(EPISODES_FILE);
  initFile(ARTICLES_FILE);
  initFile(CHAPTERS_FILE);
  initFile(BOOKS_FILE);
  initFile(FAMILY_FILE);
  initFile(CONTRIBUTIONS_FILE);
  initFile(CONSENTS_FILE);
  initFile(ACTION_LOGS_FILE);
  initFile(VOICE_PERSONAS_FILE);
  initFile(AVATARS_FILE);
  initFile(CONVERSATION_SESSIONS_FILE);
  initFile(MEMORY_CANDIDATES_FILE);
  initFile(INTERVIEW_MATERIALS_FILE);
  initFile(CHILD_SUMMARIES_FILE);
  initFile(VOICE_SESSIONS_FILE);

  isInitialized = true;
  logger.info('数据文件初始化完成！');
}

// 读取 JSON 文件
function readJsonFile<T>(filePath: string, defaultValue: T): T {
  // 确保数据文件已初始化
  ensureDataFiles();

  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('读取文件失败: {filePath}, {error}', { filePath, error: String(error) });
  }
  return defaultValue;
}

// 写入 JSON 文件（原子操作：先写临时文件，再 rename）
function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    ensureDataDir();
    const jsonData = JSON.stringify(data, null, 2);
    const tempFilePath = `${filePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFilePath, jsonData, 'utf-8');
    // rename 是原子操作（在 POSIX 系统上），可以避免数据损坏
    fs.renameSync(tempFilePath, filePath);
  } catch (error) {
    logger.error('写入文件失败: {filePath}, {error}', { filePath, error: String(error) });
    throw error;
  }
}

/**
 * 分页参数接口
 */
interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * 分页结果接口
 */
interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 获取分页结果
 */
function getPaginatedResult<T>(
  allItems: T[],
  pagination?: PaginationParams
): PaginatedResult<T> {
  const page = pagination?.page || 1;
  const pageSize = pagination?.pageSize || 20;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = allItems.slice(start, end);
  
  return {
    items,
    total: allItems.length,
    page,
    pageSize,
    totalPages: Math.ceil(allItems.length / pageSize),
  };
}

// ==================== 用户操作 ====================

/**
 * 创建用户
 */
export function createUser(profile: Partial<UserProfile>): UserProfile {
  const users = readJsonFile<UserProfile[]>(USERS_FILE, []);
  
  // 辅助函数：将空字符串转为 undefined
  const cleanString = (val: string | undefined | null) => 
    val && val.trim() ? val.trim() : undefined;

  const newUser: UserProfile = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: cleanString(profile.name) || '用户',
    ageGroup: cleanString(profile.ageGroup),
    gender: cleanString(profile.gender) as UserProfile['gender'],
    birthPlace: cleanString(profile.birthPlace),
    grewUpPlace: cleanString(profile.grewUpPlace),
    education: cleanString(profile.education),
    useHonorific: profile.useHonorific !== false,
    preferredStyle: cleanString(profile.preferredStyle) || 'narrative',
    conversationDuration: profile.conversationDuration || 10,
    acceptFamilyTopics: profile.acceptFamilyTopics !== false,
    acceptCareerTopics: profile.acceptCareerTopics !== false,
    acceptWarTopics: profile.acceptWarTopics !== false,
    acceptIllnessTopics: profile.acceptIllnessTopics !== false,
    acceptLossTopics: profile.acceptLossTopics !== false,
    memoirGoal: (cleanString(profile.memoirGoal) || 'self') as UserProfile['memoirGoal'],
    currentPhase: (cleanString(profile.currentPhase) || 'ice_breaker') as UserProfile['currentPhase'],
    totalSessions: 0,
    totalMessages: 0,
  };
  
  users.push(newUser);
  writeJsonFile(USERS_FILE, users);
  
  return newUser;
}

/**
 * 获取用户
 */
export function getUserById(id: string): UserProfile | null {
  const users = readJsonFile<UserProfile[]>(USERS_FILE, []);
  return users.find(u => u.id === id) || null;
}

/**
 * 获取所有用户
 */
export function getAllUsers(): UserProfile[] {
  return readJsonFile<UserProfile[]>(USERS_FILE, []);
}

/**
 * 更新用户
 */
export function updateUser(id: string, updates: Partial<UserProfile>): UserProfile | null {
  const users = readJsonFile<UserProfile[]>(USERS_FILE, []);
  const index = users.findIndex(u => u.id === id);
  
  if (index === -1) return null;
  
  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  writeJsonFile(USERS_FILE, users);
  return users[index];
}

/**
 * 删除用户
 */
export function deleteUser(id: string): boolean {
  const users = readJsonFile<UserProfile[]>(USERS_FILE, []);
  const filtered = users.filter(u => u.id !== id);
  
  if (filtered.length === users.length) return false;
  
  writeJsonFile(USERS_FILE, filtered);
  
  // 同时删除相关数据
  const sessions = readJsonFile<Session[]>(SESSIONS_FILE, []);
  writeJsonFile(SESSIONS_FILE, sessions.filter(s => s.userId !== id));
  
  return true;
}

// ==================== 会话操作 ====================

/**
 * 创建会话
 */
export function createSession(userId: string, phase: InterviewPhase): Session {
  const sessions = readJsonFile<Session[]>(SESSIONS_FILE, []);
  
  const newSession: Session = {
    id: uuidv4(),
    userId,
    createdAt: new Date().toISOString(),
    endedAt: undefined,
    duration: 0,
    phase,
    messageCount: 0,
    summary: undefined,
  };
  
  sessions.push(newSession);
  writeJsonFile(SESSIONS_FILE, sessions);
  
  // 更新用户的会话计数
  const user = getUserById(userId);
  if (user) {
    updateUser(userId, { totalSessions: user.totalSessions + 1 });
  }
  
  return newSession;
}

/**
 * 获取用户的会话
 */
export function getUserSessions(userId: string, pagination?: PaginationParams): PaginatedResult<Session> {
  const sessions = readJsonFile<Session[]>(SESSIONS_FILE, []);
  const userSessions = sessions
    .filter(s => s.userId === userId)
    .sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  return getPaginatedResult(userSessions, pagination);
}

/**
 * 获取会话
 */
export function getSessionById(id: string): Session | null {
  const sessions = readJsonFile<Session[]>(SESSIONS_FILE, []);
  return sessions.find(s => s.id === id) || null;
}

/**
 * 更新会话
 */
export function updateSession(id: string, updates: Partial<Session>): Session | null {
  const sessions = readJsonFile<Session[]>(SESSIONS_FILE, []);
  const index = sessions.findIndex(s => s.id === id);
  
  if (index === -1) return null;
  
  sessions[index] = { ...sessions[index], ...updates };
  writeJsonFile(SESSIONS_FILE, sessions);
  return sessions[index];
}

/**
 * 结束会话
 */
export function endSession(id: string, summary?: string): Session | null {
  const sessions = readJsonFile<Session[]>(SESSIONS_FILE, []);
  const index = sessions.findIndex(s => s.id === id);
  
  if (index === -1) return null;
  
  const session = sessions[index];
  const startTime = new Date(session.createdAt).getTime();
  const endTime = Date.now();
  const duration = Math.floor((endTime - startTime) / 1000); // 秒
  
  sessions[index] = {
    ...session,
    endedAt: new Date().toISOString(),
    duration,
    summary,
  };
  
  writeJsonFile(SESSIONS_FILE, sessions);
  return sessions[index];
}

// ==================== 消息操作 ====================

/**
 * 保存消息 - 支持两种调用方式
 * 方式1: saveMessage(sessionId, messageObject)
 * 方式2: saveMessage(messageObject) - 兼容旧用法，自动提取 sessionId
 */
export function saveMessage(
  sessionIdOrMessage: string | Omit<InterviewMessage, 'id'>,
  message?: Omit<InterviewMessage, 'id'>
): InterviewMessage {
  let finalSessionId: string;
  let finalMessage: Omit<InterviewMessage, 'id'>;

  // 判断调用方式
  if (typeof sessionIdOrMessage === 'string' && message) {
    finalSessionId = sessionIdOrMessage;
    finalMessage = message;
  } else if (typeof sessionIdOrMessage === 'object') {
    // 兼容旧用法：从对象中提取 sessionId
    const msg = sessionIdOrMessage as Omit<InterviewMessage, 'id'>;
    finalSessionId = msg.sessionId || '';
    finalMessage = msg;
  } else {
    throw new Error('Invalid arguments for saveMessage');
  }

  const messages = readJsonFile<InterviewMessage[]>(MESSAGES_FILE, []);

  const newMessage: InterviewMessage = {
    id: uuidv4(),
    ...finalMessage,
  };

  messages.push(newMessage);
  writeJsonFile(MESSAGES_FILE, messages);

  // 更新会话消息计数
  const session = getSessionById(finalSessionId);
  if (session) {
    updateSession(finalSessionId, { messageCount: session.messageCount + 1 });

    // 更新用户消息计数
    const user = getUserById(session.userId);
    if (user) {
      updateUser(session.userId, { totalMessages: user.totalMessages + 1 });
    }
  }

  return newMessage;
}

/**
 * 获取会话的消息
 */
export function getSessionMessages(sessionId: string): InterviewMessage[] {
  const messages = readJsonFile<InterviewMessage[]>(MESSAGES_FILE, []);
  return messages
    .filter(m => m.sessionId === sessionId)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * 获取会话历史（用于 LLM 上下文）
 */
export function getSessionHistory(sessionId: string, limit: number = 10): string {
  const messages = getSessionMessages(sessionId);
  const recent = messages.slice(-limit);
  
  return recent
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
    .join('\n');
}

// ==================== 记忆卡片操作 ====================

/**
 * 保存记忆卡片 - 支持两种调用方式
 * 方式1: saveMemoryCard(userId, cardObject)
 * 方式2: saveMemoryCard(cardObject) - 兼容旧用法
 */
export function saveMemoryCard(
  userIdOrCard: string | Omit<MemoryCard, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
  card?: Omit<MemoryCard, 'id' | 'createdAt' | 'updatedAt' | 'userId'>
): MemoryCard {
  let finalUserId: string;
  let finalCard: Omit<MemoryCard, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;

  // 判断调用方式
  if (typeof userIdOrCard === 'string' && card) {
    finalUserId = userIdOrCard;
    finalCard = card;
  } else if (typeof userIdOrCard === 'object') {
    // 兼容旧用法：从对象中提取 userId
    const c = userIdOrCard as any;
    finalUserId = c.userId || '';
    finalCard = c;
  } else {
    throw new Error('Invalid arguments for saveMemoryCard');
  }

  const cards = readJsonFile<MemoryCard[]>(MEMORY_CARDS_FILE, []);

  const newCard: MemoryCard = {
    id: uuidv4(),
    userId: finalUserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...finalCard,
  };

  cards.push(newCard);
  writeJsonFile(MEMORY_CARDS_FILE, cards);

  return newCard;
}

/**
 * 获取用户的记忆卡片
 */
export function getUserMemoryCards(userId: string, pagination?: PaginationParams): PaginatedResult<MemoryCard> {
  const cards = readJsonFile<MemoryCard[]>(MEMORY_CARDS_FILE, []);
  const userCards = cards.filter(c => c.userId === userId);
  return getPaginatedResult(userCards, pagination);
}

/**
 * 获取记忆卡片
 */
export function getMemoryCardById(id: string): MemoryCard | null {
  const cards = readJsonFile<MemoryCard[]>(MEMORY_CARDS_FILE, []);
  return cards.find(c => c.id === id) || null;
}

/**
 * 更新记忆卡片
 */
export function updateMemoryCard(id: string, updates: Partial<MemoryCard>): MemoryCard | null {
  const cards = readJsonFile<MemoryCard[]>(MEMORY_CARDS_FILE, []);
  const index = cards.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  cards[index] = { ...cards[index], ...updates };
  writeJsonFile(MEMORY_CARDS_FILE, cards);
  return cards[index];
}

/**
 * 删除记忆卡片
 */
export function deleteMemoryCard(id: string): boolean {
  const cards = readJsonFile<MemoryCard[]>(MEMORY_CARDS_FILE, []);
  const filtered = cards.filter(c => c.id !== id);
  
  if (filtered.length === cards.length) return false;
  
  writeJsonFile(MEMORY_CARDS_FILE, filtered);
  return true;
}

// ==================== 回忆录草稿操作 ====================

/**
 * 保存回忆录草稿
 */
export function saveMemoirDraft(draft: Omit<MemoirDraft, 'id' | 'createdAt' | 'updatedAt'>): MemoirDraft {
  const drafts = readJsonFile<MemoirDraft[]>(DRAFTS_FILE, []);
  
  const newDraft: MemoirDraft = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...draft,
  };
  
  drafts.push(newDraft);
  writeJsonFile(DRAFTS_FILE, drafts);
  
  return newDraft;
}

/**
 * 获取用户的回忆录草稿
 */
export function getUserDrafts(userId: string, pagination?: PaginationParams): PaginatedResult<MemoirDraft> {
  const drafts = readJsonFile<MemoirDraft[]>(DRAFTS_FILE, []);
  const userDrafts = drafts
    .filter(d => d.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return getPaginatedResult(userDrafts, pagination);
}

/**
 * 获取草稿
 */
export function getDraftById(id: string): MemoirDraft | null {
  const drafts = readJsonFile<MemoirDraft[]>(DRAFTS_FILE, []);
  return drafts.find(d => d.id === id) || null;
}

/**
 * 更新草稿
 */
export function updateDraft(id: string, updates: Partial<MemoirDraft>): MemoirDraft | null {
  const drafts = readJsonFile<MemoirDraft[]>(DRAFTS_FILE, []);
  const index = drafts.findIndex(d => d.id === id);
  
  if (index === -1) return null;
  
  drafts[index] = {
    ...drafts[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  writeJsonFile(DRAFTS_FILE, drafts);
  return drafts[index];
}

/**
 * 删除草稿
 */
export function deleteDraft(id: string): boolean {
  const drafts = readJsonFile<MemoirDraft[]>(DRAFTS_FILE, []);
  const filtered = drafts.filter(d => d.id !== id);
  
  if (filtered.length === drafts.length) return false;
  
  writeJsonFile(DRAFTS_FILE, filtered);
  return true;
}

/**
 * 添加评审轮次
 */
export function addReviewRound(draftId: string, review: ReviewRound): MemoirDraft | null {
  const draft = getDraftById(draftId);
  if (!draft) return null;
  
  return updateDraft(draftId, {
    reviewRounds: [...draft.reviewRounds, review],
    version: draft.version + 1,
  });
}

/**
 * 标记导出格式
 */
export function markExportedFormat(draftId: string, format: ExportFormat): MemoirDraft | null {
  const draft = getDraftById(draftId);
  if (!draft) return null;
  
  const formats = draft.exportedFormats || [];
  if (!formats.includes(format)) {
    formats.push(format);
    return updateDraft(draftId, { exportedFormats: formats });
  }
  return draft;
}

// ==================== 导入文件操作 ====================

/**
 * 保存导入文件信息
 */
export function saveImportedFile(file: Omit<ImportedFile, 'id' | 'createdAt' | 'updatedAt'>): ImportedFile {
  const files = readJsonFile<ImportedFile[]>(FILES_FILE, []);
  
  const newFile: ImportedFile = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...file,
  };
  
  files.push(newFile);
  writeJsonFile(FILES_FILE, files);
  
  return newFile;
}

/**
 * 获取用户的导入文件
 */
export function getUserImportedFiles(userId: string): ImportedFile[] {
  const files = readJsonFile<ImportedFile[]>(FILES_FILE, []);
  return files.filter(f => f.userId === userId);
}

/**
 * 删除导入文件
 */
export function deleteImportedFile(id: string): boolean {
  const files = readJsonFile<ImportedFile[]>(FILES_FILE, []);
  const filtered = files.filter(f => f.id !== id);
  
  if (filtered.length === files.length) return false;
  
  writeJsonFile(FILES_FILE, filtered);
  return true;
}

// ==================== 统计数据 ====================

/**
 * 获取用户统计信息
 */
export function getUserStats(userId: string): {
  totalSessions: number;
  totalMessages: number;
  totalCards: number;
  totalDrafts: number;
} {
  const user = getUserById(userId);
  const cardsResult = getUserMemoryCards(userId);
  const draftsResult = getUserDrafts(userId);
  
  return {
    totalSessions: user?.totalSessions || 0,
    totalMessages: user?.totalMessages || 0,
    totalCards: cardsResult.items.length,
    totalDrafts: draftsResult.items.length,
  };
}

// ==================== 基础 AI 对话 MVP 数据 ====================

export function createConversationSession(
  input: Omit<ConversationSession, 'id' | 'startedAt' | 'interruptionCount' | 'usedWebSearch' | 'citations' | 'riskFlags' | 'turnCount' | 'lastState'>
): ConversationSession {
  const sessions = readJsonFile<ConversationSession[]>(CONVERSATION_SESSIONS_FILE, []);
  const newSession: ConversationSession = {
    id: uuidv4(),
    startedAt: new Date().toISOString(),
    interruptionCount: 0,
    usedWebSearch: false,
    citations: [],
    riskFlags: [],
    turnCount: 0,
    lastState: 'idle',
    ...input,
  };

  sessions.push(newSession);
  writeJsonFile(CONVERSATION_SESSIONS_FILE, sessions);
  return newSession;
}

export function getConversationSessionById(id: string): ConversationSession | null {
  const sessions = readJsonFile<ConversationSession[]>(CONVERSATION_SESSIONS_FILE, []);
  return sessions.find(s => s.id === id) || null;
}

export function getUserConversationSessions(userId: string, pagination?: PaginationParams): PaginatedResult<ConversationSession> {
  const sessions = readJsonFile<ConversationSession[]>(CONVERSATION_SESSIONS_FILE, []);
  const userSessions = sessions
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return getPaginatedResult(userSessions, pagination);
}

export function updateConversationSession(id: string, updates: Partial<ConversationSession>): ConversationSession | null {
  const sessions = readJsonFile<ConversationSession[]>(CONVERSATION_SESSIONS_FILE, []);
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return null;

  sessions[index] = { ...sessions[index], ...updates };
  writeJsonFile(CONVERSATION_SESSIONS_FILE, sessions);
  return sessions[index];
}

export function createMemoryCandidate(
  input: Omit<MemoryCandidate, 'id' | 'createdAt' | 'status'>
): MemoryCandidate {
  const candidates = readJsonFile<MemoryCandidate[]>(MEMORY_CANDIDATES_FILE, []);
  const newCandidate: MemoryCandidate = {
    id: uuidv4(),
    status: 'pending_elder_confirm',
    createdAt: new Date().toISOString(),
    ...input,
  };

  candidates.push(newCandidate);
  writeJsonFile(MEMORY_CANDIDATES_FILE, candidates);
  return newCandidate;
}

export function getMemoryCandidateById(id: string): MemoryCandidate | null {
  const candidates = readJsonFile<MemoryCandidate[]>(MEMORY_CANDIDATES_FILE, []);
  return candidates.find(c => c.id === id) || null;
}

export function getUserMemoryCandidates(userId: string, status?: MemoryCandidate['status']): MemoryCandidate[] {
  const candidates = readJsonFile<MemoryCandidate[]>(MEMORY_CANDIDATES_FILE, []);
  return candidates
    .filter(c => c.userId === userId && (!status || c.status === status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function updateMemoryCandidate(id: string, updates: Partial<MemoryCandidate>): MemoryCandidate | null {
  const candidates = readJsonFile<MemoryCandidate[]>(MEMORY_CANDIDATES_FILE, []);
  const index = candidates.findIndex(c => c.id === id);
  if (index === -1) return null;

  candidates[index] = {
    ...candidates[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(MEMORY_CANDIDATES_FILE, candidates);
  return candidates[index];
}

export function createInterviewMaterial(input: Omit<InterviewMaterial, 'id' | 'createdAt'>): InterviewMaterial {
  const materials = readJsonFile<InterviewMaterial[]>(INTERVIEW_MATERIALS_FILE, []);
  const newMaterial: InterviewMaterial = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    ...input,
  };

  materials.push(newMaterial);
  writeJsonFile(INTERVIEW_MATERIALS_FILE, materials);
  return newMaterial;
}

export function getUserInterviewMaterials(userId: string): InterviewMaterial[] {
  const materials = readJsonFile<InterviewMaterial[]>(INTERVIEW_MATERIALS_FILE, []);
  return materials
    .filter(m => m.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createChildVisibleSummary(input: Omit<ChildVisibleSummary, 'id' | 'createdAt'>): ChildVisibleSummary {
  const summaries = readJsonFile<ChildVisibleSummary[]>(CHILD_SUMMARIES_FILE, []);
  const existingIndex = summaries.findIndex(s => s.sessionId === input.sessionId);
  const summary: ChildVisibleSummary = {
    id: existingIndex >= 0 ? summaries[existingIndex].id : uuidv4(),
    createdAt: existingIndex >= 0 ? summaries[existingIndex].createdAt : new Date().toISOString(),
    ...input,
  };

  if (existingIndex >= 0) {
    summaries[existingIndex] = summary;
  } else {
    summaries.push(summary);
  }

  writeJsonFile(CHILD_SUMMARIES_FILE, summaries);
  return summary;
}

export function getChildVisibleSummaryBySessionId(sessionId: string): ChildVisibleSummary | null {
  const summaries = readJsonFile<ChildVisibleSummary[]>(CHILD_SUMMARIES_FILE, []);
  return summaries.find(s => s.sessionId === sessionId) || null;
}

export function getUserChildVisibleSummaries(userId: string): ChildVisibleSummary[] {
  const summaries = readJsonFile<ChildVisibleSummary[]>(CHILD_SUMMARIES_FILE, []);
  return summaries
    .filter(s => s.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function createVoiceSessionRecord(
  input: Omit<VoiceSessionRecord, 'id' | 'startedAt' | 'interruptionCount'>
): VoiceSessionRecord {
  const sessions = readJsonFile<VoiceSessionRecord[]>(VOICE_SESSIONS_FILE, []);
  const record: VoiceSessionRecord = {
    id: uuidv4(),
    startedAt: new Date().toISOString(),
    interruptionCount: 0,
    ...input,
  };

  sessions.push(record);
  writeJsonFile(VOICE_SESSIONS_FILE, sessions);
  return record;
}

export function getVoiceSessionRecordById(id: string): VoiceSessionRecord | null {
  const sessions = readJsonFile<VoiceSessionRecord[]>(VOICE_SESSIONS_FILE, []);
  return sessions.find(s => s.id === id) || null;
}

export function updateVoiceSessionRecord(id: string, updates: Partial<VoiceSessionRecord>): VoiceSessionRecord | null {
  const sessions = readJsonFile<VoiceSessionRecord[]>(VOICE_SESSIONS_FILE, []);
  const index = sessions.findIndex(s => s.id === id);
  if (index === -1) return null;

  sessions[index] = { ...sessions[index], ...updates };
  writeJsonFile(VOICE_SESSIONS_FILE, sessions);
  return sessions[index];
}

/**
 * 初始化数据目录
 */
export function initializeDatabase(): void {
  ensureDataFiles();
  logger.info('数据库初始化完成！');
}

// ==================== 兼容函数别名 ====================

/**
 * 添加消息 (saveMessage 的别名)
 */
export const addMessage = saveMessage;

/**
 * 创建记忆卡片 (saveMemoryCard 的别名)
 */
export const createMemoryCard = saveMemoryCard;

/**
 * 获取今日总结
 */
export function getTodaySummary(userId: string): string {
  const sessionsResult = getUserSessions(userId);
  const sessions = sessionsResult.items;
  const today = new Date().toISOString().split('T')[0];
  
  const todaySessions = sessions.filter(s => 
    s.createdAt.split('T')[0] === today
  );
  
  if (todaySessions.length === 0) {
    return '今天是第一次访谈，还没有任何记录。';
  }
  
  let summary = `今天已完成 ${todaySessions.length} 次访谈。\n`;
  
  todaySessions.forEach((session, index) => {
    summary += `${index + 1}. ${session.phase}: ${session.messageCount} 条消息`;
    if (session.summary) {
      summary += ` - ${session.summary}`;
    }
    summary += '\n';
  });
  
  return summary;
}

/**
 * 获取用户时间线
 */
export function getUserTimeline(userId: string): Array<{
  date: string;
  type: string;
  title: string;
  description: string;
}> {
  const cardsResult = getUserMemoryCards(userId);
  const cards = cardsResult.items;
  const timeline: Array<{
    date: string;
    type: string;
    title: string;
    description: string;
  }> = [];
  
  // 从记忆卡片中提取时间线
  cards.forEach(card => {
    if (card.type === 'timeline_entry') {
      const entry = card as any;
      timeline.push({
        date: entry.year || card.createdAt.split('T')[0],
        type: 'timeline',
        title: card.title,
        description: card.content,
      });
    } else if (card.type === 'event') {
      const event = card as any;
      timeline.push({
        date: event.year || card.createdAt.split('T')[0],
        type: 'event',
        title: card.title,
        description: card.content,
      });
    }
  });
  
  // 按日期排序
  timeline.sort((a, b) => a.date.localeCompare(b.date));
  
  return timeline;
}

// =====================================================
// 记忆片段（Episode）操作 - 本轮重构新增
// =====================================================

/**
 * 创建记忆片段
 */
export function createEpisode(userId: string, episode: Partial<Episode>): Episode {
  const episodes = readJsonFile<Episode[]>(EPISODES_FILE, []);
  
  const newEpisode: Episode = {
    id: uuidv4(),
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: episode.title || '未命名记忆',
    summary: episode.summary,
    stage: episode.stage,
    themeTags: episode.themeTags || [],
    relatedSessionIds: episode.relatedSessionIds || [],
    relatedCardIds: episode.relatedCardIds || [],
    articleDraftIds: episode.articleDraftIds || [],
    chapterId: episode.chapterId,
    status: episode.status || 'draft',
    importance: episode.importance || 3,
    memoryCount: 0,
    lastInterviewDate: episode.lastInterviewDate,
  };
  
  episodes.push(newEpisode);
  writeJsonFile(EPISODES_FILE, episodes);
  
  return newEpisode;
}

/**
 * 获取用户的记忆片段
 */
export function getUserEpisodes(userId: string, pagination?: PaginationParams): PaginatedResult<Episode> {
  const episodes = readJsonFile<Episode[]>(EPISODES_FILE, []);
  const userEpisodes = episodes
    .filter(e => e.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return getPaginatedResult(userEpisodes, pagination);
}

/**
 * 获取记忆片段
 */
export function getEpisodeById(id: string): Episode | null {
  const episodes = readJsonFile<Episode[]>(EPISODES_FILE, []);
  return episodes.find(e => e.id === id) || null;
}

/**
 * 更新记忆片段
 */
export function updateEpisode(id: string, updates: Partial<Episode>): Episode | null {
  const episodes = readJsonFile<Episode[]>(EPISODES_FILE, []);
  const index = episodes.findIndex(e => e.id === id);
  
  if (index === -1) return null;
  
  episodes[index] = {
    ...episodes[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(EPISODES_FILE, episodes);
  return episodes[index];
}

/**
 * 删除记忆片段（仅标记为归档，不物理删除）
 */
export function archiveEpisode(id: string): Episode | null {
  return updateEpisode(id, { status: 'archived' });
}

// =====================================================
// 文章草稿（ArticleDraft）操作 - 本轮重构新增
// =====================================================

/**
 * 创建文章草稿
 */
export function createArticle(userId: string, article: Partial<ArticleDraft>): ArticleDraft {
  const articles = readJsonFile<ArticleDraft[]>(ARTICLES_FILE, []);
  
  const newArticle: ArticleDraft = {
    id: uuidv4(),
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: article.title,
    content: article.content || '',
    episodeId: article.episodeId,
    chapterId: article.chapterId,
    sourceCardIds: article.sourceCardIds || [],
    uncertainFactIds: article.uncertainFactIds || [],
    styleId: article.styleId || 'narrative',
    version: 1,
    status: article.status || 'draft',
    reviewRoundIds: [],
    wordCount: article.content?.length || 0,
  };
  
  articles.push(newArticle);
  writeJsonFile(ARTICLES_FILE, articles);
  
  return newArticle;
}

/**
 * 获取用户的文章草稿
 */
export function getUserArticles(userId: string, pagination?: PaginationParams): PaginatedResult<ArticleDraft> {
  const articles = readJsonFile<ArticleDraft[]>(ARTICLES_FILE, []);
  const userArticles = articles
    .filter(a => a.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return getPaginatedResult(userArticles, pagination);
}

/**
 * 获取文章草稿
 */
export function getArticleById(id: string): ArticleDraft | null {
  const articles = readJsonFile<ArticleDraft[]>(ARTICLES_FILE, []);
  return articles.find(a => a.id === id) || null;
}

/**
 * 更新文章草稿
 */
export function updateArticle(id: string, updates: Partial<ArticleDraft>): ArticleDraft | null {
  const articles = readJsonFile<ArticleDraft[]>(ARTICLES_FILE, []);
  const index = articles.findIndex(a => a.id === id);
  
  if (index === -1) return null;
  
  articles[index] = {
    ...articles[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    wordCount: updates.content?.length || articles[index].wordCount,
  };
  writeJsonFile(ARTICLES_FILE, articles);
  return articles[index];
}

// =====================================================
// 章节（Chapter）操作 - 本轮重构新增
// =====================================================

/**
 * 创建章节
 */
export function createChapter(userId: string, bookProjectId: string, chapter: Partial<Chapter>): Chapter {
  const chapters = readJsonFile<Chapter[]>(CHAPTERS_FILE, []);
  
  // 获取当前最大排序值
  const existingChapters = chapters.filter(c => c.bookProjectId === bookProjectId);
  const maxOrder = existingChapters.length > 0 
    ? Math.max(...existingChapters.map(c => c.order)) 
    : 0;
  
  const newChapter: Chapter = {
    id: uuidv4(),
    userId,
    bookProjectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: chapter.title || '未命名章节',
    summary: chapter.summary,
    stageOrTheme: chapter.stageOrTheme || '',
    articleDraftIds: chapter.articleDraftIds || [],
    episodeIds: chapter.episodeIds || [],
    order: chapter.order || maxOrder + 1,
    status: chapter.status || 'draft',
  };
  
  chapters.push(newChapter);
  writeJsonFile(CHAPTERS_FILE, chapters);
  
  return newChapter;
}

/**
 * 获取项目的章节
 */
export function getProjectChapters(bookProjectId: string): Chapter[] {
  const chapters = readJsonFile<Chapter[]>(CHAPTERS_FILE, []);
  return chapters
    .filter(c => c.bookProjectId === bookProjectId)
    .sort((a, b) => a.order - b.order);
}

/**
 * 获取章节
 */
export function getChapterById(id: string): Chapter | null {
  const chapters = readJsonFile<Chapter[]>(CHAPTERS_FILE, []);
  return chapters.find(c => c.id === id) || null;
}

/**
 * 更新章节
 */
export function updateChapter(id: string, updates: Partial<Chapter>): Chapter | null {
  const chapters = readJsonFile<Chapter[]>(CHAPTERS_FILE, []);
  const index = chapters.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  chapters[index] = {
    ...chapters[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(CHAPTERS_FILE, chapters);
  return chapters[index];
}

// =====================================================
// 回忆录项目（BookProject）操作 - 本轮重构新增
// =====================================================

/**
 * 创建回忆录项目
 */
export function createBookProject(userId: string, project: Partial<BookProject>): BookProject {
  const books = readJsonFile<BookProject[]>(BOOKS_FILE, []);
  
  const newBook: BookProject = {
    id: uuidv4(),
    userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: project.title || '我的回忆录',
    subtitle: project.subtitle,
    description: project.description,
    chapterIds: project.chapterIds || [],
    styleId: project.styleId || 'narrative',
    status: project.status || 'planning',
    targetWordCount: project.targetWordCount,
    completedChapterCount: 0,
    totalChapterCount: 0,
  };
  
  books.push(newBook);
  writeJsonFile(BOOKS_FILE, books);
  
  return newBook;
}

/**
 * 获取用户的回忆录项目
 */
export function getUserBookProjects(userId: string, pagination?: PaginationParams): PaginatedResult<BookProject> {
  const books = readJsonFile<BookProject[]>(BOOKS_FILE, []);
  const userBooks = books
    .filter(b => b.userId === userId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return getPaginatedResult(userBooks, pagination);
}

/**
 * 获取回忆录项目
 */
export function getBookProjectById(id: string): BookProject | null {
  const books = readJsonFile<BookProject[]>(BOOKS_FILE, []);
  return books.find(b => b.id === id) || null;
}

/**
 * 更新回忆录项目
 */
export function updateBookProject(id: string, updates: Partial<BookProject>): BookProject | null {
  const books = readJsonFile<BookProject[]>(BOOKS_FILE, []);
  const index = books.findIndex(b => b.id === id);
  
  if (index === -1) return null;
  
  books[index] = {
    ...books[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(BOOKS_FILE, books);
  return books[index];
}

// =====================================================
// 家庭成员操作 - 本轮重构新增
// =====================================================

/**
 * 添加家庭成员
 */
export function addFamilyMember(userId: string, member: Partial<FamilyMember>): FamilyMember {
  const members = readJsonFile<FamilyMember[]>(FAMILY_FILE, []);
  
  const newMember: FamilyMember = {
    id: uuidv4(),
    userId,
    relatedProjectId: member.relatedProjectId,
    name: member.name || '',
    relationship: member.relationship || '',
    role: member.role || 'family_viewer',
    canEdit: member.canEdit || false,
    canDeleteOriginalContent: false,  // 默认不可删除原始内容
    canSuggest: member.canSuggest || true,
    canInvite: member.canInvite || false,
    canExport: member.canExport || false,
    email: member.email,
    phone: member.phone,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  members.push(newMember);
  writeJsonFile(FAMILY_FILE, members);
  
  return newMember;
}

/**
 * 获取家庭成员列表
 */
export function getFamilyMembers(userId: string, pagination?: PaginationParams): PaginatedResult<FamilyMember> {
  const members = readJsonFile<FamilyMember[]>(FAMILY_FILE, []);
  const userMembers = members.filter(m => m.userId === userId);
  return getPaginatedResult(userMembers, pagination);
}

/**
 * 获取家庭成员
 */
export function getFamilyMemberById(id: string): FamilyMember | null {
  const members = readJsonFile<FamilyMember[]>(FAMILY_FILE, []);
  return members.find(m => m.id === id) || null;
}

/**
 * 更新家庭成员
 */
export function updateFamilyMember(id: string, updates: Partial<FamilyMember>): FamilyMember | null {
  const members = readJsonFile<FamilyMember[]>(FAMILY_FILE, []);
  const index = members.findIndex(m => m.id === id);
  
  if (index === -1) return null;
  
  // 保护性检查：不可将 canDeleteOriginalContent 设为 true
  if (updates.canDeleteOriginalContent === true) {
    updates.canDeleteOriginalContent = false;
  }
  
  members[index] = {
    ...members[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(FAMILY_FILE, members);
  return members[index];
}

/**
 * 移除家庭成员
 */
export function removeFamilyMember(id: string): boolean {
  const members = readJsonFile<FamilyMember[]>(FAMILY_FILE, []);
  const filtered = members.filter(m => m.id !== id);
  
  if (filtered.length === members.length) return false;
  
  writeJsonFile(FAMILY_FILE, filtered);
  return true;
}

// =====================================================
// 家庭贡献操作 - 本轮重构新增
// =====================================================

/**
 * 添加家庭贡献
 */
export function addContribution(projectId: string, contribution: Partial<FamilyContribution>): FamilyContribution {
  const contributions = readJsonFile<FamilyContribution[]>(CONTRIBUTIONS_FILE, []);
  
  const newContribution: FamilyContribution = {
    id: uuidv4(),
    projectId,
    contributorId: contribution.contributorId || '',
    contributionType: contribution.contributionType || 'note',
    targetType: contribution.targetType || 'episode',
    targetId: contribution.targetId || '',
    content: contribution.content || '',
    status: contribution.status || 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  contributions.push(newContribution);
  writeJsonFile(CONTRIBUTIONS_FILE, contributions);
  
  return newContribution;
}

/**
 * 获取项目的贡献列表
 */
export function getProjectContributions(projectId: string): FamilyContribution[] {
  const contributions = readJsonFile<FamilyContribution[]>(CONTRIBUTIONS_FILE, []);
  return contributions
    .filter(c => c.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 更新贡献状态
 */
export function updateContributionStatus(id: string, status: FamilyContribution['status']): FamilyContribution | null {
  const contributions = readJsonFile<FamilyContribution[]>(CONTRIBUTIONS_FILE, []);
  const index = contributions.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  contributions[index] = {
    ...contributions[index],
    status,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFile(CONTRIBUTIONS_FILE, contributions);
  return contributions[index];
}

// =====================================================
// 授权记录操作 - 本轮重构新增
// =====================================================

/**
 * 创建授权记录
 */
export function createConsent(userId: string, consent: Partial<ConsentRecord>): ConsentRecord {
  const consents = readJsonFile<ConsentRecord[]>(CONSENTS_FILE, []);
  
  const newConsent: ConsentRecord = {
    id: uuidv4(),
    userId,
    consentType: consent.consentType || 'data_collection',
    targetId: consent.targetId,
    status: consent.status || 'pending',
    note: consent.note,
    createdAt: new Date().toISOString(),
  };
  
  consents.push(newConsent);
  writeJsonFile(CONSENTS_FILE, consents);
  
  return newConsent;
}

/**
 * 获取用户的授权记录
 */
export function getUserConsents(userId: string, pagination?: PaginationParams): PaginatedResult<ConsentRecord> {
  const consents = readJsonFile<ConsentRecord[]>(CONSENTS_FILE, []);
  const userConsents = consents.filter(c => c.userId === userId);
  return getPaginatedResult(userConsents, pagination);
}

/**
 * 更新授权状态
 */
export function updateConsentStatus(id: string, status: ConsentRecord['status']): ConsentRecord | null {
  const consents = readJsonFile<ConsentRecord[]>(CONSENTS_FILE, []);
  const index = consents.findIndex(c => c.id === id);
  
  if (index === -1) return null;
  
  consents[index] = {
    ...consents[index],
    status,
  };
  writeJsonFile(CONSENTS_FILE, consents);
  return consents[index];
}

// =====================================================
// 操作日志操作 - 本轮重构新增
// =====================================================

/**
 * 记录操作日志
 */
export function logAction(log: Omit<EditActionLog, 'id' | 'createdAt'>): EditActionLog {
  const logs = readJsonFile<EditActionLog[]>(ACTION_LOGS_FILE, []);
  
  const newLog: EditActionLog = {
    id: uuidv4(),
    ...log,
    createdAt: new Date().toISOString(),
  };
  
  logs.push(newLog);
  writeJsonFile(ACTION_LOGS_FILE, logs);
  
  return newLog;
}

/**
 * 获取项目的操作日志
 */
export function getProjectActionLogs(projectId: string): EditActionLog[] {
  const logs = readJsonFile<EditActionLog[]>(ACTION_LOGS_FILE, []);
  return logs
    .filter(l => l.projectId === projectId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// =====================================================
// 语音角色操作 - 本轮重构新增
// =====================================================

/**
 * 创建语音角色
 */
export function createVoicePersona(userId: string, persona: Partial<VoicePersona>): VoicePersona {
  const personas = readJsonFile<VoicePersona[]>(VOICE_PERSONAS_FILE, []);
  
  const newPersona: VoicePersona = {
    id: uuidv4(),
    userId,
    label: persona.label || '默认声音',
    description: persona.description,
    voiceStyle: persona.voiceStyle || 'warm',
    speakingSpeed: persona.speakingSpeed || 1.0,
    warmthLevel: persona.warmthLevel || 3,
    pauseStyle: persona.pauseStyle || 'natural',
    isFamilyInspired: persona.isFamilyInspired || false,
    requiresConsent: persona.requiresConsent || false,
    isActive: persona.isActive || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  personas.push(newPersona);
  writeJsonFile(VOICE_PERSONAS_FILE, personas);
  
  return newPersona;
}

/**
 * 获取用户的语音角色
 */
export function getUserVoicePersonas(userId: string): VoicePersona[] {
  const personas = readJsonFile<VoicePersona[]>(VOICE_PERSONAS_FILE, []);
  return personas.filter(p => p.userId === userId);
}

// =====================================================
// 形象角色操作 - 本轮重构新增
// =====================================================

/**
 * 创建形象角色
 */
export function createAvatarProfile(userId: string, avatar: Partial<AvatarProfile>): AvatarProfile {
  const avatars = readJsonFile<AvatarProfile[]>(AVATARS_FILE, []);
  
  const newAvatar: AvatarProfile = {
    id: uuidv4(),
    userId,
    label: avatar.label || '默认形象',
    description: avatar.description,
    visualStyle: avatar.visualStyle || '2d',
    colorTone: avatar.colorTone || 'warm',
    personaTraits: avatar.personaTraits || [],
    isFamilyInspired: avatar.isFamilyInspired || false,
    requiresConsent: avatar.requiresConsent || false,
    isActive: avatar.isActive || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  avatars.push(newAvatar);
  writeJsonFile(AVATARS_FILE, avatars);
  
  return newAvatar;
}

/**
 * 获取用户的形象角色
 */
export function getUserAvatarProfiles(userId: string): AvatarProfile[] {
  const avatars = readJsonFile<AvatarProfile[]>(AVATARS_FILE, []);
  return avatars.filter(a => a.userId === userId);
}

// =====================================================
// 初始化新增数据文件
// =====================================================

/**
 * 初始化新增数据目录
 */
export function initializeNewDataFiles(): void {
  readJsonFile(EPISODES_FILE, []);
  readJsonFile(ARTICLES_FILE, []);
  readJsonFile(CHAPTERS_FILE, []);
  readJsonFile(BOOKS_FILE, []);
  readJsonFile(FAMILY_FILE, []);
  readJsonFile(CONTRIBUTIONS_FILE, []);
  readJsonFile(CONSENTS_FILE, []);
  readJsonFile(ACTION_LOGS_FILE, []);
  readJsonFile(VOICE_PERSONAS_FILE, []);
  readJsonFile(AVATARS_FILE, []);
  
  logger.info('新增数据文件初始化完成！');
}
