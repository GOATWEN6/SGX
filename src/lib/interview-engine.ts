/**
 * AI 回忆录助手 - 访谈引擎
 * 
 * 基于叙事心理学（Narrative Psychology）与口述历史（Oral History）方法论
 * 参考：Reminiscence Bump Theory, Life Review Theory (Butler 1963),
 *       Autobiographical Memory Theory, Erikson's Psychosocial Stages
 */

import {
  ChatRequest,
  ChatResponse,
  Session,
  UserProfile,
} from '@/types';
import { callLLM, parseLLMResponse, fillSystemPrompt } from './llm';
import { logger } from './logger';

// ==================== 阶段定义 ====================

export type InterviewPhase =
  | 'ice_breaker'
  | 'basic_info'
  | 'childhood'
  | 'education'
  | 'career'
  | 'marriage_family'
  | 'hardship'
  | 'proud_moments'
  | 'friendship'
  | 'reflections'
  | 'legacy';

/** 阶段元数据 */
export interface PhaseMeta {
  id: InterviewPhase;
  /** 阶段名称 */
  name: string;
  /** 叙事心理学理论依据 */
  theory: string;
  /** 核心目标 */
  goal: string;
  /** 访谈心理学技巧 */
  technique: string;
  /** 该阶段特有的敏感话题警告 */
  sensitivityWarning?: string;
  /** 问题列表 */
  questions: PhaseQuestion[];
}

/** 单个问题 */
export interface PhaseQuestion {
  /** 问题文本 */
  text: string;
  /** 心理学类型 */
  psychologyType: PsychologyType;
  /** 叙事类型 */
  narrativeType: NarrativeType;
  /** 追问提示（触发条件） */
  followUpPrompts?: string[];
  /** 敏感度 1-5 */
  sensitivity?: number;
  /** 触发关键词 */
  triggerKeywords?: string[];
}

/** 叙事类型 */
export type NarrativeType =
  | 'episodic'      // 情景记忆（具体场景）
  | 'semantic'      // 语义记忆（知识/事实）
  | 'autobiographical' // 自传体记忆
  | 'emotional'     // 情感记忆
  | 'sensory'       // 感觉记忆
  | 'procedural'    // 程序性记忆
  | 'blank_retrospective' // 回溯性空白（待填充）

/** 心理学类型 */
export type PsychologyType =
  | 'reminiscence_bump'    // 记忆高峰（人生最鲜活时期）
  | 'life_review'          // 人生回顾（整合碎片）
  | 'identity_continuity'  // 自我同一性连续感
  | 'meaning_making'       // 意义建构
  | 'emotional_regulation' // 情绪调节
  | 'social_bonding'      // 社会联结
  | 'wisdom_integration'  // 智慧整合
  | 'grief_work'          // 哀伤处理
  | 'autobiographical_memory' // 自传体记忆激活
  | 'proud_self'          // 自豪感来源
  | 'regret_clarification' // 遗憾澄清
  | 'legacy_bequest'      // 遗产/传承意愿
  | 'relationship_anchoring' // 关系锚定
  | 'sensory_triggers'    // 感官触发
  | 'era_immersion';      // 时代沉浸

// ==================== 11 阶段详细定义 ====================

export const INTERVIEW_PHASES: PhaseMeta[] = [
  // ─────────────────────────────────────────────
  // 阶段 1: 破冰与信任建立
  // 理论：心理学首因效应、安全感建立、非威胁性开场
  // ─────────────────────────────────────────────
  {
    id: 'ice_breaker',
    name: '破冰与信任',
    theory: '首因效应 (Primacy Effect) + 罗杰斯安全感条件',
    goal: '让长者在轻松、无压力的氛围中开口，建立信任感与安全感',
    technique: '非侵入式提问 + 肯定式倾听 + 选择性重复',
    questions: [
      { text: '今天感觉怎么样？天气这么好，有没有出门走走？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['天气', '出去', '散步', '晒太阳'] },
      { text: '您平时喜欢做什么消磨时间？有没有什么特别的爱好？', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['爱好', '喜欢', '消磨'] },
      { text: '最近有没有梦到什么有趣的事？或者想起什么老早以前的事？', psychologyType: 'reminiscence_bump', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['梦', '想起', '以前'] },
      { text: '您最喜欢哪个季节？为什么呢？', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['季节', '喜欢'] },
      { text: '现在家里几口人住在一起？热不热闹？', psychologyType: 'social_bonding', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['家里', '住', '热闹', '儿女'] },
      { text: '现在日子过得惯吗？有什么不习惯的吗？', psychologyType: 'identity_continuity', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['习惯', '日子'] },
      { text: '您最喜欢吃的东西是什么？现在还常吃吗？', psychologyType: 'autobiographical_memory', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['吃', '喜欢', '菜'] },
      { text: '早上一般几点醒来？醒来第一件事做什么？', psychologyType: 'autobiographical_memory', narrativeType: 'procedural', sensitivity: 1, triggerKeywords: ['早上', '醒来', '习惯'] },
      { text: '最近有没有看什么电视剧或者新闻？哪个最吸引您？', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['电视', '新闻', '看'] },
      { text: '您这辈子吃过最好吃的东西是什么？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['好吃', '吃'] },
      { text: '如果让您给年轻人一条建议，您会说什么？', psychologyType: 'wisdom_integration', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['建议', '年轻人', '经验'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 2: 基本信息收集
  // 理论：语义记忆提取 + 自传体记忆激活
  // ─────────────────────────────────────────────
  {
    id: 'basic_info',
    name: '基本信息',
    theory: '语义记忆提取 (Semantic Memory) + 时间自我理论 (Temporal Self)',
    goal: '了解长者的人生基本坐标（出生时间、地点、时代背景）',
    technique: '自然嵌入对话 + 时间锚定 + 地点还原',
    questions: [
      { text: '您是哪一年出生的？我帮您算算，那是哪一年了', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['出生', '多大', '年纪'] },
      { text: '您是在哪里出生的？那地方现在变化大吗？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['出生', '地方', '哪里'] },
      { text: '您爸爸叫什么名字？他是做什么工作的？', psychologyType: 'relationship_anchoring', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['爸爸', '父亲', '名字', '工作'] },
      { text: '您妈妈呢？她是个什么样的人？', psychologyType: 'relationship_anchoring', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['妈妈', '母亲', '什么样'] },
      { text: '家里有几个兄弟姐妹？您排行老几？', psychologyType: 'social_bonding', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['兄弟', '姐妹', '排行'] },
      { text: '您小时候家里条件怎么样？是穷是富？', psychologyType: 'autobiographical_memory', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['条件', '穷', '富', '小时候'] },
      { text: '那时候家里住的是什么样的房子？还记得吗？', psychologyType: 'autobiographical_memory', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['房子', '住', '家里'] },
      { text: '您是几岁上的学？第一天上学是什么情形？', psychologyType: 'reminiscence_bump', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['上学', '读书', '学校'] },
      { text: '那时候村子或者街道叫什么名字？现在还有吗？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['村子', '街道', '名字'] },
      { text: '您还记得自己小时候的小名吗？谁给您起的？', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['小名', '起', '名字'] },
      { text: '那时候过年是什么光景？您印象最深的是哪一次？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['过年', '春节', '印象'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 3: 童年与家庭
  // 理论：记忆高峰理论 (Reminiscence Bump 10-30岁最清晰)
  // ─────────────────────────────────────────────
  {
    id: 'childhood',
    name: '童年与家庭',
    theory: 'Reminiscence Bump (记忆高峰) + 依恋理论 (Attachment Theory)',
    goal: '激活童年自传体记忆，挖掘家庭关系模式与早期情感记忆',
    technique: '感官触发法 + 人物关系图谱 + 情感温度探测',
    questions: [
      { text: '您最早的记忆是什么？还记得那时候您多大吗？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['最早', '记得', '小时候'] },
      { text: '您小时候跟谁最亲？为什么是那个人？', psychologyType: 'relationship_anchoring', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['最亲', '谁', '小时候'] },
      { text: '有没有一个味道或者声音，让您一下就想起小时候？', psychologyType: 'sensory_triggers', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['味道', '声音', '想起', '小时候'] },
      { text: '您爸妈管教您严不严？他们吵架吗？', psychologyType: 'relationship_anchoring', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['管教', '爸妈', '吵架', '父母'] },
      { text: '您小时候最怕什么？有没有被吓到过？', psychologyType: 'autobiographical_memory', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['怕', '害怕', '吓'] },
      { text: '小时候有没有挨过打？是因为什么事？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 3, triggerKeywords: ['打', '挨', '因为'] },
      { text: '您小时候最好的朋友是谁？现在还有联系吗？', psychologyType: 'social_bonding', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['朋友', '最好', '联系'] },
      { text: '那时候家里穷，最苦的时候是怎么过来的？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 2, triggerKeywords: ['苦', '穷', '过来'] },
      { text: '有没有哪一年出了件大事，让您一辈子都忘不了？', psychologyType: 'era_immersion', narrativeType: 'autobiographical', sensitivity: 3, triggerKeywords: ['大事', '忘不了', '那年'] },
      { text: '您小时候最喜欢玩什么游戏？现在还会吗？', psychologyType: 'reminiscence_bump', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['玩', '游戏', '小时候'] },
      { text: '过年过节的时候，家里是怎么过的？有没有特别难忘的？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['过年', '节日', '难忘'] },
      { text: '您爸您妈最大的遗憾是什么？您知道他们心愿吗？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 3, triggerKeywords: ['遗憾', '心愿', '爸妈'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 4: 求学与成长
  // 理论：成就动机理论 + 自我效能感
  // ─────────────────────────────────────────────
  {
    id: 'education',
    name: '学校与成长',
    theory: '自我效能理论 (Bandura) + 成就动机理论 (McClelland)',
    goal: '了解求学经历中的关键事件、挫折与成长',
    technique: '关键事件法 + 困难-成功对比 + 意义反思',
    questions: [
      { text: '您上学的时候最喜欢哪门课？为什么？', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['上学', '喜欢', '课'] },
      { text: '有没有一个老师让您印象特别深？为什么记得他/她？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['老师', '记得', '印象'] },
      { text: '有没有因为什么事让您不想读书了？后来怎么又想通了？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['读书', '不想', '学校'] },
      { text: '您读书的时候交到了什么好朋友吗？', psychologyType: 'social_bonding', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['朋友', '同学', '读书'] },
      { text: '那时候读书难不难？学费是怎么解决的？', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 2, triggerKeywords: ['学费', '难', '读书'] },
      { text: '有没有经历过停课、闹革命那段时间？您那时候在做什么？', psychologyType: 'era_immersion', narrativeType: 'autobiographical', sensitivity: 3, triggerKeywords: ['停课', '革命', '那时候'] },
      { text: '后来没读书了，您第一件想做的事是什么？', psychologyType: 'autobiographical_memory', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['没读书', '第一件', '想'] },
      { text: '读书那几年，有没有哪个时刻让您特别骄傲？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['骄傲', '骄傲', '最'] },
      { text: '您觉得读书对您后来的人生产生了什么影响？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['影响', '读书', '后来'] },
      { text: '那时候班里的同学，现在还记得谁？', psychologyType: 'reminiscence_bump', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['同学', '班里', '记得'] },
      { text: '您后来最高学历读到什么程度？那段经历给您留下了什么？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['学历', '程度', '经历'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 5: 工作与事业
  // 理论：职业认同理论 (Super) + 成就感理论
  // ─────────────────────────────────────────────
  {
    id: 'career',
    name: '工作与事业',
    theory: '职业发展阶段论 (Super) + 成就感理论',
    goal: '梳理职业生涯中的转折点、意义感与成就感',
    technique: '时间线重建法 + 成就感探测 + 转折点分析',
    questions: [
      { text: '您第一份工作是什么？那年您多大？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['工作', '第一份', '上班'] },
      { text: '还记得第一天上班的情形吗？是什么感觉？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['第一天', '上班', '感觉'] },
      { text: '您这份工作是怎么找到的？是分配的还是自己找的？', psychologyType: 'era_immersion', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['找到', '分配', '工作'] },
      { text: '工作这么多年，有没有遇到特别难的时候？怎么熬过来的？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 2, triggerKeywords: ['难', '辛苦', '熬'] },
      { text: '有没有哪一年您觉得自己做了一件特别牛的事？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['牛', '骄傲', '成功'] },
      { text: '您的同事或者搭档里，有没有对您影响特别大的人？', psychologyType: 'relationship_anchoring', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['同事', '搭档', '影响'] },
      { text: '工作里有没有碰到过不公正的事？您怎么处理的？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 2, triggerKeywords: ['不公正', '委屈', '处理'] },
      { text: '您觉得自己这辈子干得最漂亮的一件事是什么？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['漂亮', '最', '工作'] },
      { text: '工作和家庭您是怎么平衡的？有没有取舍？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['平衡', '家庭', '工作'] },
      { text: '退休那天是什么感觉？是解脱还是失落？', psychologyType: 'emotional_regulation', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['退休', '解脱', '失落'] },
      { text: '您这辈子有没有想过换一种活法？', psychologyType: 'regret_clarification', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['换', '活法', '想过'] },
      { text: '您的工资从最开始的多少，后来涨到多少？那个变化您还记得吗？', psychologyType: 'autobiographical_memory', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['工资', '涨', '钱'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 6: 婚恋与家庭
  // 理论：依恋理论 (Bowlby) + 家庭生命周期理论
  // ─────────────────────────────────────────────
  {
    id: 'marriage_family',
    name: '婚恋与家庭',
    theory: '依恋理论 (Bowlby) + 家庭生命周期理论 + 叙事身份认同',
    goal: '梳理婚姻关系与家庭建设的情感历程',
    technique: '关系叙事法 + 情感温度探测 + 选择意义澄清',
    questions: [
      { text: '您和老伴是怎么认识的？还记得第一次见面吗？', psychologyType: 'reminiscence_bump', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['认识', '老伴', '第一次'] },
      { text: '你们谈恋爱的时候，约会都做什么？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['约会', '恋爱', '那时候'] },
      { text: '您老伴身上什么品质最吸引您？这么多年了您觉得变了吗？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['吸引', '老伴', '品质'] },
      { text: '结婚那天您还记得什么？您当时什么心情？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['结婚', '那天', '心情'] },
      { text: '您和老伴有吵过架吗？吵得最凶的一次是因为什么？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 2, triggerKeywords: ['吵架', '吵', '老伴'] },
      { text: '有了孩子之后，生活最大的变化是什么？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['孩子', '变化', '有了'] },
      { text: '您还记得孩子出生的那一刻吗？您在想什么？', psychologyType: 'reminiscence_bump', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['出生', '孩子', '那一刻'] },
      { text: '您是怎么样把孩子们拉扯大的？有没有特别难的时候？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 2, triggerKeywords: ['拉扯', '孩子', '难'] },
      { text: '您觉得这辈子作为父亲/母亲，您做得最好的地方是什么？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['父亲', '母亲', '最好'] },
      { text: '有没有哪个孩子让您特别操心？后来怎么样了？', psychologyType: 'autobiographical_memory', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['操心', '孩子', '操心'] },
      { text: '家里这么多人，您用什么办法让大家和和睦睦的？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['和睦', '家里', '方法'] },
      { text: '如果让您重来一次婚姻，您会做什么不同的选择吗？', psychologyType: 'regret_clarification', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['重来', '选择', '婚姻'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 7: 困难与挫折
  // 理论：创伤后成长理论 (Tedeschi & Calhoun) + 哀伤辅导
  // 警告：此阶段极度敏感，必须温和探测，不强迫
  // ─────────────────────────────────────────────
  {
    id: 'hardship',
    name: '困难与转折',
    theory: '创伤后成长理论 (Post-Traumatic Growth) + 意义重构',
    goal: '在安全前提下，梳理人生中的重大挫折与从中获得的力量',
    technique: '安全感优先 + 创伤后成长视角 + 不强迫原则',
    sensitivityWarning: '涉及丧亲、疾病、经济困难等敏感话题，若用户不愿说立即转移',
    questions: [
      { text: '人生总有些不容易的时候，您觉得最难熬的是哪一段？', psychologyType: 'autobiographical_memory', narrativeType: 'emotional', sensitivity: 3, triggerKeywords: ['难熬', '最难', '不容易'] },
      { text: '有没有失去过至亲？那段日子是怎么过来的？', psychologyType: 'grief_work', narrativeType: 'autobiographical', sensitivity: 4, triggerKeywords: ['失去', '去世', '离开', '没了'] },
      { text: '有没有生过大病？生病那会儿是什么心情？', psychologyType: 'emotional_regulation', narrativeType: 'emotional', sensitivity: 3, triggerKeywords: ['生病', '大病', '住院'] },
      { text: '有没有欠过债或者缺过钱？那种日子是什么滋味？', psychologyType: 'autobiographical_memory', narrativeType: 'emotional', sensitivity: 3, triggerKeywords: ['欠债', '缺钱', '穷'] },
      { text: '有没有被人冤枉过或者受委屈过？您怎么咽下这口气的？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 3, triggerKeywords: ['冤枉', '委屈', '受委屈'] },
      { text: '有没有想过放弃？后来是什么让您坚持下来了？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 3, triggerKeywords: ['放弃', '坚持', '撑'] },
      { text: '经历了那些难事后，您觉得自己变了吗？变成了什么样？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['变了', '经历', '难'] },
      { text: '有没有哪个朋友在那段最苦的日子里帮过您？', psychologyType: 'social_bonding', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['朋友', '帮忙', '苦'] },
      { text: '您觉得那些苦难对您来说有没有意义？是什么意义？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['意义', '苦难', '值得'] },
      { text: '如果现在的年轻人遇到和您一样的困难，您会怎么劝他们？', psychologyType: 'wisdom_integration', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['劝', '年轻人', '困难'] },
      { text: '最难过的时候，有没有一句话支撑着您？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 3, triggerKeywords: ['支撑', '话', '信念'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 8: 最骄傲的时刻
  // 理论：自豪感理论 (Tracy & Robbins) + 积极心理学
  // ─────────────────────────────────────────────
  {
    id: 'proud_moments',
    name: '骄傲时刻',
    theory: '自豪感理论 (Tracy & Robbins) + 积极自我理论',
    goal: '挖掘长者的成就感来源，强化积极的自我叙事',
    technique: '成就感探测 + 荣誉事件还原 + 情感确认',
    questions: [
      { text: '您这辈子最骄傲的事情是什么？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['骄傲', '最'] },
      { text: '有没有得过什么奖状或者荣誉？现在还留着吗？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['奖', '荣誉', '证书'] },
      { text: '有没有人当面对您说过"谢谢您"？您还记得吗？', psychologyType: 'autobiographical_memory', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['谢谢', '感谢', '说过'] },
      { text: '您亲手做过的最值得骄傲的一件事是什么？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['亲手', '做', '骄傲'] },
      { text: '有没有一件您做的东西，到现在还有人用？', psychologyType: 'legacy_bequest', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['用', '做', '东西'] },
      { text: '您的孩子或者晚辈，有没有让您特别骄傲的？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['骄傲', '孩子', '晚辈'] },
      { text: '有没有一句话，是您最想让人记住的？', psychologyType: 'legacy_bequest', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['记住', '话', '留下'] },
      { text: '有没有一张照片，是您最珍爱的？为什么？', psychologyType: 'autobiographical_memory', narrativeType: 'sensory', sensitivity: 1, triggerKeywords: ['照片', '珍爱', '喜欢'] },
      { text: '您觉得自己这辈子值不值？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['值', '值得', '这辈子'] },
      { text: '有没有什么时候，您觉得自己这辈子没白活？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['白活', '没白', '值'] },
      { text: '您觉得自己这辈子做对的最重要的一件事是什么？', psychologyType: 'proud_self', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['对', '最重要', '选择'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 9: 友情与社交
  // 理论：社会支持理论 + 依恋理论的友谊延伸
  // ─────────────────────────────────────────────
  {
    id: 'friendship',
    name: '友情与社交',
    theory: '社会支持理论 (Cohen & Wills) + 友谊发展阶段论',
    goal: '梳理人生中的重要友谊与社会联结',
    technique: '关系网络探测 + 关键朋友还原 + 友谊意义探询',
    questions: [
      { text: '您这辈子有没有一个最要好的朋友？您们是怎么认识的？', psychologyType: 'social_bonding', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['朋友', '最好', '认识'] },
      { text: '朋友里有没有谁让您特别感激？为什么？', psychologyType: 'social_bonding', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['感激', '朋友', '谢谢'] },
      { text: '有没有一个朋友已经不在了？您还记得他/她吗？', psychologyType: 'grief_work', narrativeType: 'autobiographical', sensitivity: 3, triggerKeywords: ['朋友', '不在', '走了'] },
      { text: '您觉得朋友最重要的是什么？忠诚？义气？还是别的？', psychologyType: 'meaning_making', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['朋友', '重要', '什么'] },
      { text: '有没有一起吃过苦、一起扛过来的朋友？', psychologyType: 'social_bonding', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['吃苦', '一起', '扛'] },
      { text: '您和朋友在一起最喜欢做什么？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 1, triggerKeywords: ['朋友', '一起', '做'] },
      { text: '有没有跟朋友闹过矛盾？后来是怎么和好的？', psychologyType: 'autobiographical_memory', narrativeType: 'episodic', sensitivity: 2, triggerKeywords: ['矛盾', '吵架', '和好'] },
      { text: '您觉得这辈子交过几个真心的朋友？够不够？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['真心', '朋友', '几个'] },
      { text: '有没有哪个朋友的做法您特别不认同？为什么？', psychologyType: 'meaning_making', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['不认同', '朋友', '做法'] },
      { text: '您的朋友圈子，这些年有什么变化？', psychologyType: 'identity_continuity', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['变化', '朋友', '圈子'] },
      { text: '您觉得人老了，还需要朋友吗？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['朋友', '老了', '需要'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 10: 人生感悟与和解
  // 理论：埃里克森心理社会发展理论（最后阶段：自我整合 vs 绝望）
  //       叙事治疗理论（重写人生故事）
  // ─────────────────────────────────────────────
  {
    id: 'reflections',
    name: '感悟与和解',
    theory: "埃里克森心理社会发展论（第8阶段：自我整合 vs 绝望）+ 叙事治疗",
    goal: '帮助长者整合人生经历，与过去和解，达到自我接纳',
    technique: '叙事重构法 + 遗憾澄清 + 意义整合',
    questions: [
      { text: '您觉得这辈子活得怎么样？满意吗？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['满意', '怎么样', '活'] },
      { text: '有没有什么事是您这辈子最遗憾的？', psychologyType: 'regret_clarification', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['遗憾', '后悔', '可惜'] },
      { text: '如果能回到过去，您最想改变什么？', psychologyType: 'regret_clarification', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['改变', '回到', '如果'] },
      { text: '您觉得人生中最重要的是什么？钱？亲情？健康？还是别的？', psychologyType: 'meaning_making', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['重要', '人生', '什么'] },
      { text: '有没有哪件事让您彻底想通了，不再纠结了？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['想通', '不纠结', '和解'] },
      { text: '您这辈子最对不起的人是谁？有没有想对他/她说什么？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 3, triggerKeywords: ['对不起', '对不起谁', '想说什么'] },
      { text: '您有没有原谅不了的人？您是怎么处理的？', psychologyType: 'emotional_regulation', narrativeType: 'autobiographical', sensitivity: 3, triggerKeywords: ['原谅', '恨', '放不下'] },
      { text: '您觉得一个人这辈子活得好不好，标准是什么？', psychologyType: 'wisdom_integration', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['标准', '活得好', '衡量'] },
      { text: '您觉得什么是幸福？您这辈子幸福吗？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['幸福', '什么是', '这辈子'] },
      { text: '您这辈子最想感谢的人是谁？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['感谢', '最想', '谁'] },
      { text: '您觉得人应该怎么活才算不白活？', psychologyType: 'wisdom_integration', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['白活', '活法', '应该'] },
      { text: '您这辈子最宝贵的经验是什么？', psychologyType: 'wisdom_integration', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['经验', '宝贵', '最重要'] },
    ],
  },

  // ─────────────────────────────────────────────
  // 阶段 11: 留给后人的话
  // 理论：遗产理论 (Legacy Theory) +  generativity (Erikson)
  // ─────────────────────────────────────────────
  {
    id: 'legacy',
    name: '留给后人的话',
    theory: '代际传承理论 (Generativity, Erikson) + 遗产叙事',
    goal: '让长者感受到人生经验的可传承性，留下精神财富',
    technique: '仪式感提问 + 传承意识激活 + 最后一封信',
    questions: [
      { text: '您最想跟您的孩子说的一句话是什么？', psychologyType: 'legacy_bequest', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['孩子', '说', '句话'] },
      { text: '您希望您的孩子记住您什么？', psychologyType: 'legacy_bequest', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['记住', '孩子', '希望'] },
      { text: '您这辈子积累的人生经验，最想传给谁？', psychologyType: 'legacy_bequest', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['传给', '经验', '留下'] },
      { text: '您觉得您给孩子最大的财富是什么？钱还是别的？', psychologyType: 'legacy_bequest', narrativeType: 'autobiographical', sensitivity: 2, triggerKeywords: ['财富', '孩子', '最大'] },
      { text: '如果让您给10年后的自己写封信，您会写什么？', psychologyType: 'legacy_bequest', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['10年', '自己', '信'] },
      { text: '您希望后人怎么评价您这一生？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['评价', '后人', '一生'] },
      { text: '您觉得您的经历，对现在的年轻人有什么启发？', psychologyType: 'wisdom_integration', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['启发', '年轻人', '经历'] },
      { text: '如果让您给还没出生的孙子孙女留一段话，您想说什么？', psychologyType: 'legacy_bequest', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['孙子', '留', '话'] },
      { text: '您觉得什么是家？什么是家风？您家里传下来什么规矩？', psychologyType: 'legacy_bequest', narrativeType: 'semantic', sensitivity: 1, triggerKeywords: ['家风', '规矩', '家'] },
      { text: '有没有想过，您的故事应该被记录下来？', psychologyType: 'legacy_bequest', narrativeType: 'emotional', sensitivity: 1, triggerKeywords: ['记录', '故事', '留下'] },
      { text: '您希望您的后代知道您年轻时候的什么故事？', psychologyType: 'legacy_bequest', narrativeType: 'autobiographical', sensitivity: 1, triggerKeywords: ['后代', '知道', '故事'] },
      { text: '如果让您给自己的生活写一个墓志铭，您会写什么？', psychologyType: 'meaning_making', narrativeType: 'emotional', sensitivity: 2, triggerKeywords: ['墓志铭', '写', '自己'] },
    ],
  },
];

// ==================== 阶段顺序 & 转换 ====================

export const PHASE_ORDER: InterviewPhase[] = [
  'ice_breaker',
  'basic_info',
  'childhood',
  'education',
  'career',
  'marriage_family',
  'hardship',
  'proud_moments',
  'friendship',
  'reflections',
  'legacy',
];

/** 获取阶段元数据 */
export function getPhaseMeta(phase: InterviewPhase): PhaseMeta {
  return INTERVIEW_PHASES.find(p => p.id === phase) || INTERVIEW_PHASES[0];
}

/** 获取阶段显示信息 */
export function getPhaseDescription(phase: string): { description: string; details: string } {
  const meta = getPhaseMeta(phase as InterviewPhase);
  return {
    description: meta.name,
    details: `${meta.theory}\n目标: ${meta.goal}\n技巧: ${meta.technique}${meta.sensitivityWarning ? `\n⚠️ ${meta.sensitivityWarning}` : ''}`,
  };
}

/** 获取阶段进度信息 */
export function getPhaseProgress(currentPhase: InterviewPhase): {
  currentIndex: number;
  totalPhases: number;
  phaseName: string;
  progress: string;
} {
  const index = PHASE_ORDER.indexOf(currentPhase);
  return {
    currentIndex: index,
    totalPhases: PHASE_ORDER.length,
    phaseName: getPhaseMeta(currentPhase).name,
    progress: `${index + 1}/${PHASE_ORDER.length}`,
  };
}

/** 检查是否应推进到下一阶段 */
export function shouldProgressToNextPhase(params: {
  currentPhase: InterviewPhase;
  messageCount: number;
  cardsExtracted: number;
  coveredTopics: string[];
}): { shouldAdvance: boolean; nextPhase?: InterviewPhase; reason: string } {
  const { currentPhase, messageCount, cardsExtracted } = params;
  const meta = getPhaseMeta(currentPhase);
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const lastPhase = currentIndex === PHASE_ORDER.length - 1;

  // 阶段推进规则：
  // 1. 至少对话 N 轮（每阶段至少 3 轮）
  // 2. 提取到至少 1 个记忆卡片
  const minRounds = 3;

  if (lastPhase) {
    return { shouldAdvance: false, reason: '已到最后阶段' };
  }

  if (messageCount >= minRounds && cardsExtracted >= 1) {
    const nextPhase = PHASE_ORDER[currentIndex + 1];
    return {
      shouldAdvance: true,
      nextPhase,
      reason: `已完成 "${meta.name}" 阶段（${messageCount} 轮对话，${cardsExtracted} 个记忆卡片）`,
    };
  }

  if (messageCount >= minRounds * 2) {
    // 超过轮数上限，强制推进
    const nextPhase = PHASE_ORDER[currentIndex + 1];
    return {
      shouldAdvance: true,
      nextPhase,
      reason: '对话轮数已足够，推进到下一阶段',
    };
  }

  return {
    shouldAdvance: false,
    reason: `还需继续收集（当前 ${messageCount} 轮，目标 ${minRounds}+ 轮，${cardsExtracted} 个卡片）`,
  };
}

// ==================== 访谈状态追踪 ====================

/** 会话内的访谈状态 */
export interface InterviewState {
  currentPhase: InterviewPhase;
  currentQuestionIndex: number; // 当前阶段的第几个问题（0-based）
  phaseMessageCount: number;    // 当前阶段的对话轮数
  totalMessageCount: number;    // 总对话轮数
  visitedPhases: InterviewPhase[];
  collectedKeywords: string[];
  detectedSensitive: boolean;
}

/** 初始化访谈状态 */
export function createInitialInterviewState(): InterviewState {
  return {
    currentPhase: 'ice_breaker',
    currentQuestionIndex: 0,
    phaseMessageCount: 0,
    totalMessageCount: 0,
    visitedPhases: ['ice_breaker'],
    collectedKeywords: [],
    detectedSensitive: false,
  };
}

/** 根据用户消息中的关键词，优先选择相关问题 */
function selectBestQuestion(
  meta: PhaseMeta,
  userMessage: string,
  currentIndex: number,
  keywords: string[]
): number {
  const text = userMessage.toLowerCase();

  // 优先匹配敏感词/触发词
  for (let i = 0; i < meta.questions.length; i++) {
    if (i === currentIndex) continue;
    const q = meta.questions[i];
    if (q.triggerKeywords?.some(k => text.includes(k.toLowerCase()))) {
      return i;
    }
  }

  // 正常轮转
  return (currentIndex + 1) % meta.questions.length;
}

/** 检查消息是否触发了敏感话题 */
function detectSensitiveContent(
  message: string,
  sensitivityThreshold: number = 3
): { triggered: boolean; topics: string[] } {
  const sensitivePatterns: Record<string, string[]> = {
    '去世/丧亲': ['去世', '走了', '没了', '离开', '死亡', '过世', '逝世', '走了'],
    '疾病/健康': ['生病', '住院', '手术', '得了', '病', '癌', '医院'],
    '经济困难': ['欠债', '没钱', '穷', '困难', '吃不起', '揭不开锅'],
    '委屈/不公': ['冤枉', '委屈', '不公平', '受欺负', '欺负'],
    '争吵/冲突': ['吵架', '打架', '闹', '矛盾', '不合'],
  };

  const topics: string[] = [];
  for (const [topic, patterns] of Object.entries(sensitivePatterns)) {
    if (patterns.some(p => message.includes(p))) {
      topics.push(topic);
    }
  }

  return { triggered: topics.length > 0, topics };
}

/** 构建带当前轮次和阶段信息的 prompt */
export function buildInterviewPrompt(params: {
  state: InterviewState;
  userProfile: UserProfile;
  latestUserMessage: string;
  sessionHistory: string;
}): string {
  const { state, userProfile, latestUserMessage, sessionHistory } = params;
  const meta = getPhaseMeta(state.currentPhase);
  const honorific = userProfile.useHonorific ? '您' : '你';

  // 当前问题的心理学标签
  const currentQ = meta.questions[state.currentQuestionIndex];
  const qInfo = currentQ
    ? `[心理学: ${currentQ.psychologyType} | 叙事类型: ${currentQ.narrativeType}]`
    : '';

  const prompt = `
# 访谈阶段信息
- 当前阶段: ${meta.name} (${state.currentPhase})
- 阶段进度: 第 ${state.phaseMessageCount + 1} 轮（共需 3+ 轮）
- 阶段内问题索引: ${state.currentQuestionIndex + 1}/${meta.questions.length}
- 整体进度: ${state.totalMessageCount + 1} 轮
${qInfo}

# 阶段理论背景
- 理论依据: ${meta.theory}
- 阶段目标: ${meta.goal}
- 访谈技巧: ${meta.technique}
${meta.sensitivityWarning ? `- ⚠️ 敏感警告: ${meta.sensitivityWarning}` : ''}

# 当前阶段可用问题（共 ${meta.questions.length} 个）
${meta.questions.map((q, i) => `  ${i + 1}. [${q.psychologyType}] ${q.text}${q.sensitivity && q.sensitivity >= 3 ? ' ⚠️' : ''}`).join('\n')}

# 用户最新回答
${latestUserMessage}

# 对话历史（最近 6 轮）
${sessionHistory || '（暂无）'}

# 已收集关键词
${state.collectedKeywords.length > 0 ? state.collectedKeywords.join(', ') : '暂无'}

# 任务要求
1. 以温暖、专业的口吻对用户的最新回答作出回应
2. 结合当前阶段目标，选择最合适的问题（优先从上述问题列表中选择，也可以自然引申）
3. 如果用户触发了敏感话题（第 ${state.phaseMessageCount + 1} 轮），先共情，再温和提问
4. ${honorific}还没回答的问题不要跳过，每次只问一个问题
5. 本轮问题索引 ${state.currentQuestionIndex + 1}，请推进到 ${(state.currentQuestionIndex + 1) % meta.questions.length + 1} 号问题，或根据用户回答选择最相关的问题
6. 识别用户回答中的情感基调，给予恰当回应
`;

  return prompt;
}

// ==================== 核心处理函数 ====================

/**
 * 处理聊天消息，驱动访谈引擎
 */
export async function processChatMessage(
  request: ChatRequest,
  session: Session,
  userProfile: UserProfile,
  sessionHistory: string,
  interviewState: InterviewState
): Promise<{
  response: ChatResponse;
  updatedState: InterviewState;
}> {
  // 构建 prompt
  const meta = getPhaseMeta(interviewState.currentPhase);
  const honorific = userProfile.useHonorific ? '您' : '你';

  const userPrompt = buildInterviewPrompt({
    state: interviewState,
    userProfile,
    latestUserMessage: request.message,
    sessionHistory,
  });

  const systemPrompt = fillSystemPrompt(userProfile);

  // 调用 LLM
  const response = await callLLM(systemPrompt, userPrompt, {
    temperature: 0.8,
    maxTokens: 1024,
  });

  // 解析响应
  const parsed = parseLLMResponse<{
    message?: string;
    nextQuestion?: string;
    shouldFollowUp?: boolean;
    detectedTopics?: string[];
    suggestedCards?: any[];
    sessionSummary?: string;
    emotionalAnalysis?: {
      overall?: string;
      detectedEmotions?: string[];
      intensity?: string;
    };
    advanceToNextPhase?: boolean;
    advanceReason?: string;
  }>(response, {});

  // 敏感内容检测
  const sensitiveResult = detectSensitiveContent(request.message);

  // 选择下一个问题索引
  const nextQuestionIndex = selectBestQuestion(
    meta,
    request.message,
    interviewState.currentQuestionIndex,
    interviewState.collectedKeywords
  );

  // 更新访谈状态
  const updatedState: InterviewState = {
    currentPhase: interviewState.currentPhase,
    currentQuestionIndex: nextQuestionIndex,
    phaseMessageCount: interviewState.phaseMessageCount + 1,
    totalMessageCount: interviewState.totalMessageCount + 1,
    visitedPhases: interviewState.visitedPhases,
    collectedKeywords: [
      ...interviewState.collectedKeywords,
      ...(parsed.detectedTopics || []),
    ],
    detectedSensitive: interviewState.detectedSensitive || sensitiveResult.triggered,
  };

  const response_: ChatResponse = {
    message: parsed.message || response,
    nextQuestion: parsed.nextQuestion,
    shouldFollowUp: parsed.shouldFollowUp || false,
    suggestedTopics: parsed.detectedTopics || [],
    detectedCards: parsed.suggestedCards || [],
    sessionSummary: parsed.sessionSummary,
    emotionAnalysis: parsed.emotionalAnalysis,
  };

  return { response: response_, updatedState };
}

/**
 * 检查是否需要推进到下一阶段
 */
export function checkPhaseAdvance(state: InterviewState): {
  shouldAdvance: boolean;
  nextPhase?: InterviewPhase;
  reason: string;
} {
  return shouldProgressToNextPhase({
    currentPhase: state.currentPhase,
    messageCount: state.phaseMessageCount,
    cardsExtracted: state.collectedKeywords.length,
    coveredTopics: state.collectedKeywords,
  });
}
