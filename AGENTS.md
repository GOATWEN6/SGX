# SGX 项目开发规则

## 事实源和优先级

- 产品决策必须追溯到 `银发AI相框-PRD:MVP.md`，除非用户在当前对话中明确覆盖 PRD。
- 当前 MVP 优先围绕 PRD 模块 D：老人端 AI 语音对话基础能力。
- 不要把产品做成通用聊天壳。目标体验是银发 AI 相框入口：相框 -> AI聊天 / 家的故事 -> 语音对话、大字幕、清晰返回路径。
- 如果实现细节冲突，优先级为：用户当前明确指令、PRD、现有代码约定、外部开源示例。

## 产品边界

- MVP 必须围绕老人友好型语音对话：点击进入、麦克风授权、ASR、AI 回复、TTS、大字幕、状态反馈、打断、连续对话、受控联网、记忆/上下文使用和安全处理。
- 不要把非 MVP 重功能塞进语音助手主线：子女与老人实时通话、支付订阅、硬件定制、复杂社交、复杂账号体系、完整编辑出版工作流、医疗/投资/法律建议。
- AI 不得假扮子女或家庭成员。任何“子女发起感”都必须先有单独产品设计，再进入实现。
- 敏感记忆、健康信息、家庭冲突、财务信息、禁忌话题必须经过老人明确确认，才能进入长期记忆或后续复用。

## Open-Source First

- 重要模块实现前，必须先查 GitHub 和高质量开源项目，再决定是否自研。
- 优先复现和改造成熟项目，用于 realtime voice、VAD、turn detection、WebRTC/WebSocket transport、memory extraction、testing harness。
- 每个采用的开源参考都要记录：仓库 URL、license、复制/改造范围、集成边界、为什么符合 PRD。
- 如果没有合适开源项目，先写清楚“为什么自研”，再创建新的架构。
- 不检查 license 和归属要求，不允许直接复制开源代码。

## 工程流程

- 使用小分支、小提交。每个 commit 只对应一个清晰的用户可见结果或基础设施结果。
- 每个功能必须包含 PRD traceability：PRD 条目、用户可见行为、验收条件、测试方式、已知缺口。
- 能 TDD 就 TDD：核心逻辑先写或扩展聚焦测试，再改实现。
- 采用 harness engineering：功能清单、进度状态、测试命令、测试样例、人工验收步骤都要可重复。
- 使用多 Agent 时按职责拆分：代码现状探索、开源方案调研、实现、测试/QA、最终集成。
- 没有质量门禁证据，不允许声称功能完成。

## 质量门禁

- 逻辑/API 改动必须有聚焦自动化测试。
- TypeScript 改动必须跑 build 或 typecheck。
- UI 改动在可行时必须做浏览器验证或截图检查。
- 语音改动必须同时有自动化检查和人工设备验收清单，覆盖麦克风授权、ASR、播放、打断、错误恢复。
- 外部网页或工具集成必须包含 prompt injection 隔离、来源引用、超时处理、安全降级。
- 密钥只能放在 `.env.local` 或 secret storage。禁止提交 API key、token、私钥或包含凭证的日志。

## 语音助手架构规则

- API key 绝不能暴露给浏览器。Realtime provider 必须走服务端 proxy 或可信后端。
- 浏览器可以采集麦克风音频，但 provider 凭证和 session 创建必须留在服务端。
- Browser Web Speech 只能作为 Demo fallback，不能作为 realtime voice 的验收主链路。
- Realtime voice 验收必须具备：流式音频输入、流式音频输出、interrupt/cancel 传递到 provider、稳定 session 状态。
- 智能打断必须停止播放并取消过期模型/语音响应，不能只是隐藏 UI 或停止本地 TTS。
- 状态机必须显式、可测试。至少包含：idle、connecting、listening、user_speaking、thinking、assistant_speaking、interrupted、recovering、error、ended。

## Review Checklist

- 改动是否对应 PRD 要求或用户明确覆盖？
- 是否先查过 GitHub/open-source，再决定实现方式？
- 是否保护了密钥和老人/家庭隐私？
- 老人端状态是否清楚、可恢复？
- 失败日志是否足够定位问题？
- 测试和人工验收步骤是否更新？
- commit 是否足够小、可 review、可回滚？
