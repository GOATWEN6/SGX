# AI 回忆录助手 - 架构说明文档

## 一、项目概述

**ai-memoir-assistant** 是一款面向老年用户的 AI 回忆录助手，专注于通过温和、专业的多轮访谈引导老人讲述人生故事，并将其转化为结构化的回忆录。

### 核心特性
- 多轮访谈引擎
- 记忆结构化提取
- 多风格回忆录生成
- 双 AI 评审与重写闭环
- 多 LLM Provider 兼容

---

## 二、一级目录结构

```
ai-memoir-assistant/
├── src/                    # 核心业务源码
├── data/                   # 运行时数据存储（JSON 文件）
├── .next/                  # Next.js 构建产物（自动生成）
├── node_modules/           # 依赖包（自动生成）
├── 根配置文件              # package.json, tsconfig.json, next.config.js 等
```

| 目录/文件 | 职责 | 说明 |
|-----------|------|------|
| `src/` | 核心业务代码 | 包含所有业务逻辑、API、组件 |
| `data/` | 运行时存储 | JSON 文件存储用户数据、会话、记忆卡片等 |
| `.next/` | 构建产物 | Next.js 编译输出，不应作为重构重点 |
| `node_modules/` | 依赖目录 | npm 包，不应手动修改 |
| 根配置文件 | 项目配置 | package.json, tsconfig.json, next.config.js, .env 等 |

---

## 三、二级目录结构

### 3.1 `src/app/` - Next.js 应用层

```
src/app/
├── api/                    # API 路由
│   ├── chat/               # 对话访谈 API
│   ├── memoir/             # 回忆录生成 API
│   ├── review/             # 评审与重写 API
│   ├── user/               # 用户管理 API
│   ├── episodes/           # 记忆片段 API（本轮重构新增）
│   ├── chapters/           # 章节 API（本轮重构新增）
│   ├── book-projects/      # 回忆录项目 API（本轮重构新增）
│   └── family/             # 家庭协作 API（本轮重构新增）
├── globals.css             # 全局样式
├── layout.tsx              # 根布局
├── page.tsx                # 主页面
└── page.module.css         # 页面样式模块
```

**职责**：
- 处理 HTTP 请求/响应
- 路由分发
- 前端页面渲染

**业务核心**：`src/app/api/` 下的路由是业务入口点

### 3.2 `src/lib/` - 核心库

```
src/lib/
├── db.ts                   # 数据库操作（JSON 文件存储）
├── llm.ts                  # LLM 调用封装
├── llm/                    # 多 Provider 兼容层（新增）
│   ├── index.ts
│   ├── client.ts
│   ├── provider-registry.ts
│   ├── provider-types.ts
│   └── providers/
│       ├── openai-compatible.ts
│       ├── siliconflow.ts
│       ├── volcengine.ts
│       ├── qwen.ts
│       └── zhipu.ts
├── interview-engine/       # 访谈引擎（新增）
│   ├── index.ts
│   ├── phase-manager.ts
│   ├── topic-ranker.ts
│   └── follow-up-decider.ts
└── memory-extractor/       # 记忆提取器（新增）
    ├── index.ts
    ├── card-builder.ts
    └── quote-extractor.ts
```

**职责**：
- `db.ts` - 数据持久化
- `llm.ts` - LLM 调用（将被重构为 llm/ 目录）
- `llm/` - 多 Provider 兼容架构
- `interview-engine/` - 访谈逻辑控制
- `memory-extractor/` - 从对话中提取结构化记忆

### 3.3 `src/prompts/` - Prompt 模板

```
src/prompts/
├── system.md               # 系统级 prompt
├── interviewer.md          # 访谈师 prompt
├── memoir-writer.md       # 回忆录写作 prompt
├── critic.md               # 评审者 prompt
├── rewriter.md             # 重写者 prompt（新增）
└── summarizer.md           # 总结 prompt
```

**职责**：定义 AI 行为规范，是产品能力的重要组成部分

### 3.4 `src/types/` - 类型定义

```
src/types/
└── index.ts                # 核心类型定义
```

**职责**：TypeScript 类型声明

### 3.5 `src/data/` - 静态数据配置

```
src/data/
├── styles.json             # 文风配置
└── topics.json            # 话题库
```

**职责**：可配置的静态数据

---

## 四、三级目录结构

### 4.1 `src/app/api/chat/` - 对话访谈 API

**文件**: `route.ts`

**职责**：
- 处理用户消息发送
- 创建/结束会话
- 调用访谈引擎
- 保存消息和提取的记忆卡片

**协作**：
- 调用 `lib/db.ts` 存取数据
- 调用 `lib/interview-engine/` 进行访谈控制
- 调用 `lib/llm/` 生成响应

### 4.2 `src/app/api/memoir/` - 回忆录生成 API

**文件**: `route.ts`

**职责**：
- 生成回忆录草稿
- 管理草稿列表
- 读取/更新草稿

**协作**：
- 调用 `lib/db.ts` 存取数据
- 调用 `lib/llm/` 生成内容

### 4.3 `src/app/api/review/` - 评审与重写 API

**文件**: `route.ts`

**职责**：
- 评审回忆录草稿
- 执行重写
- 管理评审轮次

**协作**：
- 调用 `lib/db.ts` 存取数据
- 调用 `lib/llm/` 进行评审和重写

### 4.4 `src/app/api/user/` - 用户管理 API

**文件**: `route.ts`

**职责**：
- 创建用户
- 获取用户信息
- 更新用户设置

**协作**：
- 调用 `lib/db.ts` 存取数据

---

## 五、模块协作关系

```
┌─────────────────────────────────────────────────────────────┐
│                      前端页面 (src/app/)                     │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP
┌──────────────────────────▼──────────────────────────────────┐
│                    API Routes                                 │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│   │ chat/    │ │ memoir/  │ │ review/  │ │ user/    │     │
│   └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘     │
└────────┼────────────┼────────────┼────────────┼────────────┘
         │            │            │            │
         ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Core Libraries (src/lib/)               │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   db.ts     │  │ llm/          │  │ interview-      │  │
│  │  (存储层)   │  │ (多Provider)  │  │ engine/         │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
│                                                              │
│  ┌─────────────────┐  ┌────────────────────────────────┐  │
│  │ memory-         │  │ prompts/                       │  │
│  │ extractor/      │  │ (Prompt模板)                    │  │
│  └─────────────────┘  └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Storage (data/)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │users.json│ │sessions  │ │messages  │ │memory-   │   │
│  │          │ │.json     │ │.json     │ │cards.json│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│  ┌──────────┐ ┌──────────┐                               │
│  │drafts   │ │files.json│                               │
│  │.json    │ │          │                               │
│  └──────────┘ └──────────┘                               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                 LLM Providers (External)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │Silicon   │ │OpenAI    │ │VolcEngine│ │Qwen/     │     │
│  │Flow      │ │Official  │ │          │ │Zhipu     │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、核心业务模块说明

### 6.1 访谈引擎 (`lib/interview-engine/`)

**职责**：控制访谈流程，包括：
- 阶段管理（phase management）
- 话题排序（topic ranking）
- 追问决策（follow-up decision）
- 敏感话题处理
- **本轮重构**：phase 改为完成度驱动

**核心接口**：
```typescript
interface InterviewEngine {
  getPhaseConfig(phase: InterviewPhase): PhaseConfig;
  buildInterviewContext(userId: string, sessionId: string): InterviewContext;
  rankTopics(context: InterviewContext): RankedTopic[];
  decideFollowUp(userMessage: string, context: InterviewContext): FollowUpDecision;
  shouldAdvancePhase(context: InterviewContext): { shouldAdvance: boolean; reason?: string };
}
```

### 6.2 记忆提取器 (`lib/memory-extractor/`)

**职责**：从用户对话中提取结构化记忆

**核心接口**：
```typescript
interface MemoryExtractor {
  extractFromMessage(
    message: string,
    context: ExtractionContext
  ): ExtractedCards;
  
  extractQuotes(message: string): QuoteSnippet[];
  extractPersons(message: string): Partial<PersonCard>[];
  extractEvents(message: string): Partial<EventCard>[];
  extractUncertainFacts(message: string, reasoning: string): Partial<UncertainFact>[];
}
```

### 6.3 多 Provider 兼容层 (`lib/llm/`)

**职责**：统一 LLM 调用接口，支持多平台切换

**本轮重构**：统一使用 provider-registry 架构

**核心接口**：
```typescript
interface LLMProvider {
  call(request: LLMRequest): Promise<LLMResponse>;
  getProviderName(): string;
}

interface ProviderRegistry {
  getProvider(config: LLMProviderConfig): LLMProvider;
  listProviders(): string[];
}
```

### 6.4 核心数据类型（本轮重构新增）

**Episode（记忆片段）**：一个完整的记忆主题单元
- 关联多个 Session
- 关联多个 MemoryCard
- 可生成 ArticleDraft

**ArticleDraft（文章草稿）**：围绕 Episode 生成的文章
- 关联 Episode 和 Chapter
- 支持多版本和评审

**Chapter（章节）**：按人生阶段或主题组织
- 包含多个 ArticleDraft
- 属于 BookProject

**BookProject（回忆录项目）**：最终成书项目
- 包含多个 Chapter
- 统一的风格和目标

### 6.5 家庭协作系统（本轮重构新增）

**FamilyMember（家庭成员）**：
- elder: 老人（项目所有者）
- family_editor: 家属编辑者
- family_viewer: 家属查看者
- owner: 管理员

**核心约束**：
- 家属不可删除老人原始表达
- 家属不可覆盖老人已确认内容
- 所有操作保留版本历史

---

## 七、运行时数据说明

### 7.1 `data/` 目录

| 文件 | 用途 |
|------|------|
| `users.json` | 用户档案 |
| `sessions.json` | 会话记录 |
| `messages.json` | 消息历史 |
| `memory-cards.json` | 记忆卡片 |
| `drafts.json` | 回忆录草稿 |
| `files.json` | 导入文件记录 |
| `episodes.json` | 记忆片段（本轮重构新增） |
| `articles.json` | 文章草稿（本轮重构新增） |
| `chapters.json` | 章节（本轮重构新增） |
| `books.json` | 回忆录项目（本轮重构新增） |
| `family.json` | 家庭成员（本轮重构新增） |
| `contributions.json` | 家庭贡献（本轮重构新增） |
| `consents.json` | 授权记录（本轮重构新增） |
| `action-logs.json` | 操作日志（本轮重构新增） |
| `voice-personas.json` | 语音角色（本轮重构新增） |
| `avatars.json` | 形象角色（本轮重构新增） |

### 7.2 存储特性

- **JSON 文件存储**：轻量级，无需数据库
- **同步读写**：适合小规模数据
- **数据隔离**：按 userId 隔离
- **注意**：大规模部署时建议迁移到数据库

---

## 八、可扩展性建议

### 8.1 适合未来拆分的模块

1. **数据库层** (`db.ts`)
   - 当前：JSON 文件存储
   - 未来：可迁移到 PostgreSQL/MongoDB
   - 建议：抽象出 Repository 接口

2. **LLM Provider 层** (`llm/`)
   - 当前：支持多种 Provider
   - 未来：可增加 Anthropic Claude、Gemini 等
   - 建议：保持统一的 Adapter 模式

3. **Prompt 管理**
   - 当前：Markdown 文件
   - 未来：可考虑数据库管理 + 版本控制

### 8.2 不建议重构的部分

1. `.next/` - 构建产物，每次构建自动生成
2. `node_modules/` - 依赖包，通过 npm 管理

---

## 九、安全与用户保护

### 9.1 核心原则

- **不编造事实**：所有关键信息必须来自用户原话
- **不确定信息标注**：`UncertainFact` 类型标记待确认信息
- **敏感话题克制**：创伤、战争、疾病等话题需温和处理
- **用户控制权**：支持跳过、暂停、结束访谈

### 9.2 Critic 评审要点

- 是否有过度演绎（fabrication）
- 是否失真（distortion）
- 是否丢失本人声音（voice_loss）
- 是否有潜在伤害（safety）

---

## 十、技术栈

- **框架**：Next.js 14.2.3
- **语言**：TypeScript 5.4.5
- **UI**：React 18.3.1 + Tailwind CSS
- **LLM**：OpenAI SDK (兼容多 Provider)
- **存储**：JSON 文件
- **工具**：ESLint, PostCSS

---

