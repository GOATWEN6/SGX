const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
const { readFile } = await import('node:fs/promises');

const results = [];
let token = '';
let userId = '';
let conversationSessionId = '';
let voiceSessionId = '';
let candidateIds = [];
const doubaoConfigured = Boolean(
  process.env.DOUBAO_REALTIME_ENABLED === 'true'
  && (process.env.DOUBAO_REALTIME_APP_ID || process.env.VOLC_APP_ID)
  && (process.env.DOUBAO_REALTIME_ACCESS_KEY || process.env.VOLC_ACCESS_KEY)
  && (process.env.DOUBAO_REALTIME_APP_KEY || process.env.VOLC_APP_KEY),
);

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
}

function expect(condition, name, detail = '') {
  record(name, Boolean(condition), detail);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

async function createUser() {
  const { response, body } = await request('/api/user', {
    method: 'POST',
    body: JSON.stringify({
      action: 'create',
      name: `测试老人${Date.now()}`,
      ageGroup: '75-80',
      gender: 'female',
      birthPlace: '江苏南京',
      useHonorific: true,
      preferredStyle: 'narrative',
      conversationDuration: 10,
      memoirGoal: 'family_heirloom',
    }),
  });
  expect(response.status === 200 && body.success, '创建测试老人用户');
  token = body.data?.token || '';
  userId = body.data?.user?.id || '';
  expect(Boolean(token && userId), '创建用户返回 token 和 userId');
}

async function startConversation() {
  const { response, body } = await request('/api/conversation/session/start', {
    method: 'POST',
    body: JSON.stringify({ mode: 'web_voice_call', conversationType: 'ai_chat' }),
  });
  conversationSessionId = body.data?.session?.id || '';
  expect(response.status === 200 && body.success, '启动基础对话 session', JSON.stringify({ status: response.status, body }));
  expect(body.data?.session?.mode === 'web_voice_call', 'session mode 为 web_voice_call', JSON.stringify(body.data?.session || body));
  expect(body.data?.session?.conversationType === 'ai_chat', 'conversationType 为 ai_chat', JSON.stringify(body.data?.session || body));
}

async function startVoiceSession() {
  const { response, body } = await request('/api/voice/session/start', {
    method: 'POST',
    body: JSON.stringify({ conversationSessionId }),
  });
  voiceSessionId = body.data?.voiceSession?.id || '';
  expect(response.status === 200 && body.success, '启动 voice session');
  expect(body.data?.voiceSession?.provider === 'doubao', 'voice provider 标记为 doubao');
  expect(body.data?.voiceSession?.fallbackMode === !doubaoConfigured, 'voice fallbackMode 与豆包配置状态一致');
}

async function sendMessage(message, assertions) {
  const { response, body } = await request('/api/conversation/message', {
    method: 'POST',
    body: JSON.stringify({ sessionId: conversationSessionId, message }),
  });
  expect(response.status === 200 && body.success, `发送消息成功：${message}`, JSON.stringify({ status: response.status, body }));
  if (body.data?.memoryCandidates?.length) {
    candidateIds.push(...body.data.memoryCandidates.map(candidate => candidate.id));
  }
  assertions?.(body.data);
  return body.data;
}

async function runConversationCases() {
  await sendMessage('我今天想随便聊几句。', data => {
    expect(typeof data.message === 'string' && data.message.length > 0, '普通闲聊返回 AI 回复');
    expect(data.usedWebSearch === false, '普通闲聊不触发联网');
  });

  await sendMessage('我喜欢早上听戏，下午看看照片。', data => {
    expect(data.memoryCandidates?.[0]?.type === 'preference', '偏好表达生成 preference 候选记忆');
    expect(data.memoryCandidates?.[0]?.status === 'pending_elder_confirm', '候选记忆默认待老人确认');
  });

  await sendMessage('我女儿每周都会来看我。', data => {
    expect(data.memoryCandidates?.[0]?.type === 'family_member', '家庭成员表达生成 family_member 候选记忆');
  });

  await sendMessage('别再提我以前生病的事。', data => {
    expect(data.memoryCandidates?.[0]?.type === 'taboo_topic', '禁忌表达生成 taboo_topic 候选记忆');
  });

  await sendMessage('我年轻时在厂里工作了三十年。', data => {
    expect(data.memoryCandidates?.[0]?.type === 'life_event', '人生经历生成 life_event 候选记忆');
  });

  await sendMessage('今天南京天气怎么样？', data => {
    expect(data.usedWebSearch === true, '天气问题触发受控联网工具');
    expect(Array.isArray(data.citations), '联网响应包含 citations 数组');
  });

  await sendMessage('最近有什么新闻？', data => {
    expect(data.usedWebSearch === true, '新闻问题触发受控联网工具');
  });

  await sendMessage('我头晕应该吃什么药？', data => {
    expect(data.usedWebSearch === true, '健康用药问题进入工具/风险链路');
    expect(data.riskFlags?.includes('high_risk_professional_advice'), '高风险用药问题打风险标记');
  });
}

async function testMemoryCandidateActions() {
  const candidatesResponse = await request('/api/memory/candidates?status=pending_elder_confirm');
  expect(candidatesResponse.response.status === 200 && candidatesResponse.body.success, '查询待确认候选记忆');
  const candidates = candidatesResponse.body.data?.candidates || [];
  expect(candidates.length >= 4, '多轮对话产生多个待确认候选记忆', `actual=${candidates.length}`);

  const first = candidates[0];
  if (first) {
    const confirmResponse = await request(`/api/memory/candidates/${first.id}/confirm`, { method: 'POST' });
    expect(confirmResponse.response.status === 200 && confirmResponse.body.success, '确认候选记忆');
    expect(confirmResponse.body.data?.candidate?.status === 'confirmed', '确认后状态为 confirmed');
  }

  const second = candidates[1];
  if (second) {
    const rejectResponse = await request(`/api/memory/candidates/${second.id}/reject`, { method: 'POST' });
    expect(rejectResponse.response.status === 200 && rejectResponse.body.success, '拒绝候选记忆');
    expect(rejectResponse.body.data?.candidate?.status === 'rejected', '拒绝后状态为 rejected');
  }
}

async function testVoiceInterrupt() {
  const { response, body } = await request('/api/voice/session/interrupt', {
    method: 'POST',
    body: JSON.stringify({ voiceSessionId, reason: 'user_speech' }),
  });
  expect(response.status === 200 && body.success, '语音会话支持 interrupt API');
  expect(body.data?.voiceSession?.state === 'interrupted', 'interrupt 后语音状态为 interrupted');
  expect(body.data?.voiceSession?.interruptionCount >= 1, 'interrupt 递增 interruptionCount');

  const secondUser = await request('/api/user', {
    method: 'POST',
    body: JSON.stringify({
      action: 'create',
      name: `越权用户${Date.now()}`,
      ageGroup: '70-75',
      useHonorific: true,
      preferredStyle: 'narrative',
      memoirGoal: 'self',
    }),
  });
  const secondToken = secondUser.body.data?.token;
  const forbidden = await fetch(`${baseUrl}/api/voice/session/interrupt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secondToken}`,
    },
    body: JSON.stringify({ voiceSessionId, reason: 'user_speech' }),
  });
  expect(forbidden.status === 404, '其他用户不能 interrupt 当前 voice session');
}

async function endSessionAndCheckSummary() {
  const endResponse = await request('/api/conversation/session/end', {
    method: 'POST',
    body: JSON.stringify({ sessionId: conversationSessionId }),
  });
  expect(endResponse.response.status === 200 && endResponse.body.success, '结束基础对话 session');
  expect(endResponse.body.data?.summary?.bulletSummary?.length > 0, '结束时生成子女可见摘要');
  expect(endResponse.body.data?.summary?.memoryCandidateIds?.length > 0, '摘要关联候选记忆');
  expect(endResponse.body.data?.summary?.interviewMaterialIds?.length > 0, '摘要关联访谈素材');

  const summaryResponse = await request(`/api/conversation/sessions/${conversationSessionId}/summary`);
  expect(summaryResponse.response.status === 200 && summaryResponse.body.success, '按 session 查询子女摘要');

  const sessionsResponse = await request('/api/conversation/sessions');
  expect(sessionsResponse.response.status === 200 && sessionsResponse.body.success, '查询会话列表和摘要列表');

  const voiceEndResponse = await request('/api/voice/session/end', {
    method: 'POST',
    body: JSON.stringify({ voiceSessionId }),
  });
  expect(voiceEndResponse.response.status === 200 && voiceEndResponse.body.success, '结束 voice session');

  const endedMessage = await request('/api/conversation/message', {
    method: 'POST',
    body: JSON.stringify({ sessionId: conversationSessionId, message: '结束后不应该还能写入' }),
  });
  expect(endedMessage.response.status === 409, '已结束 conversation 不允许继续写消息');
}

async function negativeCases() {
  const unauthorized = await fetch(`${baseUrl}/api/conversation/sessions`);
  const unauthorizedBody = await unauthorized.json();
  expect(unauthorized.status === 401, '未登录访问会话列表返回 401');
  expect(unauthorizedBody.success === false, '未登录响应 success=false');

  const badMessage = await request('/api/conversation/message', {
    method: 'POST',
    body: JSON.stringify({ sessionId: conversationSessionId, message: '' }),
  });
  expect(badMessage.response.status === 400, '空消息返回 400');

  const badCandidate = await request('/api/memory/candidates/not-a-real-id/confirm', { method: 'POST' });
  expect(
    badCandidate.response.status === 404,
    '不存在候选记忆返回 404',
    JSON.stringify({ status: badCandidate.response.status, body: badCandidate.body })
  );

  const badStatus = await request('/api/memory/candidates?status=bad_status');
  expect(badStatus.response.status === 400, '非法候选记忆 status 返回 400');

  const badIntent = await request('/api/tools/search', {
    method: 'POST',
    body: JSON.stringify({ sessionId: conversationSessionId, query: '测试', intent: 'free_web' }),
  });
  expect(badIntent.response.status === 400, '非法联网 intent 返回 400');
}

async function staticFrontendChecks() {
  const pageSource = await readFile(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
  expect(pageSource.includes('startFrameBargeInMonitor'), '前端包含自动打断 VAD 启动逻辑');
  expect(pageSource.includes('getUserMedia'), '前端自动打断会申请麦克风音频流');
  expect(pageSource.includes('getByteTimeDomainData'), '前端自动打断使用 Web Audio 采样检测音量');
  expect(pageSource.includes("interruptFrameSpeech('user_speech')"), 'VAD 命中后调用 user_speech interrupt');
  expect(pageSource.includes('stopFrameBargeInMonitor'), '退出/卸载时清理 VAD 音频资源');
  expect(pageSource.includes('frameRecognitionSentRef'), '前端语音识别 final 结果有一次性发送锁');
  expect(pageSource.includes('AbortController'), '前端退出通话会取消未完成消息请求');

  const standalonePageSource = await readFile(new URL('../src/app/voice-assistant/page.tsx', import.meta.url), 'utf8');
  const standaloneStyleSource = await readFile(new URL('../src/app/voice-assistant/voice-assistant.module.css', import.meta.url), 'utf8');
  const standaloneStreamRouteSource = await readFile(new URL('../src/app/api/conversation/message/stream/route.ts', import.meta.url), 'utf8');
  const ttsRouteSource = await readFile(new URL('../src/app/api/voice/tts/route.ts', import.meta.url), 'utf8').catch(() => '');
  const ttsConfigSource = await readFile(new URL('../src/lib/voice/tts/config.ts', import.meta.url), 'utf8').catch(() => '');
  const doubaoTtsProviderSource = await readFile(new URL('../src/lib/voice/tts/doubao-provider.ts', import.meta.url), 'utf8').catch(() => '');
  const minimaxTtsProviderSource = await readFile(new URL('../src/lib/voice/tts/minimax-provider.ts', import.meta.url), 'utf8').catch(() => '');
  expect(standalonePageSource.includes('AI 语音助手'), '存在独立 AI 语音助手页面');
  expect(standalonePageSource.includes("body: JSON.stringify({ mode: 'web_voice_call', conversationType: 'ai_chat' })"), '独立页面启动 web_voice_call 对话');
  expect(standalonePageSource.includes('startBargeInMonitor'), '独立页面包含自动打断 VAD 逻辑');
  expect(standalonePageSource.includes('/api/conversation/message/stream'), '独立页面使用流式文字回复接口');
  expect(standalonePageSource.includes("voiceStateRef.current === 'thinking'") && standalonePageSource.includes("setVoiceState('speaking')"), '独立页面收到首个 delta 后立即进入 AI 说话状态');
  expect(standalonePageSource.includes('activeTurnIdRef'), '独立页面用 turnId 标记当前文本轮次');
  expect(standalonePageSource.includes('isCurrentTurn'), '独立页面丢弃旧文本流事件，避免上一问回答串到下一问');
  expect(standalonePageSource.includes('enqueueAssistantDisplayDelta'), '独立页面把模型增量放入逐字字幕队列');
  expect(standalonePageSource.includes('waitForAssistantDisplayQueue'), '独立页面在关闭流式消息前等待逐字字幕完成');
  expect(standalonePageSource.includes('speechQueueRef'), '独立页面使用服务端高音色 TTS 分句队列');
  expect(standalonePageSource.includes('/api/voice/tts'), '独立页面通过服务端高音色 TTS fallback 播放语音');
  expect(!standalonePageSource.includes('new SpeechSynthesisUtterance'), '独立页面不再把浏览器 SpeechSynthesis 作为正式语音输出');
  expect(standalonePageSource.includes('SPEECH_COMMIT_DELAY_MS'), '独立页面为浏览器 ASR 保留停顿缓冲时间');
  expect(standalonePageSource.includes('const SPEECH_COMMIT_DELAY_MS = 1200'), '独立页面浏览器 ASR 静默提交时间约为 1.2 秒');
  expect(!standalonePageSource.includes('1.6 秒'), '独立页面不再提示用户等待 1.6 秒');
  expect(standalonePageSource.includes('pendingFinalTranscriptRef'), '独立页面会累积多段 ASR final 结果');
  expect(standalonePageSource.includes('scheduleSpeechCommit'), '独立页面不会在 0.3 秒短停顿后立刻发送');
  expect(standalonePageSource.includes('const pendingText = buildSpeechDraft();'), '独立页面 ASR 静默提交会同时检查 final 和 interim 文本');
  expect(standalonePageSource.includes('const text = buildSpeechDraft() || input.trim();'), '独立页面静默发送不会丢掉只有 interim 的语音识别结果');
  expect(standalonePageSource.includes('interimTranscriptRef.current = interimText;') && standalonePageSource.includes('scheduleSpeechCommit();'), '独立页面收到 interim 文本后也会安排静默提交');
  expect(standalonePageSource.includes('flushSpeechCommit'), '独立页面支持手动或静默超时提交整段话');
  expect(standalonePageSource.includes('recognitionRef.current.continuous = true'), '独立页面浏览器 ASR 使用 continuous 模式');
  expect(standalonePageSource.includes('recognitionRef.current.maxAlternatives = 3'), '独立页面浏览器 ASR 请求多个候选');
  expect(standalonePageSource.includes('pickBestSpeechRecognitionAlternative'), '独立页面会优先采用最高置信度的 ASR 候选');
  expect(!standalonePageSource.includes('sendMessage(finalText);'), '独立页面不再拿第一段 finalText 直接发给模型');
  expect(standalonePageSource.includes("isSpeakingRef.current || voiceStateRef.current === 'thinking'"), '独立页面可在 thinking/speaking 阶段打断并继续说');
  expect(!standalonePageSource.includes("disabled={voiceState === 'thinking' || voiceState === 'booting'}"), '独立页面 thinking 阶段麦克风不被禁用');
  expect(standalonePageSource.includes('loadTtsStatus'), '独立页面启动时检查高音色 TTS 是否可用');
  expect(standalonePageSource.includes('未配置豆包高音色 TTS，所以不会出声'), '独立页面明确解释只出字幕没声音的原因');
  expect(ttsRouteSource.includes('synthesizeSpeech'), '服务端 TTS fallback 有独立 API 路由');
  expect(ttsConfigSource.includes('DOUBAO_TTS_API_KEY') && ttsConfigSource.includes('seed-tts-1.0'), '服务端 TTS fallback 默认优先支持豆包 TTS');
  expect(doubaoTtsProviderSource.includes('X-Api-Resource-Id') && doubaoTtsProviderSource.includes('req_params'), '豆包 TTS provider 使用火山 V3 TTS 请求头和 req_params');
  expect(doubaoTtsProviderSource.includes("namespace: 'BidirectionalTTS'") && doubaoTtsProviderSource.includes('isSupportedReqModel') && doubaoTtsProviderSource.includes('reqParams.model = config.model'), '豆包 TTS provider 只在 V3 支持时发送 namespace 和模型字段');
  expect(ttsConfigSource.includes('MINIMAX_TTS_MODEL') && ttsConfigSource.includes('speech-2.8-turbo'), '服务端 TTS fallback 保留 MiniMax Speech 2.8 Turbo 备选');
  expect(minimaxTtsProviderSource.includes('task_continue'), 'MiniMax TTS provider 使用 WebSocket task_continue 发送文本');
  expect(standalonePageSource.includes('startMicMeter'), '独立页面包含麦克风音量波动检测');
  expect(standalonePageSource.includes('autoBargeInEnabled'), '独立页面把自动打断做成显式开关');
  expect(standalonePageSource.includes('useState(true);') && standalonePageSource.includes('setAutoBargeInEnabled'), '独立页面默认开启自动语音打断');
  expect(standalonePageSource.includes("import('@ricky0123/vad-web')") && standalonePageSource.includes('MicVAD.new'), '独立页面使用 @ricky0123/vad-web / Silero VAD 做自动语音打断');
  expect(standalonePageSource.includes("baseAssetPath: VAD_ASSET_BASE_PATH") && standalonePageSource.includes("onnxWASMBasePath: VAD_ONNX_WASM_BASE_PATH"), '独立页面显式从 public /vad 加载 Silero VAD 和 ONNX wasm 资源');
  expect(standalonePageSource.includes('positiveSpeechThreshold') && standalonePageSource.includes('redemptionMs'), '独立页面配置 Silero VAD 阈值和冷却参数减少误触发');
  expect(standalonePageSource.includes('lastAutoInterruptAtRef'), '独立页面对自动打断做冷却防抖');
  expect(standalonePageSource.includes('setAutoBargeInEnabled(false)'), '独立页面在自动打断无麦克风权限时会降级关闭');
  expect(standalonePageSource.includes('if (options.auto)') && standalonePageSource.includes("setVoiceState('idle')"), '独立页面自动续听失败不把页面留在错误态');
  expect(standalonePageSource.includes("action: 'append_audio'"), '独立页面会上传 realtime 音频 chunk');
  expect(standalonePageSource.includes('REALTIME_PCM_SAMPLE_RATE = 16000'), '独立页面 realtime 主链路使用 16k PCM16 采集');
  expect(standalonePageSource.includes('AudioWorkletNode') || standalonePageSource.includes('audioWorklet'), '独立页面优先使用 AudioWorklet 采集实时麦克风');
  expect(standalonePageSource.includes("codec: 'pcm16'"), '独立页面上传 pcm16 音频而不是 WebM 容器');
  expect(standalonePageSource.includes("action: 'poll_output'"), '独立页面会轮询 provider audio delta');
  expect(standalonePageSource.includes('/api/memory/candidates/${candidateId}/${action}'), '独立页面支持候选记忆确认/拒绝');
  expect(standalonePageSource.includes('data-testid="anime-avatar"'), '独立页面渲染自绘动漫 AI 角色');
  expect(standalonePageSource.includes('您直接说话即可打断'), '独立页面把打断方式说明为直接说话');
  expect(standaloneStyleSource.includes('.captionPanel'), '独立页面包含大字幕样式');
  expect(standaloneStyleSource.includes('.micButton'), '独立页面包含主语音按钮样式');
  expect(standaloneStyleSource.includes('.soundWave'), '独立页面包含动态声纹样式');
  expect(standaloneStyleSource.includes('.animeAvatar'), '独立页面包含动漫 AI 形象样式');
  expect(standaloneStyleSource.includes('@keyframes mouthOpenFrame'), '动漫角色包含说话口型动画');
  expect(standaloneStyleSource.includes('.avatarListeningRing'), '动漫角色包含聆听状态动画');
  expect(standaloneStreamRouteSource.includes("write('status'"), '流式接口只把思考状态作为 UI-only status 事件');
  expect(!standaloneStreamRouteSource.includes('immediateAck'), '流式接口不再把即时确认作为正式回复内容');
  expect(!standaloneStreamRouteSource.includes('我听到了，我先想一下'), '流式接口不再硬编码会被播报和入库的思考提示');
  expect(standaloneStreamRouteSource.includes('maxTokens: 320'), '语音助手流式回复限制 token 数以降低延迟');
}

function printReport() {
  const passed = results.filter(result => result.passed).length;
  const failed = results.length - passed;
  const issues = [
    'Doubao 二进制协议 codec/translator 已接入，但真实 provider smoke 仍需要用户配置 DOUBAO_REALTIME_FORWARD_BINARY_PROTOCOL=true 后验收。',
    '浏览器端已改为 Web Audio / AudioWorklet PCM16 chunk；仍需用真实 Doubao realtime 凭证做 provider smoke 验收。',
    '浏览器端已接入 @ricky0123/vad-web / Silero VAD；仍需用真实播放场景做 10 次语音打断验收并调参。',
    '联网工具默认未配置 SEARCH_API_ENDPOINT 时不会产生真实 citations，天气/新闻只能证明意图识别和安全降级。',
    'LLM 未配置时会走 fallback 回复，无法验证真实模型口语质量、追问质量和 prompt 遵循。',
    '记忆候选提取是规则型关键词，容易漏掉隐含偏好、复杂家庭关系和方言表达，也可能把长句误判为 quote。',
    '子女摘要当前按用户消息截取，不是 LLM 语义摘要；隐私粒度和风险摘要还偏粗。',
    '当前数据仍是 JSON 文件存储，并发写入和多家庭空间隔离还没有达到生产级。',
    '主页面里的电话入口仍接在现有相框界面；另有独立 /voice-assistant 页面用于只测 AI 语音助手链路。',
  ];

  console.log(JSON.stringify({ baseUrl, passed, failed, total: results.length, results, issues }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

try {
  await createUser();
  await startConversation();
  await startVoiceSession();
  await runConversationCases();
  await testMemoryCandidateActions();
  await testVoiceInterrupt();
  await endSessionAndCheckSummary();
  await negativeCases();
  await staticFrontendChecks();
} catch (error) {
  record('测试脚本运行异常', false, String(error?.stack || error));
} finally {
  printReport();
}
