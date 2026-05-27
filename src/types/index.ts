// =====================================================
// AI 回忆录助手 - 核心类型定义
// =====================================================

// 用户相关类型
export interface UserProfile {
  id: string;
  createdAt: string;
  updatedAt: string;
  
  // 基础信息
  name: string;                    // 用户称呼
  ageGroup?: string;               // 年龄段：60-65, 65-70, 70-75, 75-80, 80+
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  birthPlace?: string;             // 出生地
  grewUpPlace?: string;            // 成长地
  education?: string;              // 受教育程度
  
  // 偏好设置
  useHonorific: boolean;           // 是否使用尊称（您/你）
  preferredStyle: string;          // 偏好文风ID
  conversationDuration: number;    // 每次对话时长（分钟）
  
  // 敏感话题设置
  acceptFamilyTopics: boolean;     // 接受谈论家庭话题
  acceptCareerTopics: boolean;     // 接受谈论职业话题
  acceptWarTopics: boolean;        // 接受谈论战争/动乱话题
  acceptIllnessTopics: boolean;    // 接受谈论疾病话题
  acceptLossTopics: boolean;       // 接受谈论离别/丧亲话题
  
  // 回忆录目标
  memoirGoal: 'children' | 'grandchildren' | 'self' | 'publish' | 'family_heirloom';
  
  // 访谈进度
  currentPhase: InterviewPhase;
  totalSessions: number;
  totalMessages: number;
}

export type InterviewPhase = 
  | 'onboarding'
  | 'ice_breaker'
  | 'basic_info'
  | 'childhood'
  | 'education'
  | 'career'
  /** 婚恋与家庭（话题库等仍常用 family） */
  | 'family'
  | 'marriage_family'
  /** 迁徙与时代背景 */
  | 'migration'
  /** 友谊与社会关系（访谈引擎阶段） */
  | 'friendship'
  /** 困难与转折 */
  | 'challenges'
  | 'hardship'
  | 'proud_moments'
  | 'reflections'
  | 'legacy';

// 会话类型（本轮重构新增）
export type SessionType = 
  | 'interview'                   // 访谈会话（默认）
  | 'voice'                       // 语音会话
  | 'phone'                       // 电话式会话
  | 'review';                     // 评审会话

// 访谈消息
export interface InterviewMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  
  // 元信息
  isQuestion: boolean;
  isFollowUp: boolean;
  topicId?: string;
  phase?: InterviewPhase;
  
  // 情感标注
  emotionalTone?: EmotionalTone;
  containsSensitiveTopic: boolean;
}

// 会话
export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  endedAt?: string;
  duration: number;  // 分钟
  phase: InterviewPhase;
  messageCount: number;
  summary?: string;
  
  // 扩展字段（本轮重构新增）
  sessionType?: SessionType;       // 会话类型
  voiceModeEnabled?: boolean;     // 是否启用语音模式
  isCompleted?: boolean;           // 是否已完成
  completionReason?: string;      // 完成原因
}

// 记忆卡片类型
export interface MemoryCard {
  id: string;
  userId: string;
  type: MemoryCardType;
  createdAt: string;
  updatedAt: string;
  
  // 内容
  title: string;
  content: string;
  sourceMessageId?: string;  // 来源消息ID
  
  // 标注
  isOriginal: boolean;        // 是否为用户原话
  isSummary: boolean;        // 是否为AI概括
  isUncertain: boolean;      // 是否为待确认内容
  confidence: number;        // 置信度 0-1
  
  // 标签
  tags: string[];
  themes: ThemeTag[];
  
  // 关联
  relatedPersons: string[];  // PersonCard IDs
  relatedPlaces: string[];   // PlaceCard IDs
  relatedEvents: string[];   // EventCard IDs
}

export type MemoryCardType = 
  | 'person'
  | 'event'
  | 'place'
  | 'timeline_entry'
  | 'emotion_note'
  | 'quote_snippet'
  | 'uncertain_fact'
  | 'theme_tag';

// 人物卡片
export interface PersonCard extends MemoryCard {
  type: 'person';
  fullName: string;
  nickname?: string;
  relationship: string;       // 与用户的关系
  description?: string;
  personality?: string;
  imageUrl?: string;          // 照片
  
  // 时间信息
  birthYear?: number;
  deathYear?: number;
  isDeceased: boolean;
}

// 事件卡片
export interface EventCard extends MemoryCard {
  type: 'event';
  title: string;
  description: string;
  
  // 时间信息
  year?: number;
  yearApproximate: boolean;  // 是否为近似时间
  duration?: string;         // 持续时间
  
  // 地点
  location?: string;
  
  // 参与者
  participants: string[];    // PersonCard IDs
  
  // 重要性
  importance: 1 | 2 | 3 | 4 | 5;
  
  // 情感影响
  emotionalImpact?: EmotionalImpact;
}

// 地点卡片
export interface PlaceCard extends MemoryCard {
  type: 'place';
  name: string;
  location?: string;
  description?: string;
  
  // 时间信息
  timePeriod?: string;
  
  // 情感联系
  emotionalSignificance?: string;
}

// 时间线条目
export interface TimelineEntry extends MemoryCard {
  type: 'timeline_entry';
  year: number;
  month?: number;
  title: string;
  description: string;
  category: TimelineCategory;
}

export type TimelineCategory = 
  | 'birth'
  | 'education'
  | 'career'
  | 'marriage'
  | 'family'
  | 'migration'
  | 'achievement'
  | 'loss'
  | 'other';

// 情感标注
export type EmotionalTone = 
  | 'happy'
  | 'sad'
  | 'nostalgic'
  | 'proud'
  | 'regretful'
  | 'grateful'
  | 'peaceful'
  | 'anxious'
  | 'excited'
  | 'neutral';

export interface EmotionalImpact {
  positive: number;    // 正面影响 -5 to 5
  negative: number;   // 负面影响 -5 to 5
  description?: string;
}

// 主题标签
export interface ThemeTag {
  id: string;
  name: string;
  category: ThemeCategory;
  description?: string;
}

export type ThemeCategory = 
  | 'family'
  | 'love'
  | 'career'
  | 'struggle'
  | 'growth'
  | 'tradition'
  | 'change'
  | 'wisdom'
  | 'loss'
  | 'joy';

// 引用片段
export interface QuoteSnippet extends MemoryCard {
  type: 'quote_snippet';
  quote: string;
  context?: string;
  speaker?: string;  // 如果不是用户本人
}

// 待确认事实
export interface UncertainFact extends MemoryCard {
  type: 'uncertain_fact';
  fact: string;
  uncertaintyReason: string;
  verificationStatus: 'unverified' | 'verified' | 'contradicted';
}

// 话题相关类型
export interface Topic {
  id: string;
  category: string;
  questions: string[];           // 主问题列表
  followUps: string[];          // 追问列表
  sensitivity: SensitivityLevel;
  phases: InterviewPhase[];
  tags: string[];
  isCustom?: boolean;
}

export type SensitivityLevel = 1 | 2 | 3 | 4 | 5;
// 1: 完全无害，适合任何时候
// 2: 轻微个人，可能需要一点信任
// 3: 中等敏感，涉及情感
// 4: 高度敏感，涉及创伤或痛苦
// 5: 极其敏感，需要非常小心

// 文风配置
export interface StyleProfile {
  id: string;
  name: string;
  description: string;
  
  // 特征
  sentenceLength: 'short' | 'medium' | 'long' | 'varied';
  wordDensity: 'low' | 'medium' | 'high';
  useImagery: boolean;           // 是否强调景物
  usePhilosophy: boolean;       // 是否强调哲理
  preserveColloquial: boolean;   // 是否保留口语
  emotionalIntensity: 'restrained' | 'moderate' | 'intense';
  
  // 适用主题
  suitableThemes: string[];
  suitableTypes: MemoirType[];
  
  // 禁止项
  prohibited: string[];
  
  // 示例
  example?: string;
}

export type MemoirType = 
  | 'fragment'          // 100-300字片段
  | 'short_essay'       // 800-1500字短篇
  | 'chapter'          // 3000-5000字章节
  | 'book_outline'      // 全书目录草案
  | 'character_bio'     // 人物小传
  | 'family_preface'    // 家族纪念版前言
  | 'letter'            // 给晚辈的一封信
  | 'oral_history';     // 口述实录

// 回忆录草稿
export interface MemoirDraft {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  
  // 类型
  type: MemoirType;
  styleId: string;
  
  // 内容
  title?: string;
  content: string;
  
  // 状态
  status: 'draft' | 'reviewing' | 'revised' | 'final' | 'exported';
  version: number;
  
  // 评审
  reviewRounds: ReviewRound[];
  
  // 素材引用
  referencedCards: string[];  // MemoryCard IDs
  
  // 导出
  exportedFormats: ExportFormat[];
}

export interface ReviewRound {
  roundNumber: number;
  timestamp: string;

  // 评审结果
  scores: CritiqueScores;
  strengths: string[];
  issues: string[];
  evidence?: ReviewEvidenceItem[];
  suggestions: string[];

  // 决策
  shouldRewrite: boolean;
  rewritePriority?: 'low' | 'medium' | 'high';
  rewriteFocus?: string;

  // 修改内容
  changes?: string;
}

export interface ReviewEvidenceItem {
  type: 'fabrication' | 'generic' | 'weak_detail' | 'voice_loss' | 'coherence' | 'style_mismatch' | 'safety';
  quote?: string;
  issue: string;
  suggestion?: string;
  location?: string;
  severity?: 'low' | 'medium' | 'high';
}

// 评审分数
export interface CritiqueScores {
  // 评分维度
  authenticity: number;        // 真实性 0-10
  coherence: number;           // 连贯性 0-10
  detailLevel: number;          // 细节感 0-10
  characterPresence: number;   // 人物感 0-10
  emotionalDepth: number;      // 情感力度 0-10
  eraAtmosphere: number;       // 时代氛围 0-10
  languageNaturalness: number;  // 语言自然度 0-10
  voicePreservation: number;   // 长者本人声音保留度 0-10
  readability: number;         // 可读性 0-10
  safety: number;              // 安全性 0-10
  
  // 总分
  total: number;
}

export type ExportFormat = 
  | 'markdown'
  | 'pdf'
  | 'docx'
  | 'html'
  | 'plain_text';

// 文件导入
export interface ImportedFile {
  id: string;
  userId: string;
  filename: string;
  fileType: ImportedFileType;
  importedAt: string;
  createdAt: string;
  updatedAt?: string;
  
  // 内容
  content?: string;
  extractedTopics: string[];
  
  // 状态
  status: 'processing' | 'completed' | 'error';
  error?: string;
}

export type ImportedFileType = 
  | 'txt'
  | 'md'
  | 'docx'
  | 'pdf'
  | 'image'
  | 'genealogy'
  | 'diary'
  | 'resume'
  | 'existing_memoir';

// API 响应类型
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// 对话请求
export interface ChatRequest {
  userId: string;
  message: string;
  context?: {
    currentPhase: InterviewPhase;
    currentTopicId?: string;
    isFollowUp: boolean;
    lastMessageId?: string;
  };
}

// 对话响应
export interface ChatResponse {
  message: string;
  nextQuestion?: string;
  shouldFollowUp: boolean;
  suggestedTopics?: string[];
  detectedCards?: Partial<MemoryCard>[];
  sessionSummary?: string;
  /** 访谈引擎附加：情感分析（可选） */
  emotionAnalysis?: {
    overall?: string;
    detectedEmotions?: string[];
    intensity?: string;
  };
}

// 回忆录生成请求
export interface GenerateMemoirRequest {
  userId: string;
  type: MemoirType;
  styleId: string;
  focusTopics?: string[];
  length?: 'short' | 'medium' | 'long';
}

// 回忆录生成响应
export interface GenerateMemoirResponse {
  draft: MemoirDraft;
  usedCards: string[];
  generationNotes?: string;
}

// 评审请求
export interface ReviewMemoirRequest {
  draftId: string;
  focusAreas?: string[];
}

// 评审响应
export interface ReviewMemoirResponse {
  review: ReviewRound;
  comparisonWithPrevious?: {
    improvedAreas: string[];
    declinedAreas: string[];
    overallImprovement: number;
  };
}

// LLM 配置
export interface LLMConfig {
  provider: 'siliconflow' | 'openai' | 'volcengine' | 'qwen' | 'zhipu' | 'custom';
  apiKey: string;
  baseUrl?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

// 前端状态类型
export interface UIState {
  // 显示模式
  displayMode: 'normal' | 'large_text' | 'high_contrast';
  
  // 当前会话
  currentSession: Session | null;
  messages: InterviewMessage[];
  
  // 今日摘要
  todaySummary: string;
  
  // 进度
  progress: {
    currentPhase: InterviewPhase;
    phaseProgress: number;
    totalPhases: number;
  };
  
  // 草稿面板
  draftsPanel: {
    isOpen: boolean;
    selectedDraft: MemoirDraft | null;
  };
  
  // 时间线面板
  timelinePanel: {
    isOpen: boolean;
    selectedEntry: TimelineEntry | null;
  };
  
  // 导出面板
  exportPanel: {
    isOpen: boolean;
    format: ExportFormat;
  };
}

// =====================================================
// 记忆片段（Episode）- 本次重构新增
// =====================================================

export interface Episode {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  
  // 基本信息
  title: string;                    // 记忆片段标题
  summary?: string;                 // 摘要
  stage?: string;                   // 人生阶段
  themeTags: string[];              // 主题标签
  
  // 关联
  relatedSessionIds: string[];      // 关联的会话 ID
  relatedCardIds: string[];        // 关联的记忆卡片 ID
  articleDraftIds: string[];       // 关联的文章草稿 ID
  chapterId?: string;               // 所属章节 ID
  
  // 状态
  status: 'draft' | 'confirmed' | 'archived';
  importance: 1 | 2 | 3 | 4 | 5;    // 重要性
  
  // 元数据
  memoryCount: number;              // 包含的记忆数量
  lastInterviewDate?: string;       // 最近一次访谈日期
}

// =====================================================
// 文章草稿（ArticleDraft）- 本次重构新增
// =====================================================

export interface ArticleDraft {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  
  // 基本信息
  title?: string;                   // 文章标题
  content: string;                  // 文章内容
  
  // 关联
  episodeId?: string;               // 关联的记忆片段
  chapterId?: string;               // 所属章节
  sourceCardIds: string[];         // 引用的记忆卡片
  uncertainFactIds: string[];      // 引用的待确认事实
  
  // 风格与版本
  styleId: string;                 // 文风 ID
  version: number;                 // 版本号
  status: 'draft' | 'reviewing' | 'revised' | 'confirmed' | 'exported';
  
  // 评审
  reviewRoundIds: string[];        // 评审轮次 ID
  lastReviewDate?: string;         // 最近评审日期
  
  // 元数据
  wordCount: number;               // 字数
  sourceSummary?: string;          // 素材摘要
}

// =====================================================
// 章节（Chapter）- 本次重构新增
// =====================================================

export interface Chapter {
  id: string;
  userId: string;
  bookProjectId: string;
  createdAt: string;
  updatedAt: string;
  
  // 基本信息
  title: string;                   // 章节标题
  summary?: string;                // 章节摘要
  stageOrTheme: string;            // 人生阶段或主题
  
  // 内容
  articleDraftIds: string[];       // 包含的文章草稿 ID
  episodeIds: string[];            // 包含的记忆片段 ID
  
  // 顺序
  order: number;                   // 排序
  
  // 状态
  status: 'draft' | 'reviewing' | 'completed';
}

// =====================================================
// 回忆录项目（BookProject）- 本次重构新增
// =====================================================

export interface BookProject {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  
  // 基本信息
  title: string;                   // 项目标题
  subtitle?: string;               // 副标题
  description?: string;             // 项目描述
  
  // 结构
  chapterIds: string[];           // 章节 ID 列表
  styleId: string;                 // 文风 ID
  
  // 状态
  status: 'planning' | 'drafting' | 'reviewing' | 'completed';
  
  // 元数据
  targetWordCount?: number;        // 目标字数
  completedChapterCount: number;    // 完成的章节数
  totalChapterCount: number;      // 总章节数
}

// =====================================================
// 家庭成员与权限 - 本次重构新增
// =====================================================

export type FamilyRole = 
  | 'elder'                        // 老人（项目所有者）
  | 'family_editor'                // 家属编辑者
  | 'family_viewer'                // 家属查看者
  | 'owner';                       // 管理员

export interface FamilyMember {
  id: string;
  userId: string;                  // 关联的老人用户 ID
  relatedProjectId?: string;       // 关联的项目 ID（可选）
  
  // 身份信息
  name: string;                    // 称呼
  relationship: string;            // 与老人的关系（如：儿子、女儿、孙子）
  role: FamilyRole;                // 角色
  
  // 权限
  canEdit: boolean;                // 可编辑
  canDeleteOriginalContent: boolean; // 可删除原始内容（默认 false）
  canSuggest: boolean;             // 可建议
  canInvite: boolean;              // 可邀请其他家属
  canExport: boolean;              // 可导出
  
  // 联系方式
  email?: string;
  phone?: string;
  
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// 家庭贡献 - 本次重构新增
// =====================================================

export type ContributionType = 
  | 'note'                         // 补充说明
  | 'timeline_fix'                 // 时间线修正
  | 'photo_caption'                // 照片说明
  | 'fact_suggestion'              // 事实建议
  | 'chapter_edit';                // 章节编辑

export type ContributionStatus = 
  | 'pending'                      // 待处理
  | 'accepted'                     // 已采纳
  | 'rejected';                    // 已拒绝

export interface FamilyContribution {
  id: string;
  projectId: string;               // 关联的项目 ID
  contributorId: string;          // 贡献者 ID
  
  // 内容
  contributionType: ContributionType;
  targetType: 'episode' | 'article' | 'chapter' | 'book';
  targetId: string;
  content: string;                 // 贡献内容
  
  // 状态
  status: ContributionStatus;
  
  // 元数据
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// 授权记录 - 本次重构新增
// =====================================================

export type ConsentType = 
  | 'data_collection'              // 数据收集
  | 'voice_recording'              // 语音录制
  | 'family_share'                 // 家人分享
  | 'publication'                  // 出版
  | 'ai_training';                 // AI 训练（可选）

export type ConsentStatus = 
  | 'granted'                      // 已授权
  | 'revoked'                      // 已撤销
  | 'pending';                      // 待确认

export interface ConsentRecord {
  id: string;
  userId: string;
  
  // 授权内容
  consentType: ConsentType;
  targetId?: string;              // 关联的目标 ID（可选）
  status: ConsentStatus;
  
  // 备注
  note?: string;
  
  createdAt: string;
}

// =====================================================
// 编辑操作日志 - 本次重构新增
// =====================================================

export type EditActionType = 
  | 'create'                       // 创建
  | 'update'                       // 更新
  | 'archive'                      // 归档
  | 'restore'                      // 恢复
  | 'confirm';                     // 确认

export interface EditActionLog {
  id: string;
  projectId: string;
  targetType: 'episode' | 'article' | 'chapter' | 'memory_card';
  targetId: string;
  
  // 操作信息
  actorId: string;                // 操作者 ID
  actorRole: FamilyRole;          // 操作者角色
  actionType: EditActionType;
  
  // 变更详情
  beforeState?: string;            // 修改前状态
  afterState?: string;            // 修改后状态
  changeDescription?: string;     // 变更描述
  
  createdAt: string;
}

// =====================================================
// 语音与数字陪伴扩展位 - 本次重构新增
// =====================================================

export interface VoicePersona {
  id: string;
  userId: string;
  
  // 基本信息
  label: string;                   // 标签（如：温暖男声、柔和女声）
  description?: string;            // 描述
  
  // 声音配置
  voiceStyle: string;              // 声音风格
  speakingSpeed: number;           // 语速（0.5-2.0）
  warmthLevel: number;             // 温暖度（1-5）
  pauseStyle: string;              // 停顿风格
  
  // 授权
  isFamilyInspired: boolean;      // 是否基于家人灵感
  requiresConsent: boolean;        // 是否需要额外授权
  
  // 状态
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvatarProfile {
  id: string;
  userId: string;
  
  // 基本信息
  label: string;                   // 标签
  description?: string;            // 描述
  
  // 视觉配置
  visualStyle: string;              // 视觉风格（2D/3D/卡通等）
  colorTone: string;               // 色调
  personaTraits: string[];         // 人格特质
  
  // 授权
  isFamilyInspired: boolean;       // 是否基于家人形象
  requiresConsent: boolean;        // 是否需要额外授权
  
  // 状态
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// 基础 AI 对话 MVP - 相框语音对话与记忆沉淀
// =====================================================

export type ConversationMode = 'text' | 'web_voice_call';

export type ConversationType = 'ai_chat' | 'memory_topic';

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'error';

export interface ToolCitation {
  title: string;
  url: string;
  accessedAt: string;
  summary: string;
}

export interface ConversationSession {
  id: string;
  userId: string;
  mode: ConversationMode;
  conversationType: ConversationType;
  startedAt: string;
  endedAt?: string;
  summary?: string;
  interruptionCount: number;
  usedWebSearch: boolean;
  citations: ToolCitation[];
  riskFlags: string[];
  turnCount: number;
  lastState: VoiceState;
}

export type MemoryCandidateStatus =
  | 'pending_elder_confirm'
  | 'confirmed'
  | 'rejected'
  | 'edited';

export type MemoryCandidateType =
  | 'profile'
  | 'family_member'
  | 'preference'
  | 'taboo_topic'
  | 'life_event'
  | 'quote';

export interface MemoryCandidate {
  id: string;
  userId: string;
  sourceSessionId: string;
  sourceMessageId?: string;
  type: MemoryCandidateType;
  content: string;
  evidenceText: string;
  confidence: number;
  status: MemoryCandidateStatus;
  createdAt: string;
  updatedAt?: string;
  confirmedMemoryCardId?: string;
}

export interface InterviewMaterial {
  id: string;
  userId: string;
  sourceSessionId: string;
  title: string;
  excerpt: string;
  suggestedTopic?: string;
  createdAt: string;
}

export interface ChildVisibleSummary {
  id: string;
  userId: string;
  sessionId: string;
  title: string;
  bulletSummary: string[];
  memoryCandidateIds: string[];
  interviewMaterialIds: string[];
  riskFlags: string[];
  citations: Array<{ title: string; url: string }>;
  createdAt: string;
}

export type SearchToolIntent =
  | 'weather'
  | 'holiday'
  | 'news_summary'
  | 'encyclopedia'
  | 'health_low_risk';

export interface SearchToolRequest {
  userId: string;
  sessionId: string;
  intent: SearchToolIntent;
  query: string;
  locationHint?: string;
}

export interface SearchToolResult {
  answerContext: string;
  citations: ToolCitation[];
  riskLevel: 'low' | 'medium' | 'high';
}

export interface VoiceSessionRecord {
  id: string;
  userId: string;
  conversationSessionId?: string;
  provider: 'doubao';
  providerConfigured: boolean;
  fallbackMode: boolean;
  state: VoiceState;
  startedAt: string;
  endedAt?: string;
  interruptionCount: number;
  errorMessage?: string;
}
