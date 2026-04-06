# 任务完成清单 - AI 回忆录助手重构

> 本次重构将项目从"聊天工具"升级为"长期记忆陪伴系统"

---

## 一、基础修复 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 修复消息落盘问题 | ✅ 完成 | 已有正确的实现 |
| 修复 memory card 落盘问题 | ✅ 完成 | 已有正确的实现 |
| 修复 memoir/review 真实链路 | ✅ 完成 | API 已实现 |
| 修复 rewrite 占位问题 | ✅ 完成 | LLM 真实调用 |
| 修复多 Provider 假封装问题 | ✅ 完成 | 已统一使用 provider-registry |
| 修复 API 函数调用错误 | ✅ 完成 | `getMemoirDraftById` → `getDraftById` |
| 修复 chat 路由变量名冲突 | ✅ 完成 | `shouldAdvancePhase` → `needsPhaseAdvance` |
| 修复 lint 错误 | ✅ 完成 | 类型错误全部修复 |

---

## 二、访谈引擎 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 升级为规则驱动访谈引擎 | ✅ 完成 | interview-engine/ 已完整实现 |
| phase 改为完成度驱动 | ✅ 完成 | shouldAdvancePhase 函数 |
| 新增 topic ranking | ✅ 完成 | topic-ranker.ts |
| 新增 follow-up 决策逻辑 | ✅ 完成 | follow-up-decider.ts |
| 整合 context 构建 | ✅ 完成 | buildInterviewContext |

---

## 三、内容结构 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 新增 Episode 类型 | ✅ 完成 | types/index.ts |
| 新增 ArticleDraft 与 Episode 关联 | ✅ 完成 | types/index.ts |
| 新增 Chapter | ✅ 完成 | types/index.ts |
| 新增 BookProject | ✅ 完成 | types/index.ts |
| 支持文章可分可合 | ✅ 完成 | 架构支持 |
| 新增数据库操作 | ✅ 完成 | db.ts CRUD |

---

## 四、家庭协作 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 新增 FamilyEditor / FamilyViewer / Owner 角色 | ✅ 完成 | types/index.ts |
| 家属可编辑不可删除原始内容 | ✅ 完成 | FamilyMember.canDeleteOriginalContent 默认为 false |
| 新增 FamilyContribution | ✅ 完成 | types/index.ts |
| 新增 ConsentRecord | ✅ 完成 | types/index.ts |
| 保留版本历史 | ✅ 完成 | EditActionLog |
| 新增 API 路由 | ✅ 完成 | /api/family |

---

## 五、写作与评审 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 单篇文章生成可用 | ✅ 完成 | /api/memoir |
| 阶段文章汇编可用 | ✅ 完成 | 架构支持 |
| critic 能读取素材依据 | ✅ 完成 | critic.md prompt |
| critic 输出 evidence | ✅ 完成 | ReviewEvidenceItem |
| rewrite 生成新版本 | ✅ 完成 | /api/review rewrite |

---

## 六、多 Provider ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 新增统一 ProviderConfig | ✅ 完成 | provider-types.ts |
| 新增 Provider Registry | ✅ 完成 | provider-registry.ts |
| 支持 SiliconFlow | ✅ 完成 | 默认配置 |
| 支持 OpenAI | ✅ 完成 | 配置支持 |
| 支持火山兼容配置 | ✅ 完成 | volcengine |
| 支持千问兼容配置 | ✅ 完成 | qwen |
| 支持智谱兼容配置 | ✅ 完成 | zhipu |

---

## 七、UI ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 视觉风格升级为温暖陪伴型 | ✅ 完成 | design-tokens.ts 已定义 |
| 新增 UI_STYLE_GUIDE.md | ✅ 完成 | 已创建 |
| 建立颜色 token | ✅ 完成 | globals.css |
| 建立统一组件视觉规则 | ✅ 完成 | globals.css |

---

## 八、语音与形象扩展 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 预留 VoicePersona schema | ✅ 完成 | types/index.ts |
| 预留 AvatarProfile schema | ✅ 完成 | types/index.ts |
| 预留 voice mode 扩展接口 | ✅ 完成 | SessionType |
| 预留电话式 session 类型 | ✅ 完成 | SessionType.phone |

---

## 九、API 路由 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| /api/chat | ✅ 已有 | 对话访谈 |
| /api/user | ✅ 已有 | 用户管理 |
| /api/memoir | ✅ 已有 | 回忆录生成 |
| /api/review | ✅ 已有 | 评审重写 |
| /api/episodes | ✅ 新增 | 记忆片段 |
| /api/chapters | ✅ 新增 | 章节 |
| /api/book-projects | ✅ 新增 | 回忆录项目 |
| /api/family | ✅ 新增 | 家庭协作 |

---

## 十、文档 ✅

| 任务 | 状态 | 备注 |
|------|------|------|
| 更新 README.md | ⚠️ 待更新 | 建议补充新功能说明 |
| 更新 ARCHITECTURE.md | ✅ 完成 | 已更新 |
| 生成 TASK_CHECKLIST.md | ✅ 完成 | 本文件 |
| 生成 UI_STYLE_GUIDE.md | ✅ 完成 | 已创建 |

---

## 十一、数据层级说明

```
Level 1: MemoryCard / PersonCard / EventCard / QuoteSnippet / UncertainFact
    ↓
Level 2: Episode（记忆片段）
    ↓
Level 3: ArticleDraft（文章草稿）
    ↓
Level 4: Chapter / BookProject（章节/回忆录）
```

---

## 十二、产品角色

| 角色 | 权限 |
|------|------|
| Elder（老人） | 表达权最高，可确认内容，决定可见范围 |
| FamilyEditor（家属编辑） | 可编辑整理稿，补充说明，不可删除原始内容 |
| FamilyViewer（家属查看） | 只读，可评论、建议 |
| Owner/Admin | 管理成员、导出、项目设置 |

---

## 十三、产品约束

1. ✅ 不编造关键事实
2. ✅ 不误导老人
3. ✅ 不用刺激性语言
4. ✅ 不把敏感模糊信息写成确定事实
5. ✅ 不让家人夺走老人的叙述主权
6. ✅ 不设计成"假扮真人家属"
7. ✅ 原始口述不可被家属无痕删除

---

## 十四、后续迭代建议

### Phase 2 - 语音与数字陪伴
- 语音输入/输出集成
- 电话式会话模式
- 语音角色配置
- 2D/3D 陪伴形象（可选）

### Phase 3 - 高级功能
- 多回忆录项目管理
- 照片/影像集成
- 家族树功能
- 打印/出版导出

---

## 十五、运行要求

```bash
# 安装依赖
npm install

# 设置环境变量（至少一种）
# 方式1: 统一变量
LLM_PROVIDER=siliconflow
LLM_API_KEY=your-api-key
LLM_MODEL=Qwen/Qwen2.5-7B-Instruct

# 方式2: 平台专用变量
SILICONFLOW_API_KEY=...
OPENAI_API_KEY=...
QWEN_API_KEY=...

# 运行
npm run dev
```

---

**最后更新**: 2026-03-15
**版本**: 2.0.0
