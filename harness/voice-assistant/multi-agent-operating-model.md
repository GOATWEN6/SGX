# Voice Assistant Multi-Agent Operating Model

日期：2026-05-27

本文件定义“银发 AI 语音助手”后续开发如何自动启用多 Agent 协作。目标不是制造流程，而是避免 realtime voice、记忆、联网、安全、UI 混在一起导致假完成。

## 自动触发条件

当前任务满足任意两条时，主 Agent 应启用多 Agent：

- 涉及两个以上独立模块：前端 UI、后端 realtime proxy、provider adapter、memory、Tool Broker、测试 harness。
- 同时包含调研、实现和评测。
- 需要先复现开源项目或比较供应商方案。
- 涉及密钥、隐私、prompt injection、健康安全、老人数据。
- 用户明确要求多智能体、Planner、Dispatcher、Worker、Evaluator 或协作模式。

不启用多 Agent 的情况：

- 单文件小改动或文案修正。
- 单个明确 bug，主 Agent 本地修更快。
- 多个 Agent 会修改同一文件且难以拆分所有权。
- 操作需要用户确认，例如 push、删除、系统配置、安装软件。

## 标准编队

| Role | 输入 | 责任 | 输出 |
|---|---|---|---|
| Planner | PRD、当前用户要求、现有计划 | 拆 sprint、定范围、写验收 | plan、DoD、任务依赖 |
| Dispatcher / Integrator | plan、文件所有权、Agent 返回 | 分派任务、控制依赖、合并结果、最终提交 | 合并说明、测试证据、commit |
| Codebase Explorer | 代码路径、已知 bug、计划问题 | 只读梳理当前实现和缺口 | gap table、受影响文件、风险 |
| OpenSource Researcher | 候选项目和复现目标 | 查 GitHub/官方文档、license、复现路径 | source evaluation、source lock 更新建议 |
| Worker | 单一任务和明确文件范围 | 实现或测试，不改他人文件 | patch、测试结果、自检 |
| QA / Evaluator | harness、验收标准、当前 diff | 跑测试、找假完成、复测体验 | gate report、失败复现 |
| Safety Reviewer | provider、联网、记忆、日志改动 | 查密钥、隐私、prompt injection、安全边界 | security checklist、阻断项 |

## 调度流程

1. Planner 先写本轮计划，明确 PRD 条目、做什么、不做什么。
2. Dispatcher 判断哪些任务可以并行，给每个 Worker 分配不重叠文件所有权。
3. OpenSource Researcher 在 Source Gate 前完成候选项目、license 和复现路径。
4. Worker 只在自己的文件范围内实现，并更新对应 harness。
5. QA / Evaluator 用 `harness/voice-assistant` 做验收，优先寻找假完成。
6. Safety Reviewer 对 provider、联网、记忆、日志改动做阻断检查。
7. Integrator 统一 review diff、跑质量门禁、提交小 commit。

## 文件所有权建议

| 任务类型 | 默认 Worker | 默认文件范围 |
|---|---|---|
| Realtime provider contract | Voice Runtime Worker | `src/lib/voice/realtime/*`, `scripts/voice-realtime-smoke.mjs` |
| Frontend call experience | Frontend Worker | `src/app/voice-assistant/*` |
| State machine | Voice Runtime Worker + QA | `src/lib/voice/realtime/state-machine.ts`, `harness/voice-assistant/state-machine-cases.json` |
| Memory confirmation | Memory Worker | `src/lib/memory/*`, `src/app/api/memory/*`, memory harness |
| Tool Broker / Web search | Tools Worker + Safety Reviewer | `src/lib/tools/*`, `src/app/api/tools/*`, security harness |
| Acceptance harness | QA / Evaluator | `harness/voice-assistant/*`, `scripts/voice-*.mjs` |
| Planning/docs | Planner / Integrator | `docs/planning/*`, `docs/research/*`, `AGENTS.md` |

## 完成定义

多 Agent 本身不代表完成。只有同时满足以下条件，Integrator 才能标记任务完成：

- PRD traceability 更新。
- 对应 harness 场景更新。
- 自动化测试或人工验收有证据。
- 安全清单无阻断项。
- 没有把 Demo fallback、静态文案或 UI 状态误判成真实 provider 能力。
- commit 小且可回滚。
