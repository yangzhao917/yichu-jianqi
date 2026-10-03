import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Citation } from './knowledge.service';

type Claim = { text: string; citationIds: number[] };

@Injectable()
export class DeepSeekProvider {
  assertConfigured() {
    if (!process.env.DEEPSEEK_API_KEY) throw new ServiceUnavailableException({ code: 'DEEPSEEK_NOT_CONFIGURED', message: 'DeepSeek API Key 未配置' });
  }

  async answer(question: string, citations: Citation[]): Promise<{ answer: string; citations: Citation[]; insufficientEvidence: boolean }> {
    this.assertConfigured();
    const apiKey = process.env.DEEPSEEK_API_KEY!;
    const endpoint = (process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com').replace(/\/$/, '');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(`${endpoint}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          temperature: 0,
          stream: false,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: '你是工业产品资料问答助手。只依据给出的编号片段回答。必须输出 JSON 对象，格式为 {"claims":[{"text":"一句可核查的中文陈述","citationIds":[1]}]}。每条陈述必须由引用片段直接支持，不能推断未给出的参数、认证、价格或承诺。资料不足时输出 {"claims":[]}。不要添加其他字段。' },
            { role: 'user', content: JSON.stringify({ question, snippets: citations.map(({ id, title, locator, snippet }) => ({ id, title, locator, snippet })) }) },
          ],
        }),
      });
      if (!response.ok) throw new ServiceUnavailableException({ code: 'DEEPSEEK_PROVIDER_ERROR', message: `DeepSeek 请求失败（HTTP ${response.status}）` });
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new ServiceUnavailableException({ code: 'DEEPSEEK_INVALID_RESPONSE', message: 'DeepSeek 没有返回可解析的回答' });
      let parsed: { claims?: Claim[] };
      try { parsed = JSON.parse(content) as { claims?: Claim[] }; }
      catch { throw new ServiceUnavailableException({ code: 'DEEPSEEK_INVALID_RESPONSE', message: 'DeepSeek 回答格式不符合引用要求' }); }
      if (!parsed || !Array.isArray(parsed.claims)) throw new ServiceUnavailableException({ code: 'DEEPSEEK_INVALID_RESPONSE', message: 'DeepSeek 回答缺少引用结构' });
      if (!parsed.claims.length) return { answer: '当前资料无法确认', citations: [], insufficientEvidence: true };
      const byId = new Map(citations.map((citation) => [citation.id, citation]));
      if (parsed.claims.length > 5 || parsed.claims.some((claim) => !claim || typeof claim.text !== 'string' || !claim.text.trim() || !Array.isArray(claim.citationIds) || !claim.citationIds.length || claim.citationIds.some((id) => !Number.isInteger(id) || !byId.has(id)))) {
        throw new ServiceUnavailableException({ code: 'DEEPSEEK_INVALID_CITATION', message: 'DeepSeek 回答无法逐条对应检索资料' });
      }
      const citedIds = [...new Set(parsed.claims.flatMap((claim) => claim.citationIds))];
      const answer = parsed.claims.map((claim) => `${claim.text.trim().replace(/\[\d+\]/g, '')} ${[...new Set(claim.citationIds)].map((id) => `[${id}]`).join('')}`).join('\n');
      return { answer, citations: citations.filter((citation) => citedIds.includes(citation.id)), insufficientEvidence: false };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ code: 'DEEPSEEK_PROVIDER_ERROR', message: `DeepSeek 请求失败：${error instanceof Error ? error.message : 'unknown error'}` });
    } finally { clearTimeout(timer); }
  }
}
