# Voice Assistant Environment Config

日期：2026-05-28

本文件只记录变量名和用途，不记录真实密钥。真实值只能放在 `.env.local`、部署平台 secret 或其他 secret storage，不能提交到 Git。

## Doubao/Volcengine Realtime Voice

端到端实时语音大模型当前使用火山/豆包旧控制台鉴权头。服务端会读取这些变量并构造上游 WebSocket header，浏览器永远不应看到这些值。

| 变量 | 必填 | 示例/默认 | 含义 |
|---|---:|---|---|
| `DOUBAO_REALTIME_ENABLED` | 是 | `true` | 是否启用真实 realtime 语音链路。不是 `true` 时，`/voice-assistant` 使用浏览器 ASR + 服务端高音色 TTS/字幕 fallback。 |
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
| 无 | - | - | 当前不再使用会被播报和入库的“快速确认话术”。慢响应只通过 SSE `status` 和页面状态表达，不进入正式 assistant delta、TTS 或记忆。 |

## High-quality TTS Fallback

该 fallback 只用于 `ASR + LLM + TTS` 备选链路。正式主线仍优先走 Doubao realtime audio delta。浏览器 `speechSynthesis` 不再作为 `/voice-assistant` 的正式语音输出。

| 变量 | 必填 | 示例/默认 | 含义 |
|---|---:|---|---|
| `VOICE_TTS_PROVIDER` | 否 | `minimax` | 高音色 TTS fallback 供应商。当前可用值：`minimax`、`disabled`。`doubao` 已保留配置方向，但本轮不启用独立 TTS adapter。 |
| `MINIMAX_API_KEY` | 是 | 不写入仓库 | MiniMax TTS WebSocket 鉴权。只放 `.env.local` 或部署 secret。 |
| `MINIMAX_TTS_ENDPOINT` | 否 | `wss://api.minimaxi.com/ws/v1/t2a_v2` | MiniMax WebSocket T2A v2 地址。 |
| `MINIMAX_TTS_MODEL` | 否 | `speech-2.8-turbo` | 优先选择 Turbo，目标是降低合成等待并保持较自然音色。 |
| `MINIMAX_TTS_VOICE_ID` | 否 | `male-qn-qingse` | 音色 ID。默认采用 MiniMax 官方示例音色，真实验收时应在 MiniMax 控制台换成更适合银发陪伴的温和中文音色。 |
| `MINIMAX_TTS_FORMAT` | 否 | `mp3` | 输出格式，可选 `mp3`、`wav`、`pcm`。浏览器 fallback 建议先用 `mp3`，兼容性最好。 |
| `MINIMAX_TTS_SAMPLE_RATE` | 否 | `32000` | 输出采样率。 |
| `MINIMAX_TTS_BITRATE` | 否 | `128000` | 输出码率。 |
| `MINIMAX_TTS_SPEED` | 否 | `0.95` | 语速。银发陪伴场景略慢一点更稳。 |
| `MINIMAX_TTS_VOLUME` | 否 | `1` | 音量倍率。 |
| `MINIMAX_TTS_PITCH` | 否 | `0` | 音高。 |
| `MINIMAX_TTS_CONNECT_TIMEOUT_MS` | 否 | `3500` | TTS WebSocket 建连超时。 |
| `MINIMAX_TTS_SYNTHESIS_TIMEOUT_MS` | 否 | `12000` | 单段文本合成超时。 |

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
- 流式接口不再发送“我先想一下”这类正式 delta。SSE 打开后只发送 UI-only `status` 事件，正式回复只来自模型或安全 fallback。
- `/voice-assistant` 已增加 `turnId` 旧响应丢弃：新一轮开始会 abort 旧请求，旧流即使晚返回也不能继续改字幕、播报或写候选记忆。
- Demo fallback 不再使用浏览器 `speechSynthesis` 音色；已新增 `/api/voice/tts` 服务端高音色 TTS fallback。未配置 MiniMax TTS 时页面只显示大字幕，不用浏览器劣质音色冒充正式效果。
- 页面新增电话式 UI：自绘动漫 AI 形象、说话口型、聆听光环、麦克风音量波动、声纹条、挂断按钮、字幕开关和默认开启的自动打断开关。
- 页面启动时会自动处理本地过期 token：如果 session 创建返回未登录，会重新创建测试用户并重试，避免页面一直停在“未登录或 token 已过期”。
- 如果浏览器没有开放麦克风权限，自动打断会降级关闭并保留文字测试，不再把页面留在“需要重试”。

当前仍未宣称完成：

- 官方真实 provider smoke。也就是在你的火山环境里确认 StartSession payload、音频容器、返回音频格式完全匹配。
- provider audio delta 的真实播放质量和延迟。
- 真实 10 轮电话式对话验收。
- 自动智能打断的生产级方案。当前本地 RMS VAD 已默认开启并加入环境噪声校准、连续命中和冷却防抖，但仍只是浏览器端轻量方案；下一步应优先接 `@ricky0123/vad-web` 这类基于 Silero VAD + ONNX Runtime Web 的浏览器方案，再接 turn-taking/endpointing。
