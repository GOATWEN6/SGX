const { readFile } = await import('node:fs/promises');

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
}

async function readText(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function readOptionalText(path) {
  try {
    return await readText(path);
  } catch {
    return '';
  }
}

function expect(condition, name, detail = '') {
  record(name, Boolean(condition), detail);
}

async function runStaticContractChecks() {
  const [
    typesSource,
    stateMachineSource,
    sessionStoreSource,
    doubaoConfigSource,
    doubaoCodecSource,
    doubaoTranslatorSource,
    doubaoProviderSource,
    headerWebSocketSource,
    voiceIndexSource,
    realtimeRouteSource,
    conversationStreamRouteSource,
    voiceAssistantPageSource,
    voiceTtsRouteSource,
    voiceTtsConfigSource,
    doubaoTtsProviderSource,
    minimaxTtsProviderSource,
    llmClientSource,
    llmProviderSource,
    stateMachineCasesSource,
    secretScanSource,
  ] = await Promise.all([
    readText('src/lib/voice/realtime/types.ts'),
    readText('src/lib/voice/realtime/state-machine.ts'),
    readText('src/lib/voice/realtime/session-store.ts'),
    readText('src/lib/voice/realtime/doubao-config.ts'),
    readText('src/lib/voice/realtime/doubao-codec.ts'),
    readText('src/lib/voice/realtime/doubao-translator.ts'),
    readText('src/lib/voice/realtime/doubao-provider.ts'),
    readText('src/lib/voice/realtime/header-websocket.ts'),
    readText('src/lib/voice/index.ts'),
    readText('src/app/api/voice/realtime/route.ts'),
    readText('src/app/api/conversation/message/stream/route.ts'),
    readText('src/app/voice-assistant/page.tsx'),
    readOptionalText('src/app/api/voice/tts/route.ts'),
    readOptionalText('src/lib/voice/tts/config.ts'),
    readOptionalText('src/lib/voice/tts/doubao-provider.ts'),
    readOptionalText('src/lib/voice/tts/minimax-provider.ts'),
    readText('src/lib/llm/client.ts'),
    readText('src/lib/llm/providers/openai-compatible.ts'),
    readText('harness/voice-assistant/state-machine-cases.json'),
    readText('scripts/voice-secret-scan.mjs'),
  ]);

  const cases = JSON.parse(stateMachineCasesSource);

  for (const state of cases.states) {
    expect(typesSource.includes(`'${state}'`), `RealtimeVoiceState includes ${state}`);
    expect(stateMachineSource.includes(`'${state}'`), `state-machine references ${state}`);
  }

  for (const transition of cases.validTransitions) {
    expect(
      stateMachineSource.includes(`${transition.event}: '${transition.to}'`),
      `valid transition encoded: ${transition.from} + ${transition.event} -> ${transition.to}`
    );
  }

  for (const invalid of cases.invalidTransitionChecks) {
    expect(
      !stateMachineSource.includes(`${invalid.event}: '${invalid.to}'`),
      `invalid transition absent: ${invalid.from} -> ${invalid.to}`
    );
  }

  expect(typesSource.includes('toLegacyVoiceState'), 'realtime states can map to legacy page/API states');
  expect(sessionStoreSource.includes('appendRealtimeAudioChunk'), 'session store records audio chunks');
  expect(sessionStoreSource.includes('staleResponseGuard'), 'session store tracks stale-response guard after interrupt');
  expect(sessionStoreSource.includes('interruptRealtimeVoiceSession'), 'session store exposes interrupt operation');
  expect(voiceIndexSource.includes("export * from './realtime'"), 'voice index exports realtime module');
  expect(realtimeRouteSource.includes("action === 'append_audio'"), 'realtime route accepts append_audio action');
  expect(realtimeRouteSource.includes("action === 'interrupt'"), 'realtime route accepts interrupt action');
  expect(realtimeRouteSource.includes('isDoubaoRealtimeConfigured'), 'realtime route keeps provider config on server');
  expect(!realtimeRouteSource.includes('process.env.DOUBAO_REALTIME_API_KEY,'), 'realtime route does not return provider key');
  expect(doubaoConfigSource.includes('X-Api-App-ID'), 'Doubao config builds official app id header');
  expect(doubaoConfigSource.includes('X-Api-Access-Key'), 'Doubao config builds official access key header');
  expect(doubaoConfigSource.includes('X-Api-App-Key'), 'Doubao config builds official app key header');
  expect(doubaoConfigSource.includes('X-Api-Resource-Id'), 'Doubao config builds official resource id header');
  expect(doubaoConfigSource.includes('volc.speech.dialog'), 'Doubao config defaults to realtime dialogue resource');
  expect(doubaoConfigSource.includes("return 'pcm16'"), 'Doubao config defaults realtime input format to pcm16');
  expect(doubaoConfigSource.includes("readNumber(16000, 'DOUBAO_REALTIME_INPUT_SAMPLE_RATE')"), 'Doubao config declares 16k default input sample rate');
  expect(doubaoConfigSource.includes('DOUBAO_REALTIME_FORWARD_BINARY_PROTOCOL'), 'Doubao config gates binary protocol forwarding');
  expect(doubaoConfigSource.includes('DOUBAO_REALTIME_SESSION_PARAMS_JSON'), 'Doubao config allows official session payload override');
  expect(doubaoCodecSource.includes('encodeDoubaoFrame'), 'Doubao codec encodes binary protocol frames');
  expect(doubaoCodecSource.includes('decodeDoubaoFrame'), 'Doubao codec decodes binary protocol frames');
  expect(doubaoCodecSource.includes('DOUBAO_PROTOCOL_HEADER_BYTES'), 'Doubao codec validates protocol header size');
  expect(doubaoTranslatorSource.includes('StartConnection'), 'Doubao translator builds StartConnection frame');
  expect(doubaoTranslatorSource.includes('StartSession'), 'Doubao translator builds StartSession frame');
  expect(doubaoTranslatorSource.includes('TaskRequest'), 'Doubao translator builds audio TaskRequest frame');
  expect(doubaoTranslatorSource.includes('ClientInterrupt'), 'Doubao translator builds ClientInterrupt frame');
  expect(doubaoProviderSource.includes('decodeDoubaoFrame'), 'Doubao provider decodes provider frames through codec');
  expect(doubaoProviderSource.includes('translateDoubaoFrameToRealtimeOutput'), 'Doubao provider translates decoded frames');
  expect(doubaoProviderSource.includes('buildDoubaoAudioTaskFrame'), 'Doubao provider sends encoded audio task frames');
  expect(doubaoProviderSource.includes('pendingAudioFrames'), 'Doubao provider queues audio until SessionStarted');
  expect(doubaoProviderSource.includes('isProviderOutputStale'), 'Doubao provider drops stale audio after interrupt');
  expect(doubaoProviderSource.includes('provider_session_not_ready_audio_queued'), 'Doubao provider reports queued pre-ready audio');
  expect(doubaoProviderSource.includes('flushDoubaoRealtimeTextOutput'), 'Doubao provider exposes minimal text deltas for captions');
  expect(!doubaoProviderSource.includes("runtime.connection.send(Buffer.from(chunk.base64Audio, 'base64')"), 'Doubao provider never forwards naked browser audio bytes');
  expect(!doubaoProviderSource.includes("JSON.stringify({ type: 'interrupt'"), 'Doubao provider does not use JSON interrupt placeholder');
  expect(!doubaoProviderSource.includes("opcode === 0x2 ? 'response.audio.delta'"), 'Doubao provider does not infer provider semantics from WebSocket opcode');
  expect(doubaoProviderSource.includes('binary_protocol_forward_disabled_until_provider_smoke_is_verified'), 'Doubao provider keeps binary forwarding behind smoke gate');
  expect(headerWebSocketSource.includes('Sec-WebSocket-Key'), 'server-side WebSocket supports custom provider headers');
  expect(headerWebSocketSource.includes('Sec-WebSocket-Accept'), 'server-side WebSocket validates provider accept key');
  expect(headerWebSocketSource.includes('MAX_SERVER_FRAME_BYTES'), 'server-side WebSocket limits provider frame size');
  expect(headerWebSocketSource.includes('continuation frames are not supported'), 'server-side WebSocket explicitly rejects continuation frames');
  expect(!realtimeRouteSource.includes('providerEvents: getRealtimeProviderEvents'), 'realtime route does not return raw provider events');
  expect(!realtimeRouteSource.includes('realtimeSession: session'), 'realtime route does not return full session objects');
  expect(realtimeRouteSource.includes("action === 'poll_output'"), 'realtime route exposes minimal audio output polling');
  expect(realtimeRouteSource.includes('textDeltas: flushDoubaoRealtimeTextOutput'), 'realtime route returns minimal provider text deltas');
  expect(conversationStreamRouteSource.includes('text/event-stream'), 'conversation stream route returns SSE');
  expect(conversationStreamRouteSource.includes("write('delta'"), 'conversation stream route emits text deltas');
  expect(!conversationStreamRouteSource.includes('immediateAck'), 'conversation stream route does not inject thinking copy into official assistant deltas');
  expect(!conversationStreamRouteSource.includes('我听到了，我先想一下'), 'conversation stream route does not hard-code spoken thinking acknowledgements');
  expect(conversationStreamRouteSource.includes("write('status'"), 'conversation stream route can emit UI-only status events');
  expect(conversationStreamRouteSource.includes('maxTokens: 320'), 'conversation stream route keeps voice replies bounded for latency');
  expect(llmClientSource.includes('streamLLM'), 'LLM client exposes streaming helper');
  expect(llmProviderSource.includes('stream: true'), 'OpenAI-compatible provider requests streaming completions');
  expect(voiceAssistantPageSource.includes('REALTIME_PCM_SAMPLE_RATE = 16000'), 'voice assistant page captures 16k PCM audio chunks for realtime provider');
  expect(voiceAssistantPageSource.includes('AudioWorkletNode') || voiceAssistantPageSource.includes('audioWorklet'), 'voice assistant page prefers AudioWorklet for realtime microphone capture');
  expect(voiceAssistantPageSource.includes('createScriptProcessor'), 'voice assistant page keeps a Web Audio fallback when AudioWorklet is unavailable');
  expect(voiceAssistantPageSource.includes("codec: 'pcm16'"), 'voice assistant page uploads pcm16 chunks instead of WebM containers');
  expect(voiceAssistantPageSource.includes("action: 'append_audio'"), 'voice assistant page sends realtime append_audio');
  expect(voiceAssistantPageSource.includes("action: 'poll_output'"), 'voice assistant page polls provider audio deltas');
  expect(voiceAssistantPageSource.includes('applyRealtimeTextDeltas'), 'voice assistant page updates captions from provider text deltas');
  expect(voiceAssistantPageSource.includes('/api/conversation/message/stream'), 'voice assistant page uses streaming message endpoint');
  expect(voiceAssistantPageSource.includes("voiceStateRef.current === 'thinking'") && voiceAssistantPageSource.includes("setVoiceState('speaking')"), 'voice assistant page switches to speaking as soon as first delta arrives');
  expect(voiceAssistantPageSource.includes('activeTurnIdRef'), 'voice assistant page tracks active text turn IDs');
  expect(voiceAssistantPageSource.includes('isCurrentTurn'), 'voice assistant page drops stale stream events from older turns');
  expect(voiceAssistantPageSource.includes('enqueueAssistantDisplayDelta'), 'voice assistant page reveals assistant text through a typewriter queue');
  expect(voiceAssistantPageSource.includes('waitForAssistantDisplayQueue'), 'voice assistant page waits for visual streaming before closing assistant message');
  expect(voiceAssistantPageSource.includes('speechQueueRef'), 'voice assistant page uses queued server-side TTS playback');
  expect(voiceAssistantPageSource.includes('/api/voice/tts'), 'voice assistant page requests high-quality server-side TTS fallback');
  expect(!voiceAssistantPageSource.includes('new SpeechSynthesisUtterance'), 'voice assistant page no longer uses browser SpeechSynthesis as formal voice output');
  expect(voiceAssistantPageSource.includes('SPEECH_COMMIT_DELAY_MS'), 'voice assistant page keeps a configurable silence grace window before committing browser ASR');
  expect(voiceAssistantPageSource.includes('const SPEECH_COMMIT_DELAY_MS = 1200'), 'voice assistant page commits browser ASR after roughly 1.2 seconds of silence');
  expect(!voiceAssistantPageSource.includes('1.6 秒'), 'voice assistant page no longer tells users to wait 1.6 seconds before sending');
  expect(voiceAssistantPageSource.includes('pendingFinalTranscriptRef'), 'voice assistant page accumulates browser ASR final chunks before sending');
  expect(voiceAssistantPageSource.includes('scheduleSpeechCommit'), 'voice assistant page schedules delayed ASR commit instead of sending on first pause');
  expect(voiceAssistantPageSource.includes('flushSpeechCommit'), 'voice assistant page can flush accumulated speech manually or after silence');
  expect(voiceAssistantPageSource.includes('recognitionRef.current.continuous = true'), 'voice assistant page runs browser ASR in continuous mode');
  expect(voiceAssistantPageSource.includes('recognitionRef.current.maxAlternatives = 3'), 'voice assistant page asks browser ASR for multiple alternatives');
  expect(voiceAssistantPageSource.includes('pickBestSpeechRecognitionAlternative'), 'voice assistant page chooses the highest-confidence ASR alternative');
  expect(!voiceAssistantPageSource.includes('sendMessage(finalText);'), 'voice assistant page does not immediately send first browser ASR final result');
  expect(voiceAssistantPageSource.includes("isSpeakingRef.current || voiceStateRef.current === 'thinking'"), 'voice assistant page can interrupt a thinking or speaking turn before listening again');
  expect(!voiceAssistantPageSource.includes("disabled={voiceState === 'thinking' || voiceState === 'booting'}"), 'voice assistant mic is not disabled during thinking, so user can continue or correct themselves');
  expect(voiceAssistantPageSource.includes('loadTtsStatus'), 'voice assistant page checks high-quality TTS availability on boot');
  expect(voiceAssistantPageSource.includes('未配置豆包高音色 TTS，所以不会出声'), 'voice assistant page clearly explains no-sound fallback when Doubao TTS is missing');
  expect(
    voiceAssistantPageSource.includes("body: JSON.stringify({ action: 'get' })"),
    'voice assistant page validates an existing local token before creating conversation sessions'
  );
  expect(voiceTtsRouteSource.includes('synthesizeSpeech'), 'voice TTS route calls the provider abstraction');
  expect(voiceTtsConfigSource.includes('DOUBAO_TTS_API_KEY') && voiceTtsConfigSource.includes('seed-tts-2.0'), 'TTS config defaults to Doubao high-quality TTS fallback');
  expect(voiceTtsConfigSource.includes('DOUBAO_TTS_SPEAKER') && voiceTtsConfigSource.includes('zh_female_vv_uranus_bigtts'), 'TTS config exposes Doubao Vivi 2.0 speaker selection');
  expect(doubaoTtsProviderSource.includes('/api/v3/tts/unidirectional') || doubaoTtsProviderSource.includes('X-Api-Resource-Id'), 'Doubao TTS provider uses Volcengine V3 TTS request headers');
  expect(doubaoTtsProviderSource.includes('req_params') && doubaoTtsProviderSource.includes('speaker'), 'Doubao TTS provider sends text and speaker through req_params');
  expect(doubaoTtsProviderSource.includes("namespace: 'BidirectionalTTS'") && doubaoTtsProviderSource.includes('isSupportedReqModel'), 'Doubao TTS provider conditionally sends only supported V3 req_params.model values');
  expect(doubaoTtsProviderSource.includes('toDoubaoScaleRate(config.speed)') && doubaoTtsProviderSource.includes('loudness_rate'), 'Doubao TTS provider converts speed/volume/pitch to Volcengine int32 scale rates');
  expect(doubaoTtsProviderSource.includes('parseConcatenatedJsonObjects'), 'Doubao TTS provider parses chunked JSON audio responses');
  expect(voiceTtsConfigSource.includes('MINIMAX_TTS_MODEL') && voiceTtsConfigSource.includes('speech-2.8-turbo'), 'TTS config supports MiniMax Speech 2.8 Turbo');
  expect(voiceTtsConfigSource.includes('MINIMAX_TTS_API_KEY'), 'TTS config supports MiniMax API key alias for local setup');
  expect(voiceTtsConfigSource.includes('wss://') && minimaxTtsProviderSource.includes('task_continue'), 'MiniMax TTS provider uses WebSocket streaming task events');
  expect(voiceAssistantPageSource.includes('autoBargeInEnabled'), 'voice assistant page gates experimental auto barge-in');
  expect(voiceAssistantPageSource.includes('useState(true);') && voiceAssistantPageSource.includes('setAutoBargeInEnabled'), 'voice assistant page enables auto barge-in by default');
  expect(voiceAssistantPageSource.includes("import('@ricky0123/vad-web')") && voiceAssistantPageSource.includes('MicVAD.new'), 'voice assistant page uses @ricky0123/vad-web / Silero VAD for auto barge-in');
  expect(voiceAssistantPageSource.includes("baseAssetPath: VAD_ASSET_BASE_PATH") && voiceAssistantPageSource.includes("onnxWASMBasePath: VAD_ONNX_WASM_BASE_PATH"), 'voice assistant page serves Silero VAD and ONNX wasm assets from public /vad');
  expect(voiceAssistantPageSource.includes('positiveSpeechThreshold') && voiceAssistantPageSource.includes('redemptionMs'), 'voice assistant page tunes Silero VAD thresholds and cooldown behavior');
  expect(voiceAssistantPageSource.includes('lastAutoInterruptAtRef'), 'voice assistant page debounces automatic barge-in interrupts');
  expect(voiceAssistantPageSource.includes('setAutoBargeInEnabled(false)'), 'voice assistant page disables auto barge-in when mic permission is unavailable');
  expect(voiceAssistantPageSource.includes('if (options.auto)') && voiceAssistantPageSource.includes("setVoiceState('idle')"), 'voice assistant page does not leave auto-listen permission failures in error state');
  expect(voiceAssistantPageSource.includes('data-testid="anime-avatar"'), 'voice assistant page renders the custom anime avatar');
  expect(voiceAssistantPageSource.includes('您直接说话即可打断'), 'voice assistant page explains voice-triggered interruption');
  expect(voiceAssistantPageSource.includes('clearRealtimePlayback'), 'voice assistant clears realtime playback on interrupt/end');
  expect(secretScanSource.includes('provider-secret-assignment'), 'secret scan covers provider ACCESS_KEY and APP_KEY assignments');
  expect(secretScanSource.includes('MINIMAX'), 'secret scan covers MiniMax TTS API key assignments');
}

function runProviderReadinessChecks() {
  const providerConfigured = Boolean(
    process.env.DOUBAO_REALTIME_ENABLED === 'true'
    && (process.env.DOUBAO_REALTIME_APP_ID || process.env.VOLC_APP_ID)
    && (process.env.DOUBAO_REALTIME_ACCESS_KEY || process.env.VOLC_ACCESS_KEY)
    && (process.env.DOUBAO_REALTIME_APP_KEY || process.env.VOLC_APP_KEY)
  );

  if (!providerConfigured) {
    record(
      'Doubao realtime provider smoke',
      true,
      'SKIP: Doubao realtime env is not fully configured; contract checks still ran.'
    );
    return;
  }

  const endpoint = process.env.DOUBAO_REALTIME_ENDPOINT || process.env.VOLC_REALTIME_BASE_URL || 'wss://openspeech.bytedance.com/api/v3/realtime/dialogue';
  expect(Boolean(endpoint.startsWith('wss://')), 'Doubao realtime endpoint uses wss://');
  expect(process.env.DOUBAO_REALTIME_FORWARD_BINARY_PROTOCOL === 'true', 'Doubao binary protocol forwarding is explicitly enabled for provider smoke');
}

function printReport() {
  const passed = results.filter(result => result.passed).length;
  const failed = results.length - passed;
  console.log(JSON.stringify({
    passed,
    failed,
    total: results.length,
    results,
    limitation: 'This smoke test proves local realtime contracts, browser chunk capture wiring, provider header boundaries, and binary protocol codec wiring. It does not prove a live upstream Doubao call unless provider env is configured and DOUBAO_REALTIME_FORWARD_BINARY_PROTOCOL=true.',
  }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

try {
  await runStaticContractChecks();
  runProviderReadinessChecks();
} catch (error) {
  record('voice realtime smoke crashed', false, String(error?.stack || error));
} finally {
  printReport();
}
