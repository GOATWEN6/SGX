# AI Voice Assistant Next Round Implementation Plan

> **For agentic workers:** REQUIRED: Use `subagent-driven-development` when implementing this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 下一轮只做一件事：证明老人端 AI 语音助手可以从 Demo 走向真实 realtime voice 链路，避免把浏览器 ASR/TTS fallback 误判成完成。

**Architecture:** 采用 PRD traceability + open-source first + harness engineering。先建立多 Agent 调度和验收资产，再复现 Volcengine/LiveKit/Pipecat 三条路线，最后按证据选择 SGX 的 realtime proxy 实现路径。

**Tech Stack:** Next.js 14 + TypeScript, server-side realtime proxy, WebSocket/WebRTC, Doubao/Volcengine realtime voice, LiveKit/Pipecat reference spikes, explicit state machine, JSON harness, manual browser microphone acceptance.

---

## 本轮边界

**做：**

- 固化多 Agent 自动触发、角色、gate 和文件所有权。
- 建立 `harness/voice-assistant`，让 PRD、验收、状态机、source lock、隐私安全可追踪。
- 复现或验证高质量开源 realtime voice 项目，优先 Volcengine RTC AIGC Demo、LiveKit Agents、Pipecat。
- 写 realtime provider contract 和 state machine，再进入代码实现。

**不做：**

- 不把 Web Speech API fallback 当成主链路。
- 不先做回忆录编辑、家庭互动、订阅、游戏化。
- 不做后台语音唤醒或硬件常驻监听。
- 不把未确认敏感记忆写入长期记忆。
- 不在浏览器暴露 provider API key。

## Task 1: Multi-Agent Rules And Harness

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/planning/voice-assistant-realtime-next-phase-plan.md`
- Create: `docs/research/realtime-voice-open-source-evaluation.md`
- Create: `harness/voice-assistant/prd-traceability.json`
- Create: `harness/voice-assistant/progress.json`
- Create: `harness/voice-assistant/source-lock.json`
- Create: `harness/voice-assistant/e2e-scenarios.json`
- Create: `harness/voice-assistant/state-machine-cases.json`
- Create: `harness/voice-assistant/manual-acceptance.md`
- Create: `harness/voice-assistant/security-privacy-checklist.md`
- Create: `harness/voice-assistant/multi-agent-operating-model.md`

- [ ] **Step 1: 写入多 Agent scale policy**
  - Expected: `AGENTS.md` 明确什么时候启用多 Agent、什么时候不用、每个角色负责什么。

- [ ] **Step 2: 建立 PRD traceability**
  - Expected: D1.1-D1.8 都有当前状态、证据、下一验收和“不算完成”的条件。

- [ ] **Step 3: 建立验收场景和状态机用例**
  - Expected: 10 条端到端场景覆盖入口、麦克风、10 轮对话、语音打断、按钮打断、敏感记忆、联网、安全和失败恢复。

- [ ] **Step 4: 建立 source lock**
  - Expected: 每个开源候选都有用途、优先级、license 审查状态和复现证据要求。

- [ ] **Step 5: 检查文档没有明文密钥**
  - Run: `node scripts/voice-secret-scan.mjs AGENTS.md docs harness`
  - Expected: 不出现真实 key。

## Task 2: Source Gate Reproductions

**Files:**
- Update: `harness/voice-assistant/source-lock.json`
- Update: `harness/voice-assistant/progress.json`
- Create later if needed: `docs/research/realtime-voice-spike-results.md`

- [ ] **Step 1: 复现 `volcengine/rtc-aigc-demo`**
  - Expected: 记录服务开通项、启动方式、Web 接入、ASR/TTS/LLM/RTC 参数、是否支持 interrupt/cancel。

- [ ] **Step 2: 复现 `livekit/agents` basic voice agent**
  - Expected: 记录浏览器音频输入、server-side agent、VAD、turn detector、播放和打断证据。

- [ ] **Step 3: 复现 `pipecat-ai/pipecat` quickstart 或 WebRTC 示例**
  - Expected: 记录 transport、pipeline events、字幕、VAD、metrics 和中文 provider 替换成本。

- [ ] **Step 4: 选择 Sprint 1 主线**
  - Expected: 在 `docs/research/realtime-voice-spike-results.md` 写明选择 Doubao proxy、LiveKit bridge 或 Pipecat bridge 的理由。

## Task 3: Realtime Contract Before Implementation

**Files:**
- Create: `src/lib/voice/realtime/types.ts`
- Create: `src/lib/voice/realtime/state-machine.ts`
- Create: `src/lib/voice/realtime/session-store.ts`
- Create: `scripts/voice-realtime-smoke.mjs`
- Update: `harness/voice-assistant/state-machine-cases.json`

- [ ] **Step 1: 写 provider contract**
  - Expected: contract 包含 create session、append audio、receive transcript/audio delta、interrupt、close、error recovery。

- [ ] **Step 2: 写 state machine 测试**
  - Expected: 合法迁移通过，非法迁移被拒绝并记录原因。

- [ ] **Step 3: 写 smoke 脚本骨架**
  - Expected: 没有真实 provider 时显示明确 SKIP，不静默 fallback。

- [ ] **Step 4: 跑 type/build gate**
  - Run: `env JWT_SECRET=dev-build-secret npm run build`
  - Expected: build pass。

## Task 4: Realtime Proxy Spike

**Files:**
- Create: `src/app/api/voice/realtime/route.ts`
- Create: `src/lib/voice/realtime/doubao-protocol.ts`
- Modify: `src/lib/voice/index.ts`
- Modify later: `src/app/voice-assistant/page.tsx`

- [ ] **Step 1: 后端 session 创建**
  - Expected: 浏览器只拿临时 session id，不拿 provider key。

- [ ] **Step 2: 浏览器音频 chunk 到后端**
  - Expected: 后端记录 chunk count、sample rate、duration，不记录明文 key。

- [ ] **Step 3: provider audio delta 回放**
  - Expected: 前端播放队列播放 provider 返回音频，不用浏览器 TTS 当主链路。

- [ ] **Step 4: interrupt 全链路**
  - Expected: UI/VAD -> client runtime -> server proxy -> provider cancel/interrupt -> playback queue clear。

## Task 5: Evaluation Gate

**Files:**
- Update: `harness/voice-assistant/manual-acceptance.md`
- Update: `harness/voice-assistant/progress.json`
- Update: `harness/voice-assistant/security-privacy-checklist.md`
- Update later: `scripts/voice-mvp-e2e.mjs`

- [ ] **Step 1: 自动化检查**
  - Expected: API regression、state machine、secret scan 通过。

- [ ] **Step 2: 人工 10 轮验收**
  - Expected: 真实麦克风连续 10 轮不中断。

- [ ] **Step 3: 10 次打断验收**
  - Expected: 至少 9 次停止旧音频，旧字幕不继续更新。

- [ ] **Step 4: 安全隐私验收**
  - Expected: 无 key 泄露、无未确认敏感记忆、无高风险健康建议。

## 下一轮执行顺序

1. 先完成 Task 1，提交 docs/harness commit。
2. 再执行 Task 2，必要时请求网络/安装/运行命令审批。
3. Source Gate 有证据后，才进入 Task 3/4 的代码实现。
4. 每个 Task 都由 Dispatcher 拆给不重叠文件范围的 Worker，并由 Evaluator/Safety Reviewer 复核。
