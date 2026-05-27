# Voice Assistant Manual Acceptance

日期：2026-05-27

这份清单用于每次语音助手改动后的人工验收。验收时必须记录 commit、浏览器、设备、是否启用 realtime provider、是否落入 Demo fallback。

## 环境记录

| 字段 | 记录 |
|---|---|
| Date |  |
| Commit |  |
| URL |  |
| Browser |  |
| Device / Microphone |  |
| Provider mode | realtime / demo fallback |
| Text model |  |
| Search provider |  |

## P0 验收

| # | 场景 | 步骤 | 通过标准 | 结果 |
|---:|---|---|---|---|
| 1 | 入口 | 从首页进入 `/voice-assistant` | 不需要先看调研/PRD；主按钮、状态、返回路径清楚 |  |
| 2 | 麦克风允许 | 点击开始通话并允许麦克风 | 进入 listening 或 user_speaking；有清晰模式标识 |  |
| 3 | 麦克风拒绝 | 拒绝麦克风权限 | 不进入假 listening；提示能理解；可重试或返回 |  |
| 4 | 10 轮连续对话 | 连续问答 10 轮，包含停顿、重复、追问、改话题 | session 不丢；状态不乱；字幕和播放不重叠 |  |
| 5 | 语音打断 | AI 播报中开口打断 10 次 | 至少 9 次停止旧声音；旧字幕停止；provider cancel 或 stale guard 有日志 |  |
| 6 | 按钮打断 | AI 播报中点击打断按钮 | 播放队列清空，进入 listening/recovering 后可继续说 |  |
| 7 | provider 失败 | 模拟 provider/model/network 失败 | UI 有老人能看懂的错误；不写入半截脏记忆；可恢复 |  |
| 8 | 敏感记忆 | 说“别再提我以前生病的事” | 生成待确认候选；未确认不得长期使用 |  |
| 9 | 生活联网 | 问天气、节日、新闻摘要 | 经过 Tool Broker，带来源；无来源时降级 |  |
| 10 | 健康高风险 | 问“我要吃什么药” | 不诊断不开药；提示联系家人/医生 |  |

## 真实 Realtime 证据

以下任意一项缺失，都不能把功能标成 realtime voice 完成：

- 浏览器发送的是音频 chunk，而不是只把识别后的文字发给 `/api/conversation/message`。
- provider 凭证只在服务端出现，浏览器 JS 和 Network payload 没有 API key。
- 后端日志能看到 session create、audio append、response/audio delta、interrupt/cancel、close。
- AI 播报来自 provider 或后端音频流，不是浏览器 `speechSynthesis` 主链路。
- 打断后旧 response 不再更新字幕、不进入记忆、不继续播报。

## 假完成检查

| 功能 | 容易假完成的表现 | 必须检查 |
|---|---|---|
| 语音交互 | 只做语音转文字再发文本 | Network 和 server log 中必须有音频流证据 |
| 智能打断 | 只停本地声音 | provider cancel/interrupt 或 stale-response guard 必须有证据 |
| 模型可用 | fallback 文案看起来正常 | provider smoke 必须证明配置模型真实返回 |
| 联网 | AI 自称查过资料 | Tool Broker 日志、URL、标题、访问时间必须存在 |
| 记忆 | `suggestedCards` 看起来像记忆 | 需要独立候选、证据、确认状态和拒绝后不使用 |

## 结果判定

- `PASS`：P0 全部通过，且没有密钥泄露或隐私问题。
- `PARTIAL`：主要链路可用，但存在可接受的 Demo fallback 或非阻断问题。
- `FAIL`：10 轮对话、打断、provider 证据、密钥保护任一 P0 失败。
