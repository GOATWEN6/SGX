# AI 语音助手实时链路下一阶段实施计划

> **For agentic workers:** REQUIRED: Use `subagent-driven-development` if subagents are available, otherwise use `executing-plans`. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把当前 Demo 语音助手升级为符合 PRD 模块 D 的真实前台网页类电话体验：老人进入 AI聊天后可连续说话，AI 语音和大字幕回应，老人开口或点击能打断，系统能恢复继续听。

**Architecture:** 以 PRD 为源头，先做可复现、可测、可回滚的 realtime voice slice。优先复现高质量开源实时语音框架的核心链路；如果 Doubao 官方实时语音协议无法直接嵌入开源框架，则用开源框架的 transport/VAD/turn-taking 思路，自建最小 server-side realtime proxy。

**Tech Stack:** Next.js 14 + TypeScript, server-side realtime proxy, WebSocket/WebRTC transport, Doubao realtime voice, Volcengine Ark text model, explicit state machine, JSON storage for MVP, automated API tests, manual microphone/browser verification.

---

## 0. 本计划继承的基础对话原则

本计划吸收 `docs/planning/conversation-core-mvp-task-breakdown.md` 的结论，并把下一阶段收敛到一个目标：先打通老人端 AI 语音对话底座，不把回忆录、家庭互动、订阅、游戏化和后台管理塞进主链路。

下一阶段必须坚持：

- 先让“老人像打电话一样和 AI 连续说话”成立。
- Web Speech API 只能作为 Demo fallback，不能作为 realtime voice 主验收。
- 智能打断必须同时停止本地播放、取消 provider 旧响应、阻止旧字幕继续更新。
- 敏感记忆、健康、家庭矛盾、财务、禁忌话题必须经过老人确认。
- 联网只能走 Tool Broker，网页内容永远是不可信外部资料。
- 语音唤醒只做前台网页尝试，不承诺浏览器关闭后的后台常驻监听。
- Agent 编排先做轻量职责拆分和 prompt 管理，不急着引入重型框架。

## 1. PRD Traceability

| PRD 来源 | 必须满足的用户行为 | 下一阶段验收口径 |
|---|---|---|
| D1.1 AI聊天入口、语音唤醒与麦克风授权 | 老人从相框点击 AI聊天进入；语音唤醒可尝试但不可阻塞主链路；麦克风失败有返回路径 | `/voice-assistant` 和相框入口均能进入；首次麦克风拒绝时显示清晰引导 |
| D1.2 语音输入与 ASR | 进入对话页后默认进入可听状态，识别普通话，失败可重试 | 连续 10 轮真实麦克风输入不丢 session；识别失败不崩溃 |
| D1.3 AI 回复生成与联网查询 | AI 生成回复，必要时联网，高风险问题安全提醒 | 文本模型真实可用；天气/新闻走工具；健康用药不诊断不开药 |
| D1.4 TTS 播报、大字幕与状态反馈 | AI 回复同时语音播报和大字幕，状态清楚 | UI 显示 listening/thinking/speaking/interrupted/error；音频和字幕同步更新 |
| D1.5 打断与连续对话 | AI 说话时老人开口或点击打断，停止旧播报并听新输入 | 10 次插话至少 9 次停止旧音频；旧 response 不继续写入字幕 |
| D1.6 老人友好型对话策略 | 短句、慢节奏、低压力、温和追问 | 回归集中不出现连续盘问、客服式回复或医生/销售口吻 |
| D1.7 基础记忆与上下文使用 | 使用老人基础信息和必要历史摘要，不制造被监视感 | 只注入确认记忆；敏感候选先确认后使用 |
| D1.8 提示词与 Agent 基础编排 | AI聊天、聊往事、互动建议等任务分开编排 | prompt/agent 配置分文件，有版本和测试样例 |

## 2. 当前状态

| 能力 | 当前实现 | 当前问题 | 下一阶段策略 |
|---|---|---|---|
| 独立测试页 | `src/app/voice-assistant/page.tsx` | 可测入口已存在，但仍是 Demo | 保留为实验台，接入真实 realtime runtime |
| 语音输入 | 浏览器 `SpeechRecognition` | 不是稳定实时流，不能承载电话式体验 | 改为浏览器采集 PCM/audio chunk，送后端 proxy |
| 语音输出 | 浏览器 `speechSynthesis` | 不能代表 Doubao 音频流，无法真实 cancel provider response | 播放 provider 返回的 audio delta，建立播放队列和 cancel |
| 打断 | 前端 VAD + 停本地 TTS | 只能停本地声音，不会取消真实模型生成 | 将 interrupt 事件传到 server proxy 和 provider |
| 文本模型 | Volcengine Ark 配置 | 当前账号未开通配置模型时会 fallback | Sprint 0 先修模型配置验收和错误可视化 |
| 记忆 | 规则提取 + confirm/reject API | 抽取粗糙，未形成 LLM JSON schema | 后续改为单独 MemoryAgent，敏感记忆强确认 |
| 联网 | ToolBroker 框架 | 无真实 search provider 时无真实 citation | 先保留框架，真实搜索放到语音链路后 |

## 3. Open-Source First 选型

| 优先级 | 项目 | 可复用部分 | 适配方式 | 风险 |
|---|---|---|---|---|
| 1 | `livekit/agents` | WebRTC 房间、server-side agent、STT/LLM/TTS 插件、Silero VAD、turn detector、智能打断、浏览器/移动端 SDK | 先复现 basic voice agent，再接到 Next.js AI聊天页；适合“浏览器相框页 + 后端保管 key + 连续对话” | LiveKit Cloud 有平台成本；自建 LiveKit 需要运维 |
| 2 | `pipecat-ai/pipecat` | realtime voice pipeline, WebSocket/WebRTC transports, Silero VAD, STT/TTS/LLM 编排, metrics, React/JS 客户端示例 | 复现 `p2p-webrtc` 或 `simple-chatbot`，验证 VAD、打断、字幕和中文 provider 替换难度 | Python 服务会引入第二运行时；中文 ASR/TTS 供应商适配需实测 |
| 3 | `volcengine/rtc-aigc-demo` | 火山 RTC + ASR + LLM + TTS 端到端 demo、Web 前端、Node 服务端、Doubao/火山参数接入 | 专门验证 Doubao/火山路线的中文 ASR/TTS、国内延迟、账号权限、Web 接入 | 官方 README 定位为 demo；生产服务端、安全、权限、打断策略要自行补齐 |
| 4 | `TEN-framework/ten-framework` | RTC/WebSocket voice assistant、TEN VAD、TEN Turn Detection、Memory 扩展、前后端分离部署样例 | 技术预研 full-duplex turn-taking 和 VAD，不作为第一轮主线 | 框架较重；license 标注 Apache-2.0 with additional restrictions，需要商用核查 |
| 5 | `openai/openai-realtime-agents` | Next.js realtime voice demo、WebRTC、短期 token、agent handoff、tool calling、guardrail 示例 | 作为 Next.js realtime 架构参考，不作为默认供应商路线 | 强绑定 OpenAI Realtime；国内访问、成本、合规、供应商锁定需评估 |
| 6 | `vocodedev/vocode-core` | streaming conversation、phone/Zoom/系统音频场景、STT/TTS/LLM 抽象 | 参考抽象设计，不建议作为主线 | 活跃度弱于 LiveKit/Pipecat；浏览器实时链路不是最匹配 |
| 7 | `github.com/giztoy/doubao-speech-go` | Doubao realtime multi-turn example、Interrupt、SendAudio、Close 语义 | 用于验证 Doubao 事件语义和凭证/音色配置；不直接作为前端架构 | 第三方库，不等同官方 SDK；需要逐项对照官方文档 |

**默认路线：** Sprint 0 做 LiveKit Agents、Pipecat、Volcengine RTC AIGC Demo 三向复现；Sprint 1 按复现结果决定主线。如果 Doubao/火山 demo 能稳定满足中文、延迟和打断要求，就优先做 Doubao server-side realtime proxy；如果 Doubao 协议接入成本过高，先用 LiveKit/Pipecat 跑通真实 realtime path，同时保留 Doubao adapter 接口。

## 4. Sprint Plan

### Sprint 0A: Multi-Agent Harness And Conversation Design

**目标：** 先把下一轮协作方式、验收口径和基础对话设计写成可重复执行的工程资产，再进入 provider spike。

**Files:**
- Modify: `AGENTS.md`
- Create: `docs/research/realtime-voice-open-source-evaluation.md`
- Create: `harness/voice-assistant/prd-traceability.json`
- Create: `harness/voice-assistant/progress.json`
- Create: `harness/voice-assistant/source-lock.json`
- Create: `harness/voice-assistant/e2e-scenarios.json`
- Create: `harness/voice-assistant/state-machine-cases.json`
- Create: `harness/voice-assistant/manual-acceptance.md`
- Create: `harness/voice-assistant/security-privacy-checklist.md`
- Create: `harness/voice-assistant/multi-agent-operating-model.md`

- [ ] **Step 1: 固化多 Agent 自动触发规则**
  - Expected: `AGENTS.md` 明确什么时候启用 Planner / Dispatcher / Worker / Evaluator / Safety Reviewer。

- [ ] **Step 2: 建立 PRD traceability harness**
  - Expected: D1.1-D1.8 均有当前状态、下一证据和验收 gate。

- [ ] **Step 3: 建立端到端验收场景**
  - Expected: 10 轮对话、10 次打断、麦克风拒绝、provider 失败、敏感记忆、联网安全都可重复验收。

- [ ] **Step 4: 建立开源复现 source lock**
  - Expected: LiveKit Agents、Pipecat、Volcengine RTC AIGC Demo、Silero VAD 等候选项目有用途、优先级、license 审查状态和复现命令占位。

- [ ] **Step 5: Commit**
  - Commit message: `docs: add voice assistant multi-agent harness`

### Sprint 0B: 对齐、选型、环境可用

**目标：** 不再盲改 UI。先把模型、协议、开源复现、验收指标和开发规则固定下来。

**Files:**
- Create: `AGENTS.md`
- Create: `docs/planning/voice-assistant-realtime-next-phase-plan.md`
- Create: `docs/research/realtime-voice-open-source-evaluation.md`
- Create: `harness/voice-assistant/prd-traceability.json`
- Create: `harness/voice-assistant/manual-acceptance.md`
- Modify: `.env.example` if present, otherwise create `docs/config/voice-assistant-env.md`

- [ ] **Step 1: Confirm text model activation**
  - Verify Ark text model returns a real answer, not fallback.
  - Expected: one API route or script proves configured `LLM_MODEL` is activated.

- [ ] **Step 2: Create open-source evaluation doc**
  - Compare LiveKit Agents, Pipecat, Volcengine RTC AIGC Demo, TEN, OpenAI Realtime Agents Demo, Vocode, Doubao-specific examples.
  - Expected: selected primary spike path and fallback path; `source-lock.json` 记录是否允许复制代码。

- [ ] **Step 3: Define realtime voice acceptance fixtures**
  - Add 10-turn manual script, 10 interruption attempts, mic denied, network failure, model failure.
  - Expected: QA can run the same checklist every day.

- [ ] **Step 4: Add PRD traceability harness**
  - Record D1.1-D1.8 requirements, current file owner, test owner, status.
  - Expected: every future task updates the traceability file.

- [ ] **Step 5: Commit**
  - Commit message: `docs: define realtime voice assistant delivery plan`

### Sprint 1: Realtime Transport Spike

**目标：** 从“语音转文字后发文本”升级到“浏览器音频流 -> 后端 realtime proxy -> provider session -> audio delta 回放”。

**Files:**
- Create: `src/lib/voice/realtime/types.ts`
- Create: `src/lib/voice/realtime/doubao-protocol.ts`
- Create: `src/lib/voice/realtime/session-store.ts`
- Create: `src/app/api/voice/realtime/route.ts` or `src/server/voice/realtime-server.ts`
- Modify: `src/lib/voice/index.ts`
- Modify: `src/app/voice-assistant/page.tsx`
- Test: `scripts/voice-realtime-smoke.mjs`

- [ ] **Step 1: Write provider contract tests**
  - Contract covers create session, append audio, receive transcript/audio delta, interrupt, close.
  - Expected: tests fail before implementation.

- [ ] **Step 2: Implement server-side realtime proxy skeleton**
  - Browser connects to our server, server owns provider credentials.
  - Expected: no API key appears in browser network payload.

- [ ] **Step 3: Implement Doubao connection spike**
  - Use official Realtime endpoint and events where possible.
  - Expected: connect/update/session close works with masked logs.

- [ ] **Step 4: Implement browser PCM capture**
  - Capture mono PCM at agreed sample rate; send chunks to proxy.
  - Expected: 10 seconds audio stream reaches backend with chunk stats.

- [ ] **Step 5: Implement audio delta playback queue**
  - Decode provider audio delta and play sequentially.
  - Expected: no overlapping playback; queue can be cleared.

- [ ] **Step 6: Commit**
  - Commit message: `feat: add realtime voice transport spike`

### Sprint 2: Interrupt And Continuous Dialogue

**目标：** 让“像打电话一样聊”成立：AI 正在说时老人说话能打断，旧 response 被取消，新输入进入下一轮。

**Files:**
- Modify: `src/app/voice-assistant/page.tsx`
- Modify: `src/lib/voice/realtime/*`
- Create: `src/lib/voice/realtime/state-machine.ts`
- Create: `src/lib/voice/realtime/interruption.ts`
- Test: `scripts/voice-interrupt-manual-checklist.mjs`
- Test: `scripts/voice-mvp-e2e.mjs`

- [ ] **Step 1: Define explicit voice state machine**
  - States: idle, connecting, listening, user_speaking, thinking, assistant_speaking, interrupted, recovering, error, ended.
  - Expected: invalid transitions are rejected and logged.

- [ ] **Step 2: Propagate interrupt to all layers**
  - UI button/VAD -> client runtime -> server proxy -> provider cancel/interrupt -> playback queue clear.
  - Expected: local audio stops and provider response no longer updates captions.

- [ ] **Step 3: Add turn boundary handling**
  - Use provider events if available; otherwise combine VAD + silence threshold.
  - Expected: elder can pause naturally without premature send.

- [ ] **Step 4: Add recovery paths**
  - Provider disconnect, mic denied, audio playback error, model error.
  - Expected: user sees one clear action, not a broken state.

- [ ] **Step 5: Run 10-turn manual verification**
  - Real Chrome, real microphone, quiet room and mild noise.
  - Expected: 10 turns complete, 9/10 interruptions stop stale audio.

- [ ] **Step 6: Commit**
  - Commit message: `feat: support realtime interruption loop`

## 5. Definition Of Done

| Gate | Command / Check | Required For |
|---|---|---|
| Build | `env JWT_SECRET=dev-build-secret npm run build` | Every sprint |
| API regression | `BASE_URL=http://localhost:3001 node scripts/voice-mvp-e2e.mjs` | Every backend change |
| Realtime smoke | `node scripts/voice-realtime-smoke.mjs` | Sprint 1+ |
| Browser verification | Open `/voice-assistant` in Chrome and run manual checklist | Every UI/voice change |
| Secret audit | Confirm no API key in git diff, browser JS, console logs, or test output | Every provider change |
| PRD traceability | Update `harness/voice-assistant/prd-traceability.json` | Every feature task |

## 6. Not Now

- Do not build true background wake word in browser. PRD only needs MVP attempt; background wake requires native app/hardware review.
- Do not build child-elder realtime calls.
- Do not build payment/subscription/game mechanics.
- Do not build full memoir editor while realtime AI聊天 is broken.
- Do not add a heavy Agent framework before the basic voice loop is measurable.
- Do not expose full transcripts to child side by default.

## 7. Key Risks

| Risk | Why It Matters | Mitigation |
|---|---|---|
| Text model not activated | AI 回复会 fallback，用户会觉得助手不工作 | Sprint 0 must verify Ark model before voice work |
| Provider protocol mismatch | Doubao realtime may not match current simple session abstraction | Spike with official docs and minimal example before refactor |
| Browser audio format mismatch | Wrong sample rate/encoding causes silent failures | Add chunk stats, server validation, known audio fixture |
| Interruption only local | Stopping playback without canceling provider still leaks stale response | Interrupt must clear queue and cancel provider response |
| Latency too high | Elder conversation feels broken if wait time is long | Measure ASR/LLM/TTS/provider latency per turn |
| Secret leakage | Realtime providers need sensitive keys | Server-side proxy only; logs mask credentials |

## 8. Multi-Agent Execution Model

| Agent Role | Ownership | Output |
|---|---|---|
| Codebase Explorer | Current repo status, PRD traceability, file ownership | Gap table and touched-file map |
| Open-Source Researcher | GitHub projects, licenses, integration options | Evaluation doc and recommended reproduction path |
| Voice Runtime Worker | Realtime proxy, audio stream, provider adapter | Focused implementation commits |
| Frontend Worker | Elder UI state machine, playback queue, manual UX recovery | Browser-verifiable UI slice |
| QA Reviewer | Automated tests, manual device checklist, regression evidence | Gate report and risk list |
| Integrator | Merge decisions, final tests, commit hygiene | Small commits and final delivery note |
