# 语音助手 VAD 与高音色 TTS 备选方案评估

日期：2026-05-28

## 目标

当前 `/voice-assistant` 的主目标是把电话式语音链路跑通：老人说话、AI 实时回复、老人插话时自动打断。主线仍是 Doubao realtime audio delta；高音色 TTS 只作为 `ASR + LLM + TTS` 的备选链路，不能替代真实 realtime provider 的验收。

## VAD/打断

优先方向：`@ricky0123/vad-web`。

原因：

- 它是浏览器 JavaScript VAD，底层使用 Silero VAD + ONNX Runtime Web，适合当前 Next.js 前端页。
- 它提供 `onSpeechStart` / `onSpeechEnd` 回调，刚好对应我们的自动打断和端点检测需求。
- 官方 Silero VAD 强项是轻量、跨语言、ONNX 可部署；适合中文老人语音场景先做前台网页验证。

接入切片：

1. 加依赖：`@ricky0123/vad-web` 和随包资源。
2. 把当前 RMS `startBargeInMonitor` 改成 provider 接口：`rms` 与 `silero` 两种实现可切换。
3. `onSpeechStart` 时立刻执行 `interruptSpeech('user_speech')`，清空播放队列并取消旧响应。
4. `onSpeechEnd(audio)` 后续可用于更稳定的端点检测，先不直接替代 realtime provider 音频上传。

暂不本轮安装依赖的原因：需要网络下载 npm 包和 ONNX/WASM 资源，属于外部依赖变更，应单独提交并做浏览器麦克风实测。

## TTS Fallback

本轮已落地：服务端豆包 TTS V3 HTTP Chunked provider 骨架，前端不再使用浏览器 `speechSynthesis` 作为正式音色。

选择豆包 TTS 作为默认 fallback 的原因：

- 与主线 Doubao realtime provider 同属火山/豆包语音体系，后续账号、计费、音色管理更一致。
- 官方语音合成 V3 支持 HTTP Chunked/SSE/WebSocket 多种接口，本阶段先用 HTTP Chunked 收齐音频后播放，下一阶段再升级为真正双向流式 TTS。
- 默认音色走偏年轻、清亮的“阳光青年”方向；真实验收时必须用控制台里与 `DOUBAO_TTS_RESOURCE_ID` 匹配的 speaker。

MiniMax `speech-2.8-turbo` 仍保留为备选的原因：

- 官方文档标注它面向极速生成，并提供 WebSocket T2A v2。
- WebSocket 事件模型简单：`task_start` -> `task_continue` -> 音频数据 -> `task_finish`，适合做横向对比。
- 如果豆包 TTS 音色或鉴权暂时没有开通，仍可短期切回 MiniMax 做体验验证。

## 参考来源

- Silero VAD: https://github.com/snakers4/silero-vad
- Browser Silero VAD wrapper: https://github.com/ricky0123/vad
- MiniMax WebSocket TTS API: https://platform.minimaxi.com/docs/api-reference/speech-t2a-websocket
- MiniMax Speech guide: https://platform.minimaxi.com/docs/guides/speech-t2a-websocket
- 火山 TTS WebSocket API: https://www.volcengine.com/docs/6489/80993
- Doubao Realtime TTS gateway: https://www.volcengine.com/docs/6893/1527770
- 火山 TTS V3 接口列表: https://www.volcengine.com/docs/6561/2228192
