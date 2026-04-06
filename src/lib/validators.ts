/**
 * AI 回忆录助手 - 输入验证模块
 * 使用 Zod 进行请求参数验证
 */

import { z } from 'zod';

// ==================== 用户相关验证 ====================

/**
 * 用户创建验证
 */
export const CreateUserSchema = z.object({
  name: z.string()
    .min(1, '称呼不能为空')
    .max(50, '称呼最长50个字符'),
  ageGroup: z.string()
    .refine(val => !val || ['60-65', '65-70', '70-75', '75-80', '80+'].includes(val), {
      message: '年龄段选择无效',
    })
    .optional(),
  gender: z.string()
    .refine(val => !val || ['male', 'female', 'other', 'prefer_not_to_say'].includes(val), {
      message: '性别选择无效',
    })
    .optional(),
  birthPlace: z.string()
    .max(100, '出生地最长100个字符')
    .optional(),
  grewUpPlace: z.string()
    .max(100, '成长地最长100个字符')
    .optional(),
  education: z.string()
    .refine(val => !val || ['小学', '初中', '高中/中专', '大专', '本科', '研究生'].includes(val), {
      message: '教育程度选择无效',
    })
    .optional(),
  useHonorific: z.boolean().default(true),
  preferredStyle: z.string().optional().default('narrative'),
  conversationDuration: z.number().optional().default(10),
  memoirGoal: z.string().optional().default('self'),
});

/**
 * 用户更新验证
 */
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  ageGroup: z.string().optional(),
  gender: z.string().optional(),
  birthPlace: z.string().max(100).optional(),
  grewUpPlace: z.string().max(100).optional(),
  education: z.string().optional(),
  useHonorific: z.boolean().optional(),
  preferredStyle: z.string().optional(),
  conversationDuration: z.number().optional(),
  memoirGoal: z.string().optional(),
  currentPhase: z.string().optional(),
});

// ==================== 会话相关验证 ====================

/**
 * 开始会话验证
 */
export const StartSessionSchema = z.object({
  userId: z.string().uuid('无效的用户ID'),
});

/**
 * 发送消息验证
 */
export const SendMessageSchema = z.object({
  userId: z.string().uuid('无效的用户ID'),
  sessionId: z.string().uuid('无效的会话ID'),
  message: z.string()
    .min(1, '消息不能为空')
    .max(5000, '消息最长5000个字符'),
});

/**
 * 结束会话验证
 */
export const EndSessionSchema = z.object({
  userId: z.string().uuid('无效的用户ID'),
  sessionId: z.string().uuid('无效的会话ID'),
  summary: z.string().optional(),
});

// ==================== 回忆录相关验证 ====================

/**
 * 生成回忆录验证
 */
export const GenerateMemoirSchema = z.object({
  userId: z.string().uuid('无效的用户ID'),
  type: z.string().refine(val => [
    'fragment', 'short_essay', 'chapter', 'book_outline',
    'character_bio', 'family_preface', 'letter', 'oral_history'
  ].includes(val), {
    message: '无效的回忆录类型',
  }),
  styleId: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).optional().default('medium'),
});

/**
 * 评审回忆录验证
 */
export const ReviewMemoirSchema = z.object({
  userId: z.string().uuid('无效的用户ID'),
  draftId: z.string().uuid('无效的草稿ID'),
  focusAreas: z.array(z.string()).optional(),
});

/**
 * 重写回忆录验证
 */
export const RewriteMemoirSchema = z.object({
  userId: z.string().uuid('无效的用户ID'),
  draftId: z.string().uuid('无效的草稿ID'),
  rewriteFocus: z.string().optional(),
});

// ==================== 草稿相关验证 ====================

/**
 * 更新草稿验证
 */
export const UpdateDraftSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().optional(),
  status: z.enum(['draft', 'reviewing', 'revised', 'published']).optional(),
});

/**
 * 删除草稿验证
 */
export const DeleteDraftSchema = z.object({
  userId: z.string().uuid('无效的用户ID'),
  draftId: z.string().uuid('无效的草稿ID'),
});

// ==================== 回忆录项目验证 ====================

/**
 * 创建回忆录项目验证
 */
export const CreateBookProjectSchema = z.object({
  action: z.literal('create'),
  title: z.string().min(1, '标题不能为空').max(200, '标题最长200字符'),
  subtitle: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  styleId: z.string().optional(),
  targetWordCount: z.number().int().positive().optional(),
});

/**
 * 回忆录项目操作验证
 */
export const BookProjectActionSchema = z.object({
  action: z.enum(['list', 'get', 'update']),
  projectId: z.string().uuid('无效的项目ID').optional(),
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  styleId: z.string().optional(),
  targetWordCount: z.number().int().positive().optional(),
});

// ==================== 章节验证 ====================

/**
 * 获取章节列表验证
 */
export const ListChapterSchema = z.object({
  action: z.literal('list'),
  bookProjectId: z.string().uuid('无效的项目ID'),
});

/**
 * 获取单个章节验证
 */
export const GetChapterSchema = z.object({
  action: z.literal('get'),
  chapterId: z.string().uuid('无效的章节ID'),
});

/**
 * 创建章节验证
 */
export const CreateChapterSchema = z.object({
  action: z.literal('create'),
  bookProjectId: z.string().uuid('无效的项目ID'),
  title: z.string().min(1, '标题不能为空').max(200, '标题最长200字符'),
  summary: z.string().max(2000).optional(),
  stageOrTheme: z.string().max(100).optional(),
  order: z.number().int().positive().optional(),
});

/**
 * 更新章节验证
 */
export const UpdateChapterSchema = z.object({
  action: z.literal('update'),
  chapterId: z.string().uuid('无效的章节ID'),
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(2000).optional(),
  stageOrTheme: z.string().max(100).optional(),
  order: z.number().int().positive().optional(),
});

/**
 * 重新排序章节验证
 */
export const ReorderChapterSchema = z.object({
  action: z.literal('reorder'),
  bookProjectId: z.string().uuid('无效的项目ID'),
  chapterIds: z.array(z.string().uuid('无效的章节ID')).min(1, '章节ID列表不能为空'),
});

// ==================== 记忆片段验证 ====================

/**
 * 获取记忆片段列表验证
 */
export const ListEpisodeSchema = z.object({
  action: z.literal('list'),
});

/**
 * 获取单个记忆片段验证
 */
export const GetEpisodeSchema = z.object({
  action: z.literal('get'),
  episodeId: z.string().uuid('无效的片段ID'),
});

/**
 * 创建记忆片段验证
 */
export const CreateEpisodeSchema = z.object({
  action: z.literal('create'),
  title: z.string().min(1, '标题不能为空').max(200, '标题最长200字符'),
  summary: z.string().max(5000).optional(),
  stage: z.string().optional(),
  themeTags: z.array(z.string()).optional(),
  relatedSessionIds: z.array(z.string()).optional(),
  relatedCardIds: z.array(z.string()).optional(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
});

/**
 * 更新记忆片段验证
 */
export const UpdateEpisodeSchema = z.object({
  action: z.literal('update'),
  episodeId: z.string().uuid('无效的片段ID'),
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(5000).optional(),
  stage: z.string().optional(),
  themeTags: z.array(z.string()).optional(),
  relatedSessionIds: z.array(z.string()).optional(),
  relatedCardIds: z.array(z.string()).optional(),
  importance: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
});

/**
 * 归档记忆片段验证
 */
export const ArchiveEpisodeSchema = z.object({
  action: z.literal('archive'),
  episodeId: z.string().uuid('无效的片段ID'),
});

/**
 * 生成文章验证
 */
export const GenerateArticleSchema = z.object({
  action: z.literal('generate_article'),
  episodeId: z.string().uuid('无效的片段ID'),
  styleId: z.string().optional(),
});

// ==================== 家庭协作验证 ====================

/**
 * 获取家庭成员列表验证
 */
export const ListFamilyMemberSchema = z.object({
  action: z.literal('list_members'),
});

/**
 * 获取单个家庭成员验证
 */
export const GetFamilyMemberSchema = z.object({
  action: z.literal('get_member'),
  memberId: z.string().uuid('无效的成员ID'),
});

/**
 * 添加家庭成员验证
 */
export const AddFamilyMemberSchema = z.object({
  action: z.literal('add_member'),
  name: z.string().min(1, '名称不能为空').max(100, '名称最长100字符'),
  relationship: z.string().max(100).optional(),
  role: z.enum(['elder', 'family_editor', 'family_viewer', 'owner']).optional(),
  canEdit: z.boolean().optional(),
  canSuggest: z.boolean().optional(),
  canInvite: z.boolean().optional(),
  canExport: z.boolean().optional(),
  email: z.string().email('无效的邮箱格式').or(z.string().max(0)).optional(),
  phone: z.string().max(20).optional(),
  relatedProjectId: z.string().uuid('无效的项目ID').optional(),
});

/**
 * 更新家庭成员验证
 */
export const UpdateFamilyMemberSchema = z.object({
  action: z.literal('update_member'),
  memberId: z.string().uuid('无效的成员ID'),
  name: z.string().min(1).max(100).optional(),
  relationship: z.string().max(100).optional(),
  role: z.enum(['elder', 'family_editor', 'family_viewer', 'owner']).optional(),
  canEdit: z.boolean().optional(),
  canSuggest: z.boolean().optional(),
  canInvite: z.boolean().optional(),
  canExport: z.boolean().optional(),
  email: z.string().email('无效的邮箱格式').or(z.string().max(0)).optional(),
  phone: z.string().max(20).optional(),
});

/**
 * 移除家庭成员验证
 */
export const RemoveFamilyMemberSchema = z.object({
  action: z.literal('remove_member'),
  memberId: z.string().uuid('无效的成员ID'),
});

// ==================== 角色/语音验证 ====================

/**
 * 角色操作验证
 */
export const AvatarActionSchema = z.object({
  action: z.enum(['list_avatars', 'list_voices', 'get_active']),
});

// ==================== 工具函数 ====================

/**
 * 验证请求体并返回解析后的数据
 * @throws ValidationError 如果验证失败
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    
    throw new ValidationError('请求参数验证失败', 'VALIDATION_ERROR', errors);
  }
  
  return result.data;
}

/**
 * 从请求中提取并验证数据
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<T> {
  try {
    const body = await request.json();
    return validateRequest(schema, body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        '请求参数格式错误',
        'INVALID_JSON',
        error.issues.map(i => ({ path: i.path.join('.'), message: i.message }))
      );
    }
    throw error;
  }
}

/**
 * 验证错误类
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public code: string,
    public errors: Array<{ path: string; message: string }> = [],
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ==================== 通用类型导出 ====================

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type GenerateMemoirInput = z.infer<typeof GenerateMemoirSchema>;
export type ReviewMemoirInput = z.infer<typeof ReviewMemoirSchema>;