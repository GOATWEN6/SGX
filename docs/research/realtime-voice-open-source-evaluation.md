# Realtime Voice Open-Source Evaluation

日期：2026-05-27

本文件用于支持“银发 AI 语音助手”下一阶段选型。它不是最终技术定论，而是 Sprint 0/1 的复现优先级和边界记录。任何复制开源代码前，必须重新核对 license、依赖 license、商用限制和归属要求。

## 结论

下一轮不应继续围绕浏览器 `SpeechRecognition` + `speechSynthesis` 调 UI。优先做三条复现路径：

1. `volcengine/rtc-aigc-demo`：验证火山/Doubao 账号、中文 ASR/TTS、RTC Web 接入、延迟和打断语义。
2. `livekit/agents`：验证 server-side voice agent、WebRTC、VAD、turn detection、浏览器接入和密钥后端保管。
3. `pipecat-ai/pipecat`：验证 voice pipeline、WebSocket/WebRTC、VAD、字幕、metrics 和 provider 替换成本。

如果 Doubao/火山路线能满足中文体验和 interrupt/cancel，则 Sprint 1 做 SGX 自己的 server-side realtime proxy。如果 Doubao 路线短期卡在权限或协议，则先用 LiveKit/Pipecat 跑通真实 realtime path，同时保留 Doubao adapter。

## 候选项目表

| 优先级 | 项目 | 用于哪个模块 | 复现目标 | 当前判断 |
|---:|---|---|---|---|
| 1 | [volcengine/rtc-aigc-demo](https://github.com/volcengine/rtc-aigc-demo) | Doubao/火山 realtime voice | 跑通火山 RTC + ASR + LLM + TTS demo，确认账号权限、Web 接入、中文语音、延迟、interrupt/cancel 证据 | Sprint 0 必做，最贴近默认供应商 |
| 2 | [livekit/agents](https://github.com/livekit/agents) | Realtime voice agent、WebRTC、VAD、turn detection | 复现 basic voice agent，确认浏览器音频流、server-side agent、播放/字幕/打断模式 | Sprint 0 必做，适合做架构参考或 fallback 主线 |
| 3 | [pipecat-ai/pipecat](https://github.com/pipecat-ai/pipecat) | Voice pipeline、transport、VAD、metrics | 复现 quickstart 或 WebRTC 示例，评估引入 Python 服务和中文 provider 适配成本 | Sprint 0 必做，适合验证 pipeline 思路 |
| 4 | [snakers4/silero-vad](https://github.com/snakers4/silero-vad) | VAD/智能打断 | 验证说话开始检测、噪声误触发、打断延迟；优先通过 LiveKit/Pipecat 间接复现 | Sprint 0/1 必验证 |
| 5 | [giztoy/doubao-speech-go](https://pkg.go.dev/github.com/giztoy/doubao-speech-go/examples/realtime) | Doubao realtime 事件语义参考 | 验证 `OpenSession`、`SendAudio`、`Interrupt`、`Close` 等语义；不直接作为前端架构 | 可作为 Doubao spike 参考，不直接复制 |
| 6 | [openai/openai-realtime-agents](https://github.com/openai/openai-realtime-agents) | Next.js realtime agent 设计参考 | 参考短期 token、WebRTC、handoff、tool calling、guardrail 组织方式 | 后续参考，不作为默认供应商路线 |
| 7 | [TEN-framework/ten-framework](https://github.com/ten-framework/ten-framework) | Full-duplex turn-taking、VAD、RTC/WebSocket | 技术预研 full-duplex voice agent | 后续参考；框架较重，license 需额外审查 |
| 8 | [vocodedev/vocode-core](https://github.com/vocodedev/vocode-core) | STT/TTS/LLM 抽象 | 参考 streaming conversation 抽象和电话场景设计 | 后续参考；当前活跃度和 Web 场景匹配度不是最高 |

## 不在 Sprint 0/1 主线的项目

| 方向 | 项目 | 暂缓原因 |
|---|---|---|
| 浏览器 fallback | [MDN Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API) | 只能做 Demo fallback，不能验收电话式 realtime voice |
| 本地 ASR | [whisper.cpp](https://github.com/ggerganov/whisper.cpp)、[faster-whisper](https://github.com/SYSTRAN/faster-whisper)、[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) | MVP 先做 provider 接口和云端实时链路，本地/私有化后续评估 |
| 本地 TTS | [Piper](https://github.com/rhasspy/piper) | 先做 TTS provider 接口，后续再做本地语音 |
| Wake Word | [openWakeWord](https://github.com/dscripka/openWakeWord)、[livekit-wakeword](https://github.com/livekit/livekit-wakeword) | 前台语音唤醒排在语音闭环后；不做后台常驻承诺 |
| Web Search | [SearXNG](https://docs.searxng.org/)、[Mozilla Readability](https://github.com/mozilla/readability) | 真实联网放在 voice loop 稳定后，但 Tool Broker 安全边界需提前保留 |
| Memory | [Mem0](https://github.com/mem0ai/mem0)、[pgvector](https://github.com/pgvector/pgvector) | MVP 先结构化记忆 + 确认状态；数据库和向量检索后续升级 |
| Agent Framework | [LangGraph.js](https://langchain-ai.github.io/langgraphjs/)、[Mastra](https://mastra.ai/framework)、[AI SDK](https://ai-sdk.dev/docs/providers) | 先做轻量 Agent 职责拆分和 prompt 管理，不急着重度引入 |

## 复现 Gate

每个候选项目复现必须记录：

- 复现日期、commit/tag、license、依赖 license 风险。
- 启动命令、环境变量名、是否需要真实账号。
- 是否满足：浏览器音频输入、server-side key、流式转写、流式音频输出、interrupt/cancel、字幕停止、错误恢复。
- 是否能与 SGX Next.js 现有 `/voice-assistant` 页面集成。
- 哪些代码可以借鉴，哪些只能参考设计，哪些禁止复制。

## 下一步推荐

1. 先用 `source-lock.json` 固定三条复现路径和验收字段。
2. 复现 `volcengine/rtc-aigc-demo`，确认 Doubao/火山账号权限和 Web 接入。
3. 复现 `livekit/agents` basic voice agent，确认 server-side agent 与浏览器链路。
4. 复现 `pipecat-ai/pipecat` quickstart 或 WebRTC 示例，确认 pipeline 和中文 provider 替换成本。
5. 根据三条复现结果决定 Sprint 1 的主线：Doubao proxy、LiveKit bridge 或 Pipecat bridge。
