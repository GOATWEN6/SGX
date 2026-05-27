import { SearchToolIntent, SearchToolRequest, SearchToolResult, ToolCitation } from '@/types';

const highRiskPatterns = ['诊断', '吃什么药', '用药', '投资', '股票', '基金', '借钱', '遗嘱', '打官司'];
const promptInjectionPatterns = [
  /ignore previous instructions/ig,
  /you are now/ig,
  /忽略之前的指令/g,
  /你现在是/g,
  /假装你是/g,
];

export function detectSearchIntent(text: string): SearchToolIntent | null {
  const normalized = text.trim();
  if (!normalized) return null;
  if (/(天气|下雨|气温|温度|冷不冷|热不热)/.test(normalized)) return 'weather';
  if (/(节日|今天是什么日子|农历|端午|中秋|春节|重阳)/.test(normalized)) return 'holiday';
  if (/(新闻|最近发生|最近有什么|时事)/.test(normalized)) return 'news_summary';
  if (/(是什么|什么意思|谁是|哪里|百科|介绍一下)/.test(normalized)) return 'encyclopedia';
  if (/(养生|健康|血压|血糖|睡眠|锻炼|头晕|不舒服)/.test(normalized)) return 'health_low_risk';
  return null;
}

export function detectRiskFlags(text: string): string[] {
  const flags: string[] = [];
  if (highRiskPatterns.some(pattern => text.includes(pattern))) {
    flags.push('high_risk_professional_advice');
  }
  if (/(孤独|没人管|活着没意思|不想活)/.test(text)) {
    flags.push('elder_emotional_distress');
  }
  return flags;
}

function sanitizeExternalText(text: string): string {
  return promptInjectionPatterns.reduce(
    (clean, pattern) => clean.replace(pattern, '[已移除可疑外部指令]'),
    text
  );
}

async function callConfiguredSearchProvider(request: SearchToolRequest): Promise<SearchToolResult | null> {
  const endpoint = process.env.SEARCH_API_ENDPOINT;
  if (!endpoint) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.SEARCH_TIMEOUT_MS || 5000));

  const response = await fetch(endpoint, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.SEARCH_API_KEY ? { Authorization: `Bearer ${process.env.SEARCH_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      query: request.query,
      intent: request.intent,
      locationHint: request.locationHint,
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(`搜索服务返回 ${response.status}`);
  }

  const data = await response.json();
  const citations: ToolCitation[] = Array.isArray(data.citations)
    ? data.citations.map((item: any) => ({
      title: String(item.title || '外部来源'),
      url: String(item.url || ''),
      accessedAt: new Date().toISOString(),
      summary: sanitizeExternalText(String(item.summary || '')),
    }))
    : [];

  return {
    answerContext: sanitizeExternalText(String(data.answerContext || data.summary || '')),
    citations,
    riskLevel: data.riskLevel === 'medium' || data.riskLevel === 'high' ? data.riskLevel : 'low',
  };
}

function buildUnconfiguredResult(request: SearchToolRequest): SearchToolResult {
  return {
    answerContext: [
      '实时联网服务尚未配置，不能把这次回答伪装成实时查询结果。',
      `用户问题属于 ${request.intent} 类生活信息。`,
      '请用常识性、低风险方式回应，并说明实时信息需要稍后确认。',
    ].join('\n'),
    citations: [],
    riskLevel: request.intent === 'health_low_risk' ? 'medium' : 'low',
  };
}

export async function runSearchTool(request: SearchToolRequest): Promise<SearchToolResult> {
  if (request.intent === 'health_low_risk' && highRiskPatterns.some(pattern => request.query.includes(pattern))) {
    return {
      answerContext: '用户问题可能涉及医疗诊断或用药。只能给出低风险提醒，不提供诊断、药名或剂量建议。',
      citations: [],
      riskLevel: 'high',
    };
  }

  try {
    return await callConfiguredSearchProvider(request) || buildUnconfiguredResult(request);
  } catch {
    return {
      answerContext: '联网查询失败。请温和说明现在查不到实时信息，并建议稍后再试。',
      citations: [],
      riskLevel: request.intent === 'health_low_risk' ? 'medium' : 'low',
    };
  }
}
