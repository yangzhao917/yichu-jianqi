import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, COLLECTION_STATUSES, PROVENANCE_STATUSES } from '../common/constants';
import { CreateCollectionDto, ProvenanceDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

const publicItemInclude = {
  contents: { where: { status: 'approved' }, orderBy: { createdAt: 'desc' as const } },
  provenance: { orderBy: { accessedAt: 'desc' as const } },
  organization: true,
} satisfies Prisma.CollectionItemInclude;

@Injectable()
export class CollectionsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get webUrl() {
    return (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  }

  async listPublic(params: { search?: string; category?: string; page?: number; limit?: number }) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 24, 1), 100);
    const where: Prisma.CollectionItemWhereInput = {
      lifecycleStatus: 'published',
      contents: { some: { status: 'approved' } },
      ...(params.category ? { category: params.category } : {}),
      ...(params.search ? { OR: [{ title: { contains: params.search } }, { summary: { contains: params.search } }] } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.collectionItem.count({ where }),
      this.prisma.collectionItem.findMany({ where, include: publicItemInclude, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    const baseUrl = await this.nfcBaseUrl();
    return { items: items.map((item) => this.toPublic(item, baseUrl)), page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async getPublicBySlug(slug: string) {
    const item = await this.prisma.collectionItem.findFirst({ where: { slug, lifecycleStatus: 'published', contents: { some: { status: 'approved' } } }, include: publicItemInclude });
    if (!item) throw new NotFoundException({ code: 'COLLECTION_NOT_FOUND', message: '产品不存在或尚未公开' });
    return this.toPublic(item, await this.nfcBaseUrl());
  }

  /** B2B public catalog: the brand slug is part of the lookup boundary. */
  async getPublicBrand(brandSlug: string) {
    const organization = await this.prisma.organization.findUnique({ where: { slug: brandSlug }, select: { id: true, slug: true, name: true, tagline: true, description: true, logoUrl: true } });
    if (!organization) throw new NotFoundException({ code: 'BRAND_NOT_FOUND', message: '展商不存在' });
    const items = await this.prisma.collectionItem.findMany({ where: { organizationId: organization.id, lifecycleStatus: 'published' }, include: publicItemInclude, orderBy: { updatedAt: 'desc' } });
    return { brand: organization, products: items.map((item) => this.toProductPublic(item, organization.slug)) };
  }

  async getPublicProduct(brandSlug: string, productSlug: string) {
    const organization = await this.prisma.organization.findUnique({ where: { slug: brandSlug }, select: { id: true, slug: true, name: true, tagline: true, description: true, logoUrl: true } });
    if (!organization) throw new NotFoundException({ code: 'BRAND_NOT_FOUND', message: '展商不存在' });
    const item = await this.prisma.collectionItem.findFirst({ where: { organizationId: organization.id, slug: productSlug, lifecycleStatus: 'published' }, include: publicItemInclude });
    if (!item) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '产品不存在或尚未公开' });
    return this.toProductPublic(item, organization.slug);
  }

  async getPublicProductQr(brandSlug: string, productSlug: string) {
    const product = await this.getPublicProduct(brandSlug, productSlug);
    if (!(await this.publicFeatureEnabled('featureQr', product.brand?.id ?? undefined))) throw new BadRequestException({ code: 'FEATURE_QR_DISABLED', message: '二维码入口已由展商配置关闭' });
    const url = `${await this.publicBrandBaseUrl(brandSlug)}/p/${encodeURIComponent(product.slug)}`;
    return { url, dataUrl: await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 640 }) };
  }

  async getQrCode(slug: string) {
    if (!(await this.publicFeatureEnabled('featureQr'))) throw new BadRequestException({ code: 'FEATURE_QR_DISABLED', message: '二维码入口已由企业配置关闭' });
    const item = await this.prisma.collectionItem.findFirst({ where: { slug, lifecycleStatus: 'published', contents: { some: { status: 'approved' } } }, select: { slug: true } });
    if (!item) throw new NotFoundException({ code: 'COLLECTION_NOT_FOUND', message: '产品不存在或尚未公开' });
    const url = `${await this.nfcBaseUrl()}/${encodeURIComponent(item.slug)}`;
    return { url, dataUrl: await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 640 }) };
  }

  async listManage(query: { search?: string; status?: string; page?: number; limit?: number }, actor?: AuthUser) {
    if (query.status && !COLLECTION_STATUSES.includes(query.status as (typeof COLLECTION_STATUSES)[number])) {
      throw new BadRequestException({ code: 'INVALID_COLLECTION_STATUS', message: '不支持的产品状态' });
    }
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const where: Prisma.CollectionItemWhereInput = {
      ...(actor?.organizationId ? { organizationId: actor.organizationId } : { organizationId: '__missing_org__' }),
      ...(query.status ? { lifecycleStatus: query.status } : {}),
      ...(query.search ? { OR: [{ title: { contains: query.search } }, { slug: { contains: query.search } }] } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.collectionItem.count({ where }),
      this.prisma.collectionItem.findMany({ where, include: { contents: { orderBy: { createdAt: 'desc' } }, provenance: { orderBy: { accessedAt: 'desc' } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateCollectionDto, actor: AuthUser) {
    if (!actor.organizationId) throw new BadRequestException({ code: 'ORGANIZATION_REQUIRED', message: '当前账号尚未绑定展商' });
    const slug = dto.slug ?? this.slugFromTitle(dto.title);
    try {
      const item = await this.prisma.collectionItem.create({
        data: {
          slug,
          title: dto.title,
          summary: dto.summary,
          description: dto.description,
          era: dto.era,
          location: dto.location,
          category: dto.category,
          coverImageUrl: dto.coverImageUrl,
          lifecycleStatus: dto.lifecycleStatus ?? 'draft',
          organizationId: actor.organizationId,
          useCase: dto.useCase,
          audience: dto.audience,
          specificationsJson: dto.specifications ? JSON.stringify(dto.specifications) : null,
          resourcesJson: dto.resources ? JSON.stringify(dto.resources) : null,
          createdById: actor.id,
          ...(dto.provenance ? { provenance: { create: this.provenanceData(dto.provenance, actor.id) } } : {}),
        },
        include: { provenance: true, contents: true },
      });
      await this.audit(actor, 'collection.create', 'CollectionItem', item.id, { slug: item.slug });
      return item;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException({ code: 'SLUG_EXISTS', message: '该稳定链接标识已存在' });
      throw error;
    }
  }

  async update(id: string, dto: UpdateCollectionDto, actor: AuthUser) {
    await this.mustFind(id, actor);
    try {
      const { specifications, resources, ...fields } = dto;
      const item = await this.prisma.collectionItem.update({ where: { id }, data: { ...fields, ...(specifications !== undefined ? { specificationsJson: JSON.stringify(specifications) } : {}), ...(resources !== undefined ? { resourcesJson: JSON.stringify(resources) } : {}) }, include: { provenance: true, contents: true, organization: true } });
      await this.audit(actor, 'collection.update', 'CollectionItem', id, dto);
      return item;
    } catch (error) {
      if (this.isUniqueError(error)) throw new ConflictException({ code: 'SLUG_EXISTS', message: '该稳定链接标识已存在' });
      throw error;
    }
  }

  async archive(id: string, actor: AuthUser) {
    await this.mustFind(id, actor);
    const item = await this.prisma.collectionItem.update({ where: { id }, data: { lifecycleStatus: 'archived' } });
    await this.audit(actor, 'collection.archive', 'CollectionItem', id, {});
    return item;
  }

  async addProvenance(id: string, dto: ProvenanceDto, actor: AuthUser) {
    await this.mustFind(id, actor);
    const record = await this.prisma.provenanceRecord.create({ data: { collectionItemId: id, ...this.provenanceData(dto, actor.id) } });
    await this.audit(actor, 'provenance.create', 'CollectionItem', id, { provenanceId: record.id });
    return record;
  }

  private provenanceData(dto: ProvenanceDto, actorId: string) {
    return { sourceName: dto.sourceName, sourceUrl: dto.sourceUrl, sourceLocator: dto.sourceLocator, accessedAt: new Date(), verificationStatus: dto.verificationStatus ?? 'needs_evidence', notes: dto.notes, createdById: actorId };
  }

  private async mustFind(id: string, actor?: AuthUser) {
    const item = await this.prisma.collectionItem.findFirst({ where: { id, ...(actor?.organizationId ? { organizationId: actor.organizationId } : { organizationId: '__missing_org__' }) } });
    if (!item) throw new NotFoundException({ code: 'COLLECTION_NOT_FOUND', message: '产品不存在' });
    return item;
  }

  private toPublic(item: Prisma.CollectionItemGetPayload<{ include: typeof publicItemInclude }>, baseUrl: string) {
    return { ...item, shareUrl: `${baseUrl}/${encodeURIComponent(item.slug)}`, qrEndpoint: `/collections/${encodeURIComponent(item.slug)}/qrcode` };
  }

  private toProductPublic(item: Prisma.CollectionItemGetPayload<{ include: typeof publicItemInclude }>, brandSlug: string) {
    const parseArray = (value: string | null | undefined) => {
      if (!value) return [];
      try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
    };
    return {
      id: item.id,
      slug: item.slug,
      productSlug: item.slug,
      title: item.title,
      summary: item.summary,
      description: item.description,
      useCase: item.useCase || item.summary,
      audience: item.audience,
      era: item.era,
      location: item.location,
      category: item.category,
      coverImageUrl: item.coverImageUrl,
      lifecycleStatus: item.lifecycleStatus,
      contents: item.contents,
      provenance: item.provenance,
      specifications: parseArray(item.specificationsJson),
      resources: parseArray(item.resourcesJson),
      brand: item.organization,
      shareUrl: `${this.publicBrandPath(brandSlug)}/p/${encodeURIComponent(item.slug)}`,
      qrEndpoint: `/brands/${encodeURIComponent(brandSlug)}/products/${encodeURIComponent(item.slug)}/qrcode`,
    };
  }

  private publicBrandPath(brandSlug: string) { return `/b/${encodeURIComponent(brandSlug)}`; }

  private async publicBrandBaseUrl(brandSlug: string) {
    const setting = await this.prisma.organizationSetting.findFirst({ where: { organization: { slug: brandSlug }, key: 'publicWebUrl' }, select: { valueJson: true } });
    let value: unknown;
    try { value = setting ? JSON.parse(setting.valueJson) : undefined; } catch { value = undefined; }
    const configured = typeof value === 'string' && value.trim() ? value.trim() : this.webUrl;
    return `${configured.replace(/\/$/, '')}/b/${encodeURIComponent(brandSlug)}`;
  }

  private async nfcBaseUrl() {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'nfcBaseUrl' }, select: { valueJson: true } });
    let value: unknown;
    try { value = setting ? JSON.parse(setting.valueJson) : undefined; } catch { value = undefined; }
    const configured = typeof value === 'string' && value.trim() ? value.trim() : `${this.webUrl}/collections`;
    return configured.replace(/\/$/, '');
  }

  private async publicFeatureEnabled(key: string, organizationId?: string) {
    const setting = organizationId
      ? await this.prisma.organizationSetting.findUnique({ where: { organizationId_key: { organizationId, key } }, select: { valueJson: true } })
      : await this.prisma.systemSetting.findUnique({ where: { key }, select: { valueJson: true } });
    if (!setting) return true;
    try { return JSON.parse(setting.valueJson) !== false; } catch { return true; }
  }

  private slugFromTitle(title: string) {
    const normalized = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return normalized || `collection-${Date.now()}`;
  }

  private isUniqueError(error: unknown): error is { code: string } {
    return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002';
  }

  private async audit(actor: AuthUser, action: string, entityType: string, entityId: string, details: unknown) {
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action, entityType, entityId, detailsJson: JSON.stringify(details) } });
  }
}
