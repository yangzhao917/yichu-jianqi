import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AliyunOpenSearchProvider, KnowledgeService } from '../dist/knowledge/knowledge.service';
import { DeepSeekProvider } from '../dist/knowledge/deepseek.provider';

const originalFetch = globalThis.fetch;
const originalEnv = {
  ALIYUN_OPENSEARCH_ENDPOINT: process.env.ALIYUN_OPENSEARCH_ENDPOINT,
  ALIYUN_OPENSEARCH_APP_GROUP_ID: process.env.ALIYUN_OPENSEARCH_APP_GROUP_ID,
  ALIYUN_OPENSEARCH_API_KEY: process.env.ALIYUN_OPENSEARCH_API_KEY,
  PUBLIC_WEB_URL: process.env.PUBLIC_WEB_URL,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  DEEPSEEK_API_URL: process.env.DEEPSEEK_API_URL,
};

beforeEach(() => {
  process.env.ALIYUN_OPENSEARCH_ENDPOINT = 'https://opensearch.example';
  process.env.ALIYUN_OPENSEARCH_APP_GROUP_ID = 'app';
  process.env.ALIYUN_OPENSEARCH_API_KEY = 'test-key';
  process.env.PUBLIC_WEB_URL = 'https://product.example';
  process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
  process.env.DEEPSEEK_API_URL = 'https://deepseek.example';
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('知识文件推送仅使用官方非结构化字段，接收成功不代表可检索', async () => {
  let posted: any;
  globalThis.fetch = (async (_url, options) => {
    posted = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ status: 'OK', result: { success: 1, failure: 0 } }), { status: 200 });
  }) as typeof fetch;
  const provider = new AliyunOpenSearchProvider();
  await provider.pushDocument({ id: 'file123', originalName: '产品手册.pdf', mimeType: 'application/pdf', content: Buffer.from('%PDF') });
  assert.equal(posted[0].fields.id, 'file123');
  assert.equal(posted[0].fields.title, 'file123 | 产品手册.pdf');
  assert.equal(posted[0].fields.url, 'https://product.example/api/knowledge-files/file123');
  assert.equal('category' in posted[0].fields, false);
});

test('检索按文件主键隔离，并拒绝来源不符的命中', async () => {
  let filter = '';
  globalThis.fetch = (async (_url, options) => {
    filter = JSON.parse(String(options?.body)).options.retrieve.doc.filter;
    return new Response(JSON.stringify({ status: 'OK', result: { search_hits: [{ type: 'DOC', fields: { title: 'other-file | 其他资料.pdf', content: '不属于当前产品' } }] } }), { status: 200 });
  }) as typeof fetch;
  const provider = new AliyunOpenSearchProvider();
  await assert.rejects(provider.retrieve('用途是什么', { id: 'file123', originalName: '产品手册.pdf', status: 'indexing' }), (error: any) => error.getResponse()?.code === 'RAG_SOURCE_MISMATCH');
  assert.equal(filter, 'raw_pk="file123"');
});

test('DeepSeek 只接受能对应片段的结构化陈述', async () => {
  let posted: any;
  globalThis.fetch = (async (_url, options) => {
    posted = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ claims: [{ text: '设备适合远程巡检。', citationIds: [1] }] }) } }] }), { status: 200 });
  }) as typeof fetch;
  const provider = new DeepSeekProvider();
  const citation = { id: 1, title: '产品手册.pdf', locator: '第 2 页', snippet: '该设备适合远程巡检。', url: '/api/knowledge-files/file123' };
  const answer = await provider.answer('有什么用途？', [citation]);
  assert.equal(posted.model, 'deepseek-chat');
  assert.equal(posted.response_format.type, 'json_object');
  assert.equal(answer.answer, '设备适合远程巡检。 [1]');
  assert.deepEqual(answer.citations, [citation]);
});

test('DeepSeek 返回不存在的引用编号时明确拒绝', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ claims: [{ text: '无来源主张', citationIds: [2] }] }) } }] }), { status: 200 })) as typeof fetch;
  const provider = new DeepSeekProvider();
  await assert.rejects(provider.answer('问题', [{ id: 1, title: '手册', locator: '片段', snippet: '内容', url: '/api/knowledge-files/file123' }]), (error: any) => error.getResponse()?.code === 'DEEPSEEK_INVALID_CITATION');
});

test('已确认但仍在索引中的文件可参与问答，命中后才标为可检索', async () => {
  let query: any;
  let updated: any;
  const prisma: any = {
    collectionItem: { findFirst: async (where: any) => { query = where; return { id: 'product1', knowledgeFiles: [{ id: 'file123', originalName: '手册.pdf', status: 'indexing' }] }; } },
    knowledgeFile: { updateMany: async (args: any) => { updated = args; return { count: 1 }; } },
  };
  const rag: any = { retrieve: async () => [{ id: 1, fileId: 'file123', title: '手册.pdf', locator: '检索片段 1', snippet: '内容', url: '/api/knowledge-files/file123' }] };
  const deepSeek: any = { assertConfigured() {}, answer: async (_question: string, citations: any[]) => ({ answer: '说明 [1]', citations, insufficientEvidence: false }) };
  const answer = await new KnowledgeService(prisma, rag, deepSeek).ask('brand', 'product', '用途是什么');
  assert.deepEqual(query.select.knowledgeFiles.where.status.in, ['indexing', 'ready']);
  assert.equal(query.select.knowledgeFiles.where.isPublic, true);
  assert.deepEqual(updated.where.id.in, ['file123']);
  assert.equal(updated.data.status, 'ready');
  assert.equal(answer.citations[0].id, 1);
});
