import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import QRCode from 'qrcode';
import { AuthUser } from '../common/constants';
import { CreateInteractionDto } from './dto/create-interaction.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class B2bService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async updateBrand(dto: UpdateBrandDto, actor: AuthUser) {
    const organizationId = this.requireOrganization(actor);
    const values = Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined));
    if (!Object.keys(values).length) throw new BadRequestException({ code: 'BRAND_UPDATE_EMPTY', message: '至少提交一项企业信息' });
    return this.prisma.organization.update({ where: { id: organizationId }, data: values });
  }

  async brand(slug: string) {
    const organization = await this.prisma.organization.findUnique({ where: { slug }, include: { products: { where: { lifecycleStatus: 'published' }, orderBy: { updatedAt: 'desc' }, include: { organization: true, contents: { where: { status: 'approved' }, orderBy: { updatedAt: 'desc' }, take: 3 }, mediaAssets: { where: { kind: 'video', status: 'ready' }, orderBy: { createdAt: 'desc' }, take: 1 }, knowledgeFiles: { where: { status: 'ready', isPublic: true }, orderBy: { createdAt: 'desc' } } } } } });
    if (!organization) throw new NotFoundException({ code: 'BRAND_NOT_FOUND', message: '企业品牌不存在或尚未公开' });
    const brand = { id: organization.id, slug: organization.slug, name: organization.name, tagline: organization.tagline, description: organization.description, logoUrl: organization.logoUrl };
    return { brand, products: organization.products.map((product) => this.toPublicProduct(product)) };
  }

  async publicProduct(brandSlug: string, productSlug: string) {
    const product = await this.prisma.collectionItem.findFirst({ where: { slug: productSlug, lifecycleStatus: 'published', organization: { slug: brandSlug } }, include: { organization: true, contents: { where: { status: 'approved' }, orderBy: { updatedAt: 'desc' } }, mediaAssets: { where: { kind: 'video', status: 'ready' }, orderBy: { createdAt: 'desc' }, take: 1 }, knowledgeFiles: { where: { status: 'ready', isPublic: true }, orderBy: { createdAt: 'desc' } }, provenance: { where: { verificationStatus: 'reviewed' }, orderBy: { accessedAt: 'desc' } } } });
    if (!product || !product.organization) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '产品不存在或尚未公开' });
    return this.toPublicProduct(product);
  }

  async productQr(brandSlug: string, productSlug: string) {
    const product = await this.publicProduct(brandSlug, productSlug);
    const base = (process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');
    const url = `${base}/b/${encodeURIComponent(brandSlug)}/p/${encodeURIComponent(product.slug)}`;
    return { url, dataUrl: await QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 2, width: 640 }) };
  }

  async listProducts(actor: AuthUser, status?: string) {
    const organizationId = this.requireOrganization(actor);
    const products = await this.prisma.collectionItem.findMany({ where: { organizationId, ...(status ? { lifecycleStatus: status } : {}) }, include: { contents: { orderBy: { updatedAt: 'desc' } }, mediaAssets: { where: { kind: 'video', status: 'ready' }, orderBy: { createdAt: 'desc' }, take: 1 }, provenance: { orderBy: { accessedAt: 'desc' } }, organization: true }, orderBy: { updatedAt: 'desc' } });
    return products.map((product) => this.manageProduct(product));
  }

  async createProduct(dto: CreateProductDto, actor: AuthUser) {
    const organizationId = this.requireOrganization(actor);
    const title = (dto.name ?? dto.title ?? '').trim();
    if (title.length < 2) throw new BadRequestException({ code: 'PRODUCT_NAME_REQUIRED', message: '产品名称不能为空' });
    const slug = dto.slug ?? this.slugFromTitle(title);
    try {
      const product = await this.prisma.collectionItem.create({ data: { organizationId, slug, title, summary: dto.summary, description: dto.description, useCase: dto.useCase, audience: dto.audience, category: dto.category, specificationsJson: dto.specifications ? JSON.stringify(dto.specifications) : null, resourcesJson: dto.resources ? JSON.stringify(dto.resources) : null, coverImageUrl: dto.coverImageUrl, lifecycleStatus: dto.lifecycleStatus ?? 'draft', createdById: actor.id }, include: { organization: true } });
      return this.manageProduct(product);
    } catch (error) {
      if (this.isUnique(error)) throw new BadRequestException({ code: 'PRODUCT_SLUG_EXISTS', message: '该企业下的产品链接标识已存在' });
      throw error;
    }
  }

  async updateProduct(id: string, dto: UpdateProductDto, actor: AuthUser) {
    const organizationId = this.requireOrganization(actor);
    await this.mustProduct(id, organizationId);
    const data: Prisma.CollectionItemUpdateInput = { ...dto, ...(dto.name || dto.title ? { title: dto.name ?? dto.title } : {}), ...(dto.specifications !== undefined ? { specificationsJson: JSON.stringify(dto.specifications) } : {}), ...(dto.resources !== undefined ? { resourcesJson: JSON.stringify(dto.resources) } : {}) };
    delete (data as Record<string, unknown>).name;
    delete (data as Record<string, unknown>).specifications;
    delete (data as Record<string, unknown>).resources;
    return this.prisma.collectionItem.update({ where: { id }, data, include: { organization: true, contents: true, mediaAssets: { where: { kind: 'video', status: 'ready' }, orderBy: { createdAt: 'desc' }, take: 1 }, provenance: true } });
  }

  async archiveProduct(id: string, actor: AuthUser) {
    const organizationId = this.requireOrganization(actor);
    await this.mustProduct(id, organizationId);
    return this.prisma.collectionItem.update({ where: { id }, data: { lifecycleStatus: 'archived' } });
  }

  async createInteraction(dto: CreateInteractionDto) {
    const product = await this.resolvePublicProduct(dto.brandSlug, dto.productSlug, dto.productId);
    const interaction = await this.prisma.interaction.create({ data: { organizationId: product.organizationId!, collectionItemId: product.id, event: dto.event, source: dto.source ?? 'direct', sessionId: dto.sessionId } });
    return { id: interaction.id, accepted: true };
  }

  async interactionSummary(actor: AuthUser) {
    const organizationId = this.requireOrganization(actor);
    const rows = await this.prisma.interaction.findMany({ where: { organizationId }, select: { event: true, source: true, collectionItemId: true, collectionItem: { select: { slug: true } } } });
    const productMap = new Map<string, { productId: string; productSlug?: string; views: number; plays: number }>();
    const sourceMap = new Map<string, number>();
    let totalViews = 0;
    let totalPlays = 0;
    for (const row of rows) {
      if (row.event === 'view') totalViews += 1;
      if (row.event === 'play') totalPlays += 1;
      if (row.collectionItemId) {
        const entry = productMap.get(row.collectionItemId) || { productId: row.collectionItemId, productSlug: row.collectionItem?.slug, views: 0, plays: 0 };
        if (row.event === 'view') entry.views += 1;
        if (row.event === 'play') entry.plays += 1;
        productMap.set(row.collectionItemId, entry);
      }
      sourceMap.set(row.source, (sourceMap.get(row.source) || 0) + 1);
    }
    return { totalViews, totalPlays, byProduct: [...productMap.values()], bySource: [...sourceMap.entries()].map(([source, count]) => ({ source, count })) };
  }

  async createLead(dto: CreateLeadDto) {
    const product = await this.resolvePublicProduct(dto.brandSlug, dto.productSlug, dto.productId);
    const consent = dto.consentGiven ?? dto.consent ?? false;
    if (!consent) throw new BadRequestException({ code: 'LEAD_CONSENT_REQUIRED', message: '提交联系信息前必须明确同意用途说明' });
    if (!dto.phone && !dto.email) throw new BadRequestException({ code: 'LEAD_CONTACT_REQUIRED', message: '请至少填写手机号或邮箱' });
    const lead = await this.prisma.lead.create({ data: { organizationId: product.organizationId!, collectionItemId: product.id, name: dto.name.trim(), phone: dto.phone?.trim() || null, email: dto.email?.trim() || null, company: dto.company?.trim() || null, message: dto.message?.trim() || null, consent: true, consentedAt: new Date(), source: dto.source ?? 'direct' } });
    return { id: lead.id, accepted: true, status: lead.status };
  }

  async listLeads(actor: AuthUser, status?: string) {
    const organizationId = this.requireOrganization(actor);
    const leads = await this.prisma.lead.findMany({ where: { organizationId, ...(status ? { status } : {}) }, include: { collectionItem: { select: { id: true, slug: true, title: true } } }, orderBy: { createdAt: 'desc' } });
    return leads.map((lead) => ({ ...lead, productTitle: lead.collectionItem?.title ?? null, productSlug: lead.collectionItem?.slug ?? null }));
  }

  async updateLead(id: string, dto: UpdateLeadDto, actor: AuthUser) {
    const organizationId = this.requireOrganization(actor);
    const lead = await this.prisma.lead.findFirst({ where: { id, organizationId } });
    if (!lead) throw new NotFoundException({ code: 'LEAD_NOT_FOUND', message: '线索不存在或无权访问' });
    return this.prisma.lead.update({ where: { id }, data: { status: dto.status } });
  }

  private async resolvePublicProduct(brandSlug?: string, productSlug?: string, productId?: string) {
    if (!brandSlug || (!productSlug && !productId)) throw new BadRequestException({ code: 'PRODUCT_REQUIRED', message: '需要提供品牌和产品标识' });
    const product = await this.prisma.collectionItem.findFirst({ where: { ...(productId ? { id: productId, organization: { slug: brandSlug } } : { slug: productSlug, organization: { slug: brandSlug } }), lifecycleStatus: 'published' }, select: { id: true, organizationId: true, slug: true, title: true } });
    if (!product || !product.organizationId) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '产品不存在或尚未公开' });
    return product;
  }

  private requireOrganization(actor: AuthUser) {
    if (!actor.organizationId) throw new ForbiddenException({ code: 'ORGANIZATION_REQUIRED', message: '当前账号未绑定企业，不能访问企业数据' });
    return actor.organizationId;
  }

  private async mustProduct(id: string, organizationId: string) {
    const product = await this.prisma.collectionItem.findFirst({ where: { id, organizationId } });
    if (!product) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '产品不存在或无权访问' });
    return product;
  }

  private toPublicProduct(product: any) {
    const approved = (product.contents ?? []).filter((content: any) => content.status === 'approved');
    const media = product.mediaAssets?.[0];
    return { id: product.id, slug: product.slug, productSlug: product.slug, title: product.title, name: product.title, summary: product.summary, description: product.description, useCase: product.useCase, audience: product.audience, lifecycleStatus: product.lifecycleStatus, status: product.lifecycleStatus, specifications: this.parse(product.specificationsJson), resources: this.parse(product.resourcesJson), coverImageUrl: product.coverImageUrl, brand: product.organization ? { slug: product.organization.slug, name: product.organization.name, tagline: product.organization.tagline, description: product.organization.description, logoUrl: product.organization.logoUrl } : undefined, mediaUrl: media?.mediaUrl || approved.find((content: any) => content.mediaUrl)?.mediaUrl || null, mediaStatus: media?.mediaUrl ? 'ready' : 'pending', contents: approved.map((content: any) => ({ id: content.id, title: content.title, kind: content.kind, script: content.script, mediaUrl: content.mediaUrl, mediaStatus: content.mediaUrl ? 'ready' : 'pending', updatedAt: content.updatedAt })), knowledgeFiles: (product.knowledgeFiles ?? []).map((file: any) => ({ id: file.id, title: file.originalName, originalName: file.originalName, status: file.status, url: `/api/knowledge-files/${encodeURIComponent(file.id)}`, createdAt: file.createdAt })), shareUrl: `/b/${encodeURIComponent(product.organization?.slug ?? '')}/p/${encodeURIComponent(product.slug)}` };
  }

  private manageProduct(product: any) {
    return { ...product, name: product.title, brandSlug: product.organization?.slug ?? product.brandSlug ?? null, mediaUrl: product.mediaAssets?.[0]?.mediaUrl || null, mediaStatus: product.mediaAssets?.[0]?.mediaUrl ? 'ready' : 'pending', specifications: this.parse(product.specificationsJson), resources: this.parse(product.resourcesJson) };
  }

  private parse(value?: string | null): unknown { if (!value) return []; try { return JSON.parse(value); } catch { return []; } }
  private slugFromTitle(title: string) { return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `product-${Date.now()}`; }
  private isUnique(error: unknown): error is { code: string } { return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'; }
}
