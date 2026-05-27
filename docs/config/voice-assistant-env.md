# Voice Assistant Environment Config

日期：2026-05-27

本文件只记录变量名和用途，不记录真实密钥。真实值只能放在 `.env.local`、部署平台 secret 或其他 secret storage，不能提交到 Git。

## Doubao/Volcengine Realtime Voice

端到端实时语音大模型当前使用火山/豆包旧控制台鉴权头。服务端会读取这些变量并构造上游 WebSocket header，浏览器永远不应看到这些值。

| 变量 | 必填 | 示例/默认 | 含义 |
|---|---:|---|---|
| `DOUBAO_REALTIME_ENABLED` | 是 | `true` | 是否启用真实 realtime 语音链路。不是 `true` 时，页面使用浏览器 ASR/TTS Demo fallback。 |
| `DOUBAO_REALTIME_ENDPOINT` | 否 | `wss://openspeech.bytedance.com/api/v3/realtime/dialogue` | 火山端到端实时语音大模型 WebSocket 地址。 |
| `DOUBAO_REALTIME_APP_ID` | 是 | 不写入仓库 | 对应上游 header `X-Api-App-ID`。 |
| `DOUBAO_REALTIME_ACCESS_KEY` | 是 | 不写入仓库 | 对应上游 header `X-Api-Access-Key`。 |
| `DOUBAO_REALTIME_APP_KEY` | 是 | 不写入仓库 | 对应上游 header `X-Api-App-Key`。 |
| `DOUBAO_REALTIME_RESOURCE_ID` | 否 | `volc.speech.dialog` | 对应上游 header `X-Api-Resource-Id`。 |
| `DOUBAO_REALTIME_MODEL` | 否 | 供应商控制台模型名 | 记录当前使用的 realtime 语音模型，便于日志和 smoke 判断。 |
| `DOUBAO_REALTIME_VOICE` | 否 | `zh_female_cancan` | 输出音色。不同控制台可能有不同可用音色，真实联调时以火山控制台为准。 |
| `DOUBAO_REALTIME_SYSTEM_PROMPT` | 否 | 内置银发助手提示词 | realtime session 的系统提示词。不要写入隐私数据或密钥。 |
| `DOUBAO_REALTIME_INPUT_AUDIO_FORMAT` | 否 | `opus` | 发送给上游的输入音频格式声明。当前浏览器采集为 `audio/webm;codecs=opus`，真实验收时要确认上游是否接受该容器或需要改成 PCM/AudioWorklet。 |
| `DOUBAO_REALTIME_OUTPUT_AUDIO_FORMAT` | 否 | `ogg_opus` | 期望上游返回的音频格式。页面按该格式生成播放队列。 |
| `DOUBAO_REALTIME_OUTPUT_SAMPLE_RATE` | 否 | `24000` | 输出音频采样率。 |
| `DOUBAO_REALTIME_TEMPERATURE` | 否 | `0.4` | 对话生成温度，MVP 取偏稳妥，避免陪伴场景发散。 |
| `DOUBAO_REALTIME_MAX_TOKENS` | 否 | `512` | 单轮回复最大文本 token。语音场景不宜过长。 |
| `DOUBAO_REALTIME_FRAME_COMPRESSION` | 否 | `gzip` | Doubao 二进制协议 payload 压缩方式；如官方联调要求无压缩，设为 `none`。 |
| `DOUBAO_REALTIME_SESSION_PARAMS_JSON` | 否 | 不建议默认填 | 上游 StartSession payload 的覆盖参数。用于官方协议字段和当前默认 payload 不一致时快速联调，不提交真实值。 |
| `DOUBAO_REALTIME_CONNECT_TIMEOUT_MS` | 否 | `3500` | 服务端连接上游 WebSocket 的超时时间。 |

## Voice Assistant UX

| 变量 | 必填 | 示例/默认 | 含义 |
|---|---:|---|---|
| `VOICE_ASSISTANT_FAST_ACK_MS` | 否 | `900` | 文字/语音 fallback 链路等待模型首 token 的最长时间。超过后先向老人端发送一句短确认，避免页面长时间停在“正在想一想”。范围会被限制在 200-2500ms。 |

兼容别名：

- `VOLC_REALTIME_BASE_URL` -> `DOUBAO_REALTIME_ENDPOINT`
- `VOLC_APP_ID` -> `DOUBAO_REALTIME_APP_ID`
- `VOLC_ACCESS_KEY` -> `DOUBAO_REALTIME_ACCESS_KEY`
- `VOLC_APP_KEY` -> `DOUBAO_REALTIME_APP_KEY`
- `VOLC_RESOURCE_ID` -> `DOUBAO_REALTIME_RESOURCE_ID`
- `VOLC_REALTIME_MODEL` -> `DOUBAO_REALTIME_MODEL`

## 保护开关

以下变量默认不启用，只有在官方二进制协议编解码和真实 provider smoke 验证后才允许打开。

| 变量 | 默认 | 含义 |
|---|---|---|
| `DOUBAO_REALTIME_FORWARD_BINARY_PROTOCOL` | `false` | 是否真正发送 Doubao 二进制协议帧，包括 `StartConnection`、`StartSession`、`TaskRequest`、`ClientInterrupt`。默认关闭，避免未联调成功前误消耗上游资源。 |

## 当前验收边界

当前代码已做到：

- 浏览器可用 `MediaRecorder` 采集音频 chunk。
- 前端把音频 chunk 发送到 `/api/voice/realtime`。
- 服务端创建 realtime session，保管 provider 凭证。
- 服务端能构造火山官方 header，并具备带自定义 header 的上游 WebSocket 握手能力。
- 服务端已新增 Doubao 二进制协议 codec/translator，并在保护开关打开时发送 `StartConnection`、`StartSession`、`TaskRequest`、`ClientInterrupt`。
- 页面已新增 provider 音频/文本增量轮询，把服务端收到的 audio delta 放入播放队列，并把 transcript delta 用于大字幕。
- 打断会清理本地播放队列并进入服务端 realtime interrupt。
- 文本回复已新增 `/api/conversation/message/stream` SSE 接口；OpenAI-compatible/Volcengine Ark 文本模型走 `stream: true` 时，前端会再经过本地逐字队列显示，避免后端一次性 delta 时看起来“整段跳出”。
- 流式接口增加了快速首响：SSE 打开后会先发一句低风险确认话术，让页面和 TTS 立即进入“AI 正在说话”；如果模型首 token 后续仍很慢，会继续等待模型流式补全。
- Demo fallback 的浏览器 `speechSynthesis` 已改为分句队列，保留当前 `SpeechSynthesisUtterance` 引用，减少“只播前几个字就停”的问题。
- 页面新增电话式 UI：自绘动漫 AI 形象、说话口型、聆听光环、麦克风音量波动、声纹条、挂断按钮、字幕开关和默认开启的自动打断开关。
- 页面启动时会自动处理本地过期 token：如果 session 创建返回未登录，会重新创建测试用户并重试，避免页面一直停在“未登录或 token 已过期”。
- 如果浏览器没有开放麦克风权限，自动打断会降级关闭并保留文字测试，不再把页面留在“需要重试”。

当前仍未宣称完成：

- 官方真实 provider smoke。也就是在你的火山环境里确认 StartSession payload、音频容器、返回音频格式完全匹配。
- provider audio delta 的真实播放质量和延迟。
- 真实 10 轮电话式对话验收。
- 自动智能打断的生产级方案。当前本地 RMS VAD 已默认开启并加入环境噪声校准、连续命中和冷却防抖，但仍只是浏览器端轻量方案；下一步应复现 Silero/WebRTC VAD、LiveKit Agents 或 Pipecat 的 turn-taking/interruption 方案。
