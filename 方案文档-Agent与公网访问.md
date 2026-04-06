# AI 回忆录助手 - 公网访问与 Agent 增强方案

## 第一部分：公网访问方案

### 方案对比

| 方案 | 成本 | 速度 | 稳定性 | 配置难度 |
|------|------|------|--------|----------|
| **ngrok** | 免费/付费 | 快 | 高 | ⭐⭐ 简单 |
| **Cloudflare Tunnel** | 免费 | 快 | 很高 | ⭐⭐⭐ 中等 |
| **natapp** | ¥30/月起 | 中 | 中 | ⭐ 简单 |
| **花生壳** | ¥60/年 | 慢 | 中 | ⭐ 简单 |
| **frp** | 自建服务器 | 快 | 高 | ⭐⭐⭐⭐ 困难 |

### 推荐方案：Cloudflare Tunnel（免费）

#### 步骤1：安装 cloudflared

```bash
npm install -g cloudflared
```

#### 步骤2：启动公网访问

```bash
cloudflared tunnel --url http://localhost:3000
```

运行后会显示一个类似 `https://xxx.trycloudflare.com` 的公网地址，发送给其他人即可访问！

---

## 第二部分：Agent + Skills + MCP 增强方案

### 当前架构 vs 目标架构

```
当前架构:
┌─────────────┐     ┌─────────────┐
│   前端 UI   │────▶│  Next.js    │────▶ SiliconFlow API
│  (用户界面)  │     │  API Routes │
└─────────────┘     └─────────────┘
                          │
                    ┌─────┴─────┐
                    │  JSON文件  │
                    │   (存储)   │
                    └───────────┘

目标架构 (Agent):
┌─────────────┐     ┌─────────────┐
│   前端 UI   │────▶│  Agent      │────▶ SiliconFlow API
│  (用户界面)  │     │  Controller │
└─────────────┘     └─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  ┌───────────┐   ┌───────────┐   ┌───────────┐
  │  Skills   │   │   MCP     │   │  Memory   │
  │ (技能)     │   │ (工具)    │   │  (记忆)   │
  └───────────┘   └───────────┘   └───────────┘
```

### 1. Skills（技能）模块

| 技能 | 功能描述 | 开发难度 |
|------|----------|----------|
| **访谈技能** | 智能提问、追问、情感识别 | ⭐⭐⭐ 中 |
| **写作技能** | 多种文体风格转换 | ⭐⭐⭐ 中 |
| **批评技能** | 评审、评分、优化建议 | ⭐⭐⭐ 中 |
| **时间线技能** | 自动整理时间顺序 | ⭐⭐ 简单 |
| **人物关系技能** | 构建人物关系图谱 | ⭐⭐⭐ 中 |
| **情感分析技能** | 识别情感变化、敏感话题 | ⭐⭐⭐ 中 |
| **导出技能** | PDF/Word/音频导出 | ⭐⭐⭐⭐ 难 |

### 2. MCP（Model Context Protocol）工具

| 工具 | 功能 | 月成本（估算） |
|------|------|----------------|
| **文件系统** | 读取/写入本地文件 | 免费 |
| **数据库** | SQLite/PostgreSQL 操作 | 免费 |
| **网页搜索** | 实时信息查询 | ¥0-50 |
| **PDF解析** | 读取PDF文档 | ¥0-30 |
| **图片OCR** | 识别图片文字 | ¥0-100 |
| **语音合成** | 文字转语音 | ¥0-200 |
| **地图API** | 地点识别、历史地图 | 免费-¥50 |

### 3. Agent 架构设计

```typescript
// 核心 Agent 结构
interface AIAgent {
  // Agent 的大脑
  brain: {
    systemPrompt: string;      // 系统指令
    skills: Skill[];           // 技能列表
    memory: AgentMemory;       // 长期记忆
    context: ConversationContext; // 当前上下文
  };
  
  // Agent 的能力
  capabilities: {
    interview: InterviewSkill;
    writer: WriterSkill;
    critic: CriticSkill;
    exporter: ExporterSkill;
  };
  
  // Agent 的工具箱
  tools: MCPTool[];
}

// Skill 示例
interface Skill {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
  requiredContext: string[];
}

// MCP Tool 示例
interface MCPTool {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
  schema: JSONSchema;
}
```

---

## 第三部分：成本分析

### 场景1：个人使用（当前模式）

| 项目 | 成本 |
|------|------|
| 服务器 | ¥0（自己的电脑） |
| 域名 | ¥0（使用免费穿透） |
| API（SiliconFlow） | ¥0-50/月 |
| **总计** | **¥0-50/月** |

### 场景2：Agent 增强版（单人使用）

| 项目 | 成本 |
|------|------|
| 服务器 | ¥0（自己的电脑） |
| 域名 | ¥0（使用免费穿透） |
| API（SiliconFlow） | ¥50-150/月 |
| MCP 工具 | ¥0-50/月 |
| **总计** | **¥50-200/月** |

### 场景3：多用户公网服务（5-10人）

| 项目 | 成本 |
|------|------|
| 云服务器（轻量） | ¥60-100/月 |
| 域名 | ¥30-60/年 |
| API（SiliconFlow） | ¥200-500/月 |
| MCP 工具 | ¥50-100/月 |
| CDN/流量 | ¥0-50/月 |
| **总计** | **¥340-810/月** |

### 场景4：商业化运营（50+用户）

| 项目 | 成本 |
|------|------|
| 云服务器（中等） | ¥300-500/月 |
| 域名+SSL | ¥100-200/年 |
| API（SiliconFlow/自建） | ¥1000-3000/月 |
| MCP 工具 | ¥200-500/月 |
| CDN/流量 | ¥100-300/月 |
| 维护人力 | ¥2000+/月 |
| **总计** | **¥3600-5500/月** |

---

## 第四部分：实施路线图

### 阶段1：MVP（1-2周）
- [x] 当前基础功能
- [ ] 添加 Skills 抽象层
- [ ] 实现基本 MCP 工具

### 阶段2：Agent 化（2-4周）
- [ ] 重构为 Agent 架构
- [ ] 实现 5+ 核心 Skills
- [ ] 添加长期记忆模块

### 阶段3：生态化（1-2月）
- [ ] 开放 MCP 插件市场
- [ ] 支持用户自定义 Skills
- [ ] 社区模板分享

---

## 第五部分：推荐的技术栈

```json
{
  "agent_framework": "LangChain.js / AutoGen",
  "mcp_server": "@modelcontextprotocol/server-filesystem",
  "vector_db": "Pinecone / Qdrant / Milvus",
  "llm_provider": "SiliconFlow / OpenAI / Anthropic",
  "deployment": "Vercel / Railway / 阿里云"
}
```

---

## 总结

| 方案 | 适合人群 | 预算 |
|------|----------|------|
| **当前模式** | 个人/家庭 | ¥0-50/月 |
| **Agent 增强** | 进阶用户 | ¥50-200/月 |
| **多用户服务** | 小型机构 | ¥340-810/月 |
| **商业运营** | 企业/创业 | ¥3600+/月 |

---

*文档版本：v1.0*
*更新日期：2026-03-11*
