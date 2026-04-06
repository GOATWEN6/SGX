/**
 * 阶段管理器 - 负责管理访谈的不同阶段
 */
import { InterviewPhase } from '@/types';
import { PhaseConfig, PhaseAdvanceDecision } from './types';

// 阶段配置定义
const PHASE_CONFIGS: Record<InterviewPhase, PhaseConfig> = {
  onboarding: {
    phase: 'onboarding',
    description: '初始设置与欢迎',
    details: '欢迎用户，介绍系统功能，确认用户偏好设置',
    objective: '让用户了解系统，建立初步信任',
    completionCriteria: ['用户完成设置', '用户理解系统功能'],
    tabooTopics: [],
    recommendedTopics: ['系统介绍', '偏好设置'],
  },
  ice_breaker: {
    phase: 'ice_breaker',
    description: '破冰与信任建立',
    details: '使用轻松、非侵入性的话题，建立信任关系，让用户感到舒适',
    objective: '建立信任，让用户放松',
    completionCriteria: ['用户开始分享', '情绪放松', '至少3条消息'],
    tabooTopics: [],
    recommendedTopics: ['天气', '日常', '简单童年记忆'],
  },
  basic_info: {
    phase: 'basic_info',
    description: '基本人生信息',
    details: '温和地了解用户的背景信息，但不要像填表格一样审问',
    objective: '收集基本背景信息',
    completionCriteria: ['了解出生地', '了解成长地', '了解教育程度'],
    tabooTopics: ['收入', '婚姻状况'],
    recommendedTopics: ['出生地', '成长环境', '家庭概况'],
  },
  childhood: {
    phase: 'childhood',
    description: '童年与家庭',
    details: '鼓励回忆早年生活，关注家庭成员和场景细节',
    objective: '了解童年经历和家庭背景',
    completionCriteria: ['用户描述童年生活', '提到至少一个家庭成员', '有具体场景'],
    tabooTopics: ['创伤', '家庭冲突'],
    recommendedTopics: ['小时候的家', '父母', '兄弟姐妹', '童年游戏', '学校生活'],
  },
  education: {
    phase: 'education',
    description: '学校与成长',
    details: '了解求学经历，关注学校生活对人生的影响',
    objective: '了解教育经历',
    completionCriteria: ['用户描述学生时代', '提到学校或老师', '有学习相关故事'],
    tabooTopics: [],
    recommendedTopics: ['学校生活', '老师', '同学', '难忘的学习经历'],
  },
  career: {
    phase: 'career',
    description: '工作与事业',
    details: '了解职业历程，第一份工作，最难忘的工作经历',
    objective: '了解职业发展',
    completionCriteria: ['用户描述工作经历', '提到第一份工作', '有职业故事'],
    tabooTopics: ['收入'],
    recommendedTopics: ['第一份工作', '职业转折', '工作成就', '同事'],
  },
  family: {
    phase: 'family',
    description: '婚恋与家庭生活',
    details: '谨慎处理婚恋话题，关注家庭生活的温暖细节',
    objective: '了解家庭生活',
    completionCriteria: ['用户愿意分享家庭', '有家庭生活细节'],
    tabooTopics: ['婚姻问题', '家庭矛盾'],
    recommendedTopics: ['恋爱经历', '婚姻', '子女', '家庭温暖'],
  },
  /** 访谈引擎阶段 ID，与 family 同义 */
  marriage_family: {
    phase: 'marriage_family',
    description: '婚恋与家庭生活',
    details: '谨慎处理婚恋话题，关注家庭生活的温暖细节',
    objective: '了解家庭生活',
    completionCriteria: ['用户愿意分享家庭', '有家庭生活细节'],
    tabooTopics: ['婚姻问题', '家庭矛盾'],
    recommendedTopics: ['恋爱经历', '婚姻', '子女', '家庭温暖'],
  },
  migration: {
    phase: 'migration',
    description: '迁徙与时代变化',
    details: '了解地理变迁，时代背景对个人的影响',
    objective: '了解迁徙经历和时代背景',
    completionCriteria: ['用户描述迁移经历', '时代背景'],
    tabooTopics: [],
    recommendedTopics: ['搬家经历', '城市变化', '时代记忆'],
  },
  /** 访谈引擎：友谊与社会关系，话题上与 migration 部分重叠 */
  friendship: {
    phase: 'friendship',
    description: '友谊与社会关系',
    details: '了解重要的人际关系、朋友与社会支持',
    objective: '了解社会关系与友谊',
    completionCriteria: ['用户提到朋友或社交', '有关系细节'],
    tabooTopics: [],
    recommendedTopics: ['老朋友', '邻居', '同事之外的情谊'],
  },
  challenges: {
    phase: 'challenges',
    description: '重大困难与转折',
    details: '极其敏感，需要非常小心，用户不愿意说不要勉强',
    objective: '了解人生困难时刻（需谨慎）',
    completionCriteria: [],
    tabooTopics: [],
    recommendedTopics: [], // 用户主动提及才问
  },
  /** 访谈引擎阶段 ID，与 challenges 同义 */
  hardship: {
    phase: 'hardship',
    description: '重大困难与转折',
    details: '极其敏感，需要非常小心，用户不愿意说不要勉强',
    objective: '了解人生困难时刻（需谨慎）',
    completionCriteria: [],
    tabooTopics: [],
    recommendedTopics: [],
  },
  proud_moments: {
    phase: 'proud_moments',
    description: '最骄傲的时刻',
    details: '让人感到自豪的经历，成就感',
    objective: '了解用户的自豪时刻',
    completionCriteria: ['用户分享成就', '有具体事件'],
    tabooTopics: [],
    recommendedTopics: ['最大成就', '最自豪的事', '人生高光时刻'],
  },
  reflections: {
    phase: 'reflections',
    description: '遗憾、和解、领悟',
    details: '人生感悟和智慧，与过去的和解',
    objective: '了解人生感悟',
    completionCriteria: ['用户分享感悟', '有人生智慧'],
    tabooTopics: [],
    recommendedTopics: ['人生感悟', '遗憾与和解', '想说的话'],
  },
  legacy: {
    phase: 'legacy',
    description: '想留给后人的话',
    details: '最想说的话，人生总结，对后辈的期望',
    objective: '收集留给后人的信息',
    completionCriteria: ['用户表达想说的话'],
    tabooTopics: [],
    recommendedTopics: ['留给后代的话', '人生总结', '期望'],
  },
};

/**
 * 获取阶段配置
 */
export function getPhaseConfig(phase: InterviewPhase): PhaseConfig {
  return PHASE_CONFIGS[phase] || PHASE_CONFIGS.ice_breaker;
}

/**
 * 获取所有阶段
 */
export function getAllPhases(): InterviewPhase[] {
  return Object.keys(PHASE_CONFIGS) as InterviewPhase[];
}

/**
 * 获取下一个阶段
 */
export function getNextPhase(current: InterviewPhase): InterviewPhase | null {
  const phases = getAllPhases();
  const currentIndex = phases.indexOf(current);

  if (currentIndex === -1 || currentIndex === phases.length - 1) {
    return null;
  }

  return phases[currentIndex + 1];
}

/**
 * 获取上一个阶段
 */
export function getPreviousPhase(current: InterviewPhase): InterviewPhase | null {
  const phases = getAllPhases();
  const currentIndex = phases.indexOf(current);

  if (currentIndex <= 0) {
    return null;
  }

  return phases[currentIndex - 1];
}

/**
 * 判断是否应该推进阶段（基于完成度）
 */
export function shouldAdvancePhase(
  currentPhase: InterviewPhase,
  messageCount: number,
  cardsExtracted: number,
  coveredCriteria: string[]
): PhaseAdvanceDecision {
  const config = getPhaseConfig(currentPhase);
  const criteriaCount = config.completionCriteria.length;

  // 如果没有完成标准，直接返回不推进
  if (criteriaCount === 0) {
    // 根据消息数判断
    if (messageCount >= 8) {
      const nextPhase = getNextPhase(currentPhase);
      if (nextPhase) {
        return {
          shouldAdvance: true,
          nextPhase,
          reason: '已完成足够对话',
          progress: 100,
        };
      }
    }
    return { shouldAdvance: false, progress: Math.min(100, (messageCount / 8) * 100) };
  }

  // 计算完成进度
  const completedCount = coveredCriteria.length;
  const progress = Math.round((completedCount / criteriaCount) * 100);

  // 达到 60% 进度且消息数足够时可以推进
  const shouldAdvance = progress >= 60 && messageCount >= 6;

  if (shouldAdvance) {
    const nextPhase = getNextPhase(currentPhase);
    return {
      shouldAdvance: true,
      nextPhase: nextPhase || undefined,
      reason: `已完成 ${progress}% 的阶段目标`,
      progress,
    };
  }

  return { shouldAdvance: false, progress };
}

/**
 * 获取阶段的敏感度
 */
export function getPhaseSensitivity(phase: InterviewPhase): number {
  const config = getPhaseConfig(phase);

  // challenges 和 hardship 阶段敏感度最高
  if (phase === 'challenges' || phase === 'hardship') return 4;

  // 根据 tabooTopics 数量判断
  return config.tabooTopics.length > 0 ? 2 : 1;
}
