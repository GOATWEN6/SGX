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

async function* streamPreparedReply(
  prepared: Awaited<ReturnType<typeof prepareConversationTurn>>,
  options: { temperature: number; maxTokens: number }
): AsyncIterable<string> {
  for await (const delta of streamLLM(prepared.systemPrompt, prepared.userPrompt, options)) {
    if (delta) yield delta;
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
          write('status', {
            state: 'thinking',
            message: '正在组织回复',
          });

          prepared = await prepareConversationTurn({ userId, sessionId, message });
          write('ready', {
            usedWebSearch: prepared.usedWebSearch,
            citations: prepared.citations,
            riskFlags: prepared.riskFlags,
          });

          for await (const delta of streamPreparedReply(prepared, {
            temperature: 0.65,
            maxTokens: 320,
          })) {
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
