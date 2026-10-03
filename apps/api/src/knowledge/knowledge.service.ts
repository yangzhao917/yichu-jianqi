import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { AuthUser } from '../common/constants';
import { DeepSeekProvider } from './deepseek.provider';

type UploadedFile = { originalname: string; mimetype: string; size: number; buffer?: Buffer };
export type Citation = { id: number; title: string; locator: string; snippet: string; url: string };
type SearchFile = { id: string; originalName: string; status: string };
type OpenSearchHit = { fields?: { id?: string; raw_pk?: string; title?: string; content?: string; url?: string; page?: string | number; chapter?: string }; type?: string };
type RetrievedSnippet = Citation & { fileId: string };

/** OpenSearch only retrieves source snippets; answer generation uses DeepSeek directly. */
@Injectable()
export class AliyunOpenSearchProvider {
  private readonly timeoutMs = 30_000;

  private config() {
    const endpoint = (process.env.ALIYUN_OPENSEARCH_ENDPOINT || '').replace(/\/$/, '');
    const appGroupId = process.env.ALIYUN_OPENSEARCH_APP_GROUP_ID || process.env.ALIYUN_OPENSEARCH_APP_ID;
    const apiKey = process.env.ALIYUN_OPENSEARCH_API_KEY || process.env.OPENSEARCH_API_KEY;
    const missing = [!endpoint ? 'ALIYUN_OPENSEARCH_ENDPOINT' : '', !appGroupId ? 'ALIYUN_OPENSEARCH_APP_GROUP_ID' : '', !apiKey ? 'ALIYUN_OPENSEARCH_API_KEY' : ''].filter(Boolean);
    if (missing.length) throw new ServiceUnavailableException({ code: 'RAG_NOT_CONFIGURED', message: `阿里云 OpenSearch-LLM 未配置：${missing.join(', ')}` });
    return { endpoint, appGroupId: appGroupId!, apiKey: apiKey! };
  }

  private async request(path: string, body: unknown) {
    const config = this.config();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${config.endpoint}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const text = await response.text();
      let payload: Record<string, unknown> = {};
      try { payload = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { payload = {}; }
      if (!response.ok) throw new ServiceUnavailableException({ code: 'RAG_PROVIDER_ERROR', message: `阿里云 OpenSearch 请求失败（HTTP ${response.status}）`, details: payload });
      if (payload.status === 'FAIL') throw new ServiceUnavailableException({ code: 'RAG_PROVIDER_ERROR', message: this.errorText(payload.errors) || '阿里云 OpenSearch 请求失败', details: payload });
      return payload;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ code: 'RAG_PROVIDER_ERROR', message: `阿里云 OpenSearch 请求失败：${error instanceof Error ? error.message : 'unknown error'}` });
    } finally { clearTimeout(timer); }
  }

  private documentTitle(file: Pick<SearchFile, 'id' | 'originalName'>) { return `${file.id} | ${file.originalName}`; }

  async pushDocument(file: { id: string; originalName: string; mimeType: string; content: Buffer }) {
    const { appGroupId } = this.config();
    const publicWebUrl = (process.env.PUBLIC_WEB_URL || '').replace(/\/$/, '');
    if (!publicWebUrl || !/^https?:\/\//.test(publicWebUrl)) throw new ServiceUnavailableException({ code: 'RAG_NOT_CONFIGURED', message: '公开站点地址 PUBLIC_WEB_URL 未配置' });
    const type = extname(file.originalName).replace('.', '').toLowerCase() || this.typeFromMime(file.mimeType);
    const url = `${publicWebUrl}/api/knowledge-files/${encodeURIComponent(file.id)}`;
    const payload = await this.request(`/v3/openapi/apps/${encodeURIComponent(appGroupId)}/actions/knowledge-bulk`, [{ cmd: 'URL/BASE64', fields: { id: file.id, type, title: this.documentTitle(file), content: file.content.toString('base64'), url } }]);
    const result = payload.result && typeof payload.result === 'object' ? payload.result as Record<string, unknown> : {};
    if (Number(result.success) !== 1 || Number(result.failure) !== 0 || (Array.isArray(result.failed_ids) && result.failed_ids.includes(file.id))) throw new ServiceUnavailableException({ code: 'RAG_INDEX_FAILED', message: this.errorText(payload.errors) || '阿里云 OpenSearch 未能接收知识文件', details: payload });
    return { documentId: file.id };
  }

  async retrieve(question: string, file: SearchFile): Promise<RetrievedSnippet[]> {
    const { appGroupId } = this.config();
    if (!/^[a-zA-Z0-9_-]+$/.test(file.id)) throw new ServiceUnavailableException({ code: 'RAG_SOURCE_INVALID', message: '知识文件标识无法用于检索过滤' });
    const topN = Math.min(10, Math.max(1, Number(process.env.ALIYUN_OPENSEARCH_TOP_N || 5) || 5));
    const payload = await this.request(`/v3/openapi/apps/${encodeURIComponent(appGroupId)}/actions/multi-search`, {
      question: { text: question, type: 'TEXT', session: '' },
      options: { chat: { disable: true }, retrieve: { doc: { disable: false, top_n: topN, filter: `raw_pk="${file.id}"` }, return_hits: true } },
    });
    const result = payload.result && typeof payload.result === 'object' ? payload.result as Record<string, unknown> : {};
    const hits = Array.isArray(result.search_hits) ? result.search_hits as OpenSearchHit[] : [];
    const expectedTitle = this.documentTitle(file);
    const expectedUrl = `${(process.env.PUBLIC_WEB_URL || '').replace(/\/$/, '')}/api/knowledge-files/${encodeURIComponent(file.id)}`;
    for (const hit of hits) {
      if (hit.type && hit.type !== 'DOC') continue;
      if (hit.fields?.title !== expectedTitle || (hit.fields.id && hit.fields.id !== file.id) || (hit.fields.raw_pk && hit.fields.raw_pk !== file.id) || (hit.fields.url && hit.fields.url !== expectedUrl)) {
        throw new ServiceUnavailableException({ code: 'RAG_SOURCE_MISMATCH', message: '检索结果未能匹配当前产品已确认的资料' });
      }
    }
    return hits.filter((hit) => (!hit.type || hit.type === 'DOC') && typeof hit.fields?.content === 'string' && !!hit.fields.content.trim()).map((hit, index) => ({
      id: index + 1,
      fileId: file.id,
      title: file.originalName,
      locator: hit.fields?.page ? `第 ${hit.fields.page} 页` : hit.fields?.chapter ? hit.fields.chapter : `检索片段 ${index + 1}`,
      snippet: hit.fields!.content!.trim().slice(0, 1600),
      url: `/api/knowledge-files/${encodeURIComponent(file.id)}`,
    }));
  }

  private typeFromMime(mimeType: string) { return mimeType === 'application/pdf' ? 'pdf' : mimeType.includes('word') ? 'docx' : 'txt'; }
  private errorText(value: unknown) { if (!Array.isArray(value)) return ''; return value.map((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>).message === 'string' ? (item as Record<string, string>).message : '').filter(Boolean).join('; '); }
}

@Injectable()
export class KnowledgeService {
  private readonly uploadRoot = resolve(process.env.UPLOAD_DIR || resolve(process.cwd(), 'uploads'));
  private readonly maxKnowledgeBytes = 1024 * 1024;
  private readonly maxVideoBytes = 100 * 1024 * 1024;
  private readonly maxImageBytes = 10 * 1024 * 1024;
  private readonly knowledgeTypes = new Map([['.pdf', 'application/pdf'], ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], ['.txt', 'text/plain']]);
  private readonly videoTypes = new Map([['.mp4', 'video/mp4'], ['.webm', 'video/webm']]);
  private readonly imageTypes = new Map([['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.png', 'image/png'], ['.webp', 'image/webp']]);

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(AliyunOpenSearchProvider) private readonly rag: AliyunOpenSearchProvider, @Inject(DeepSeekProvider) private readonly deepSeek: DeepSeekProvider) {}

  async uploadVideo(productId: string, file: UploadedFile | undefined, actor: AuthUser) {
    if (!file) throw new BadRequestException({ code: 'VIDEO_FILE_REQUIRED', message: '请选择 MP4 或 WebM 视频文件' });
    if (!this.matchesType(file, this.videoTypes)) throw new BadRequestException({ code: 'VIDEO_TYPE_UNSUPPORTED', message: '视频仅支持 MP4 或 WebM' });
    if (!file.size) throw new BadRequestException({ code: 'VIDEO_FILE_EMPTY', message: '视频文件不能为空' });
    if (file.size > this.maxVideoBytes) throw new BadRequestException({ code: 'VIDEO_TOO_LARGE', message: '视频文件不能超过 100 MB' });
    await this.mustProduct(productId, actor);
    const stored = await this.persist(file, 'videos', productId);
    const media = await this.prisma.productMedia.create({ data: { collectionItemId: productId, kind: 'video', originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, storagePath: stored.path, mediaUrl: '/api/media/pending', status: 'ready', createdById: actor.id } });
    return this.prisma.productMedia.update({ where: { id: media.id }, data: { mediaUrl: `/api/media/${media.id}` } });
  }

  async uploadImage(productId: string, file: UploadedFile | undefined, actor: AuthUser) {
    if (!file) throw new BadRequestException({ code: 'IMAGE_FILE_REQUIRED', message: '请选择 JPG、PNG 或 WebP 图片文件' });
    if (!this.matchesType(file, this.imageTypes)) throw new BadRequestException({ code: 'IMAGE_TYPE_UNSUPPORTED', message: '产品图片仅支持 JPG、PNG 或 WebP' });
    if (!file.size) throw new BadRequestException({ code: 'IMAGE_FILE_EMPTY', message: '图片文件不能为空' });
    if (file.size > this.maxImageBytes) throw new BadRequestException({ code: 'IMAGE_TOO_LARGE', message: '产品图片不能超过 10 MB' });
    await this.mustProduct(productId, actor);
    const stored = await this.persist(file, 'images', productId);
    const media = await this.prisma.productMedia.create({ data: { collectionItemId: productId, kind: 'image', originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, storagePath: stored.path, mediaUrl: '/api/media/pending', status: 'ready', createdById: actor.id } });
    const mediaUrl = `/api/media/${media.id}`;
    await this.prisma.collectionItem.update({ where: { id: productId }, data: { coverImageUrl: mediaUrl } });
    return this.prisma.productMedia.update({ where: { id: media.id }, data: { mediaUrl } });
  }

  async listKnowledgeFiles(productId: string, actor: AuthUser) {
    await this.mustProduct(productId, actor);
    return this.prisma.knowledgeFile.findMany({ where: { collectionItemId: productId }, orderBy: { createdAt: 'desc' }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true, status: true, isPublic: true, errorMessage: true, indexDocumentId: true, createdAt: true, updatedAt: true } });
  }

  async uploadKnowledge(productId: string, file: UploadedFile | undefined, actor: AuthUser) {
    const [item] = await this.uploadKnowledgeBatch(productId, file ? [file] : [], actor);
    return item;
  }

  async uploadKnowledgeBatch(productId: string, files: UploadedFile[] | undefined, actor: AuthUser) {
    if (!files?.length) throw new BadRequestException({ code: 'KNOWLEDGE_FILE_REQUIRED', message: '请选择 PDF、DOCX 或 TXT 文件' });
    files.forEach((file) => this.validateKnowledgeFile(file));
    await this.mustProduct(productId, actor);
    return Promise.all(files.map(async (file) => {
      const stored = await this.persist(file, 'knowledge', productId);
      return this.prisma.knowledgeFile.create({ data: { collectionItemId: productId, originalName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, storagePath: stored.path, status: 'pending', isPublic: false, createdById: actor.id } });
    }));
  }

  async confirmKnowledge(productId: string, fileId: string, actor: AuthUser) {
    await this.mustProduct(productId, actor);
    const file = await this.prisma.knowledgeFile.findFirst({ where: { id: fileId, collectionItemId: productId } });
    if (!file) throw new NotFoundException({ code: 'KNOWLEDGE_FILE_NOT_FOUND', message: '知识文件不存在' });
    await this.prisma.knowledgeFile.update({ where: { id: file.id }, data: { status: 'indexing', errorMessage: null } });
    try {
      const indexed = await this.rag.pushDocument({ id: file.id, originalName: file.originalName, mimeType: file.mimeType, content: await this.readFileContent(file.storagePath) });
      // OpenSearch 接收文件后仍异步解析；只有实际检索命中才能标为可检索。
      return await this.prisma.knowledgeFile.update({ where: { id: file.id }, data: { status: 'indexing', isPublic: true, indexDocumentId: indexed.documentId, confirmedAt: new Date(), confirmedById: actor.id, errorMessage: null } });
    } catch (error) {
      await this.prisma.knowledgeFile.update({ where: { id: file.id }, data: { status: 'failed', isPublic: false, errorMessage: this.errorMessage(error) } });
      throw error;
    }
  }

  async verifyKnowledge(productId: string, fileId: string, actor: AuthUser) {
    await this.mustProduct(productId, actor);
    const file = await this.prisma.knowledgeFile.findFirst({ where: { id: fileId, collectionItemId: productId, status: { in: ['indexing', 'ready'] }, isPublic: true, confirmedAt: { not: null } } });
    if (!file) throw new NotFoundException({ code: 'KNOWLEDGE_FILE_NOT_CONFIRMED', message: '知识文件尚未确认或不存在' });
    if (file.status === 'ready') return file;
    const hits = await this.rag.retrieve(file.originalName, file);
    return hits.length ? this.prisma.knowledgeFile.update({ where: { id: file.id }, data: { status: 'ready' } }) : file;
  }

  async publicKnowledgeFile(fileId: string) {
    const file = await this.prisma.knowledgeFile.findFirst({ where: { id: fileId, status: 'ready', isPublic: true, collectionItem: { lifecycleStatus: 'published' } } });
    if (!file) throw new NotFoundException({ code: 'KNOWLEDGE_FILE_NOT_FOUND', message: '资料不存在或尚未公开' });
    return file;
  }

  async publicMedia(mediaId: string) {
    const media = await this.prisma.productMedia.findFirst({ where: { id: mediaId, kind: { in: ['video', 'image'] }, status: 'ready', collectionItem: { lifecycleStatus: 'published' } } });
    if (!media) throw new NotFoundException({ code: 'MEDIA_NOT_FOUND', message: '媒体不存在或尚未公开' });
    return media;
  }

  async ask(brandSlug: string, productSlug: string, question: string) {
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion) throw new BadRequestException({ code: 'QUESTION_REQUIRED', message: '请输入要咨询的问题' });
    const product = await this.prisma.collectionItem.findFirst({ where: { slug: productSlug, lifecycleStatus: 'published', organization: { slug: brandSlug } }, select: { id: true, knowledgeFiles: { where: { status: { in: ['indexing', 'ready'] }, isPublic: true, confirmedAt: { not: null } }, select: { id: true, originalName: true, status: true } } } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '产品不存在或尚未公开' });
    if (!product.knowledgeFiles.length) throw new ServiceUnavailableException({ code: 'RAG_NOT_READY', message: '该产品尚未有已确认的知识资料' });
    this.deepSeek.assertConfigured();
    const snippetsByFile = await Promise.all(product.knowledgeFiles.map((file) => this.rag.retrieve(normalizedQuestion, file)));
    const matchedFileIds = product.knowledgeFiles.filter((_, index) => snippetsByFile[index].length > 0).map((file) => file.id);
    if (matchedFileIds.length) await this.prisma.knowledgeFile.updateMany({ where: { id: { in: matchedFileIds }, collectionItemId: product.id, status: 'indexing' }, data: { status: 'ready' } });
    const citations = snippetsByFile.flat().slice(0, 5).map(({ fileId: _fileId, ...citation }, index) => ({ ...citation, id: index + 1 }));
    if (!citations.length) return { answer: '当前资料无法确认', citations: [], insufficientEvidence: true };
    return this.deepSeek.answer(normalizedQuestion, citations);
  }

  async mediaSize(media: { storagePath: string }) {
    const path = resolve(media.storagePath); this.assertInsideUploadRoot(path);
    try { return (await stat(path)).size; }
    catch { throw new NotFoundException({ code: 'MEDIA_FILE_NOT_FOUND', message: '视频文件不存在' }); }
  }
  async createMediaStream(media: { storagePath: string }, range?: { start: number; end: number }) { const path = resolve(media.storagePath); this.assertInsideUploadRoot(path); return createReadStream(path, range); }

  private async mustProduct(id: string, actor: AuthUser) {
    if (!actor.organizationId) throw new ForbiddenException({ code: 'ORGANIZATION_REQUIRED', message: '当前账号未绑定企业' });
    const product = await this.prisma.collectionItem.findFirst({ where: { id, organizationId: actor.organizationId } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '产品不存在或无权访问' });
    return product;
  }
  private async persist(file: UploadedFile, kind: string, productId: string) {
    const directory = resolve(this.uploadRoot, kind, productId); await mkdir(directory, { recursive: true });
    const id = randomUUID(); const path = resolve(directory, `${id}${extname(file.originalname).toLowerCase() || '.bin'}`); this.assertInsideUploadRoot(path);
    if (!file.buffer) throw new BadRequestException({ code: 'UPLOAD_EMPTY', message: '上传文件内容为空' }); await writeFile(path, file.buffer); return { id, path };
  }
  private async readFileContent(path: string) { const resolved = resolve(path); this.assertInsideUploadRoot(resolved); return readFile(resolved); }
  private assertInsideUploadRoot(path: string) { const relativePath = relative(this.uploadRoot, path); if (isAbsolute(relativePath) || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || relativePath === '..') throw new ForbiddenException({ code: 'UPLOAD_PATH_INVALID', message: '文件路径无效' }); }
  private matchesType(file: UploadedFile, allowed: Map<string, string>) { return allowed.get(extname(file.originalname).toLowerCase()) === file.mimetype; }
  private validateKnowledgeFile(file: UploadedFile) {
    if (!this.matchesType(file, this.knowledgeTypes)) throw new BadRequestException({ code: 'KNOWLEDGE_TYPE_UNSUPPORTED', message: '资料仅支持 PDF、DOCX 或 TXT，文件扩展名与类型必须一致' });
    if (!file.size) throw new BadRequestException({ code: 'KNOWLEDGE_FILE_EMPTY', message: '资料文件不能为空' });
    if (file.size > this.maxKnowledgeBytes) throw new BadRequestException({ code: 'KNOWLEDGE_TOO_LARGE', message: '资料文件不能超过 1 MB' });
  }
  private errorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 500) : '索引失败'; }
}
