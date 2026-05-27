import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  buildConversationFallbackReply,
  completeConversationTurn,
  prepareConversationTurn,
} from '@/lib/conversation';
import { handleError } from '@/lib/errors';
import { streamLLM } from '@/lib/llm/client';

export const dynamic = 'force-dynamic';

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getFastAckTimeoutMs(): number {
  const configured = Number(process.env.VOICE_ASSISTANT_FAST_ACK_MS || '900');
  if (!Number.isFinite(configured)) return 900;
  return Math.max(200, Math.min(2500, configured));
}

function buildFastAck(params: {
  text: string;
  riskFlags: string[];
  usedWebSearch: boolean;
}): string {
  if (params.riskFlags.includes('high_risk_professional_advice')) {
    return '我听到了，这个问题要谨慎一点。';
  }
  if (params.usedWebSearch) {
    return '我先按生活信息帮您看一下。';
  }
  if (/安全|注意|提醒/.test(params.text)) {
    return '我听到了，我先想几句稳妥的建议。';
  }
  return '我听到了，我先想一下。';
}

async function* streamWithFastAck(
  prepared: Awaited<ReturnType<typeof prepareConversationTurn>>,
  options: { temperature: number; maxTokens: number },
  hasImmediateAck = false
): AsyncIterable<string> {
  const iterator = streamLLM(prepared.systemPrompt, prepared.userPrompt, options)[Symbol.asyncIterator]();
  const first = await Promise.race<
    | { type: 'delta'; result: IteratorResult<string> }
    | { type: 'timeout' }
  >([
    iterator.next().then(result => ({ type: 'delta' as const, result })),
    new Promise<{ type: 'timeout' }>(resolve => {
      setTimeout(() => resolve({ type: 'timeout' }), getFastAckTimeoutMs());
    }),
  ]);

  if (first.type === 'timeout') {
    if (!hasImmediateAck) {
      yield buildFastAck({
        text: prepared.text,
        riskFlags: prepared.riskFlags,
        usedWebSearch: prepared.usedWebSearch,
      });
    }
  } else if (!first.result.done && first.result.value) {
    yield first.result.value;
  } else {
    return;
  }

  while (true) {
    const next = await iterator.next();
    if (next.done) return;
    if (next.value) yield next.value;
  }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const userId = requireAuth(request);
    const body = await request.json();
    const sessionId = String(body.sessionId || '');
    const message = String(body.message || '').trim();

    if (!sessionId || !message) {
      return Response.json(
        { success: false, error: { code: 'INVALID_PARAMS', message: '缺少会话或消息内容' } },
        { status: 400 }
      );
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let assistantText = '';
        let prepared: Awaited<ReturnType<typeof prepareConversationTurn>> | null = null;

        const write = (event: string, data: unknown) => {
          controller.enqueue(encoder.encode(sse(event, data)));
        };

        try {
          const immediateAck = '我听到了，我先想一下。';
          assistantText += immediateAck;
          write('delta', { text: immediateAck });

          prepared = await prepareConversationTurn({ userId, sessionId, message });
          write('ready', {
            usedWebSearch: prepared.usedWebSearch,
            citations: prepared.citations,
            riskFlags: prepared.riskFlags,
          });

          for await (const delta of streamWithFastAck(prepared, {
            temperature: 0.65,
            maxTokens: 320,
          }, true)) {
            assistantText += delta;
            write('delta', { text: delta });
          }

          if (!assistantText.trim()) {
            assistantText = buildConversationFallbackReply(
              prepared.userName,
              prepared.text,
              prepared.riskFlags,
              prepared.usedWebSearch
            );
            write('delta', { text: assistantText });
          }

          const result = completeConversationTurn(prepared, assistantText);
          write('done', {
            success: true,
            data: result,
          });
        } catch (error) {
          if (prepared) {
            const fallback = buildConversationFallbackReply(
              prepared.userName,
              prepared.text,
              prepared.riskFlags,
              prepared.usedWebSearch
            );
            assistantText = assistantText || fallback;
            if (!assistantText.includes(fallback)) {
              write('delta', { text: fallback });
            }
            const result = completeConversationTurn(prepared, assistantText);
            write('done', {
              success: true,
              data: result,
              fallback: true,
            });
          } else {
            write('error', {
              message: error instanceof Error ? error.message : '流式回复失败',
            });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    const { response, statusCode } = handleError(error);
    return Response.json(response, { status: statusCode });
  }
}
