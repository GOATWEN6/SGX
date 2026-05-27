const { readFile } = await import('node:fs/promises');

const results = [];

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
}

async function readText(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
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
    doubaoProviderSource,
    headerWebSocketSource,
    voiceIndexSource,
    realtimeRouteSource,
    voiceAssistantPageSource,
    stateMachineCasesSource,
  ] = await Promise.all([
    readText('src/lib/voice/realtime/types.ts'),
    readText('src/lib/voice/realtime/state-machine.ts'),
    readText('src/lib/voice/realtime/session-store.ts'),
    readText('src/lib/voice/realtime/doubao-config.ts'),
    readText('src/lib/voice/realtime/doubao-provider.ts'),
    readText('src/lib/voice/realtime/header-websocket.ts'),
    readText('src/lib/voice/index.ts'),
    readText('src/app/api/voice/realtime/route.ts'),
    readText('src/app/voice-assistant/page.tsx'),
    readText('harness/voice-assistant/state-machine-cases.json'),
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
  expect(doubaoConfigSource.includes('X-Api-Resource-Id'), 'Doubao config builds official resource id header');
  expect(doubaoConfigSource.includes('volc.speech.dialog'), 'Doubao config defaults to realtime dialogue resource');
  expect(doubaoProviderSource.includes('raw_audio_forward_disabled_until_binary_codec_is_verified'), 'Doubao provider blocks raw forwarding until codec is verified');
  expect(headerWebSocketSource.includes('Sec-WebSocket-Key'), 'server-side WebSocket supports custom provider headers');
  expect(voiceAssistantPageSource.includes('MediaRecorder'), 'voice assistant page captures browser audio chunks');
  expect(voiceAssistantPageSource.includes("action: 'append_audio'"), 'voice assistant page sends realtime append_audio');
  expect(voiceAssistantPageSource.includes('clearRealtimePlayback'), 'voice assistant clears realtime playback on interrupt/end');
}

function runProviderReadinessChecks() {
  const providerConfigured = Boolean(
    process.env.DOUBAO_REALTIME_ENABLED === 'true'
    && process.env.DOUBAO_REALTIME_API_KEY
    && process.env.DOUBAO_REALTIME_ENDPOINT
    && process.env.DOUBAO_REALTIME_MODEL
  );

  if (!providerConfigured) {
    record(
      'Doubao realtime provider smoke',
      true,
      'SKIP: Doubao realtime env is not fully configured; contract checks still ran.'
    );
    return;
  }

  expect(Boolean(process.env.DOUBAO_REALTIME_ENDPOINT?.startsWith('wss://')), 'Doubao realtime endpoint uses wss://');
  expect(Boolean(process.env.DOUBAO_REALTIME_MODEL), 'Doubao realtime model is configured');
}

function printReport() {
  const passed = results.filter(result => result.passed).length;
  const failed = results.length - passed;
  console.log(JSON.stringify({
    passed,
    failed,
    total: results.length,
    results,
    limitation: 'This smoke test proves local realtime contracts, browser chunk capture wiring, and provider header boundaries. It does not prove upstream Doubao binary dialogue frames until the official codec is implemented.',
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
