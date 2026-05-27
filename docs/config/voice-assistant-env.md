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
| `DOUBAO_REALTIME_CONNECT_TIMEOUT_MS` | 否 | `3500` | 服务端连接上游 WebSocket 的超时时间。 |

兼容别名：

- `VOLC_REALTIME_BASE_URL` -> `DOUBAO_REALTIME_ENDPOINT`
- `VOLC_APP_ID` -> `DOUBAO_REALTIME_APP_ID`
- `VOLC_ACCESS_KEY` -> `DOUBAO_REALTIME_ACCESS_KEY`
- `VOLC_APP_KEY` -> `DOUBAO_REALTIME_APP_KEY`
- `VOLC_RESOURCE_ID` -> `DOUBAO_REALTIME_RESOURCE_ID`
- `VOLC_REALTIME_MODEL` -> `DOUBAO_REALTIME_MODEL`

## 保护开关

以下变量默认不启用，只有在官方二进制协议编解码完成并经过 provider smoke 后才允许打开。

| 变量 | 默认 | 含义 |
|---|---|---|
| `DOUBAO_REALTIME_FORWARD_RAW_AUDIO` | `false` | 是否把浏览器上传的音频 chunk 原样转发给上游 WebSocket。默认关闭，避免误发错误协议帧。 |
| `DOUBAO_REALTIME_FORWARD_JSON_EVENTS` | `false` | 是否向上游发送 JSON 控制帧。默认关闭，避免把非官方协议当成 interrupt/cancel。 |

## 当前验收边界

当前代码已做到：

- 浏览器可用 `MediaRecorder` 采集音频 chunk。
- 前端把音频 chunk 发送到 `/api/voice/realtime`。
- 服务端创建 realtime session，保管 provider 凭证。
- 服务端能构造火山官方 header，并具备带自定义 header 的上游 WebSocket 握手能力。
- 打断会清理本地播放队列并进入服务端 realtime interrupt。

当前仍未宣称完成：

- Doubao 二进制协议帧编解码。
- `StartConnection` / `StartSession` / `TaskRequest` / `ClientInterrupt` 的官方帧发送。
- provider audio delta 的真实播放。
- 真实 10 轮电话式对话验收。
