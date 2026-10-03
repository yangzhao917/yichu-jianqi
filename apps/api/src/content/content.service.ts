import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, CONTENT_STATUSES, ContentStatus } from '../common/constants';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';

type ModerationPolicy = {
  requireReviewedProvenance: boolean;
  requireHumanApproval: boolean;
};

const DEFAULT_MODERATION_POLICY: ModerationPolicy = {
  requireReviewedProvenance: true,
  requireHumanApproval: true,
};

@Injectable()
export class ContentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listReviewQueue(status?: string, actor?: AuthUser) {
    if (status && !CONTENT_STATUSES.includes(status as ContentStatus)) {
      throw new BadRequestException({ code: 'INVALID_CONTENT_STATUS', message: '不支持的内容状态' });
    }
    return this.prisma.contentVersion.findMany({
      where: { ...(status ? { status } : { status: { in: ['in_review', 'rejected'] } }), ...(actor?.organizationId ? { collectionItem: { organizationId: actor.organizationId } } : { collectionItem: { organizationId: '__missing_org__' } }) },
      include: { collectionItem: { include: { provenance: true } }, reviewedBy: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: 'asc' },
    });
  }

  async listAll(status?: string, actor?: AuthUser) {
    if (status && !CONTENT_STATUSES.includes(status as ContentStatus)) {
      throw new BadRequestException({ code: 'INVALID_CONTENT_STATUS', message: '不支持的内容状态' });
    }
    return this.prisma.contentVersion.findMany({
      where: { ...(status ? { status } : {}), ...(actor?.organizationId ? { collectionItem: { organizationId: actor.organizationId } } : { collectionItem: { organizationId: '__missing_org__' } }) },
      include: { collectionItem: { select: { id: true, slug: true, title: true, lifecycleStatus: true } }, reviewedBy: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async create(collectionItemId: string, dto: CreateContentDto, actor: AuthUser) {
    await this.mustCollection(collectionItemId, actor);
    const content = await this.prisma.contentVersion.create({ data: { collectionItemId, title: dto.title, kind: dto.kind ?? 'video', script: dto.script, narrationText: dto.narrationText, mediaUrl: dto.mediaUrl, reviewerNote: dto.reviewerNote } });
    await this.audit(actor, 'content.create', 'ContentVersion', content.id, { collectionItemId });
    return content;
  }

  async update(id: string, dto: UpdateContentDto, actor: AuthUser) {
    const content = await this.mustFind(id, actor);
    if (!['draft', 'rejected'].includes(content.status)) {
      throw new BadRequestException({ code: 'CONTENT_LOCKED', message: '只有草稿或退回内容可以编辑，已审核内容请创建新版本' });
    }
    const updated = await this.prisma.contentVersion.update({ where: { id }, data: { ...dto, reviewerNote: dto.reviewerNote ?? null } });
    await this.audit(actor, 'content.update', 'ContentVersion', id, dto);
    return updated;
  }

  async submit(id: string, actor: AuthUser) {
    const content = await this.mustFind(id, actor);
    if (!['draft', 'rejected'].includes(content.status)) {
      throw new BadRequestException({ code: 'INVALID_CONTENT_TRANSITION', message: '只有草稿或退回内容可以送审' });
    }
    const policy = await this.moderationPolicy(actor);
    if (!policy.requireHumanApproval) {
      await this.assertReviewedProvenance(content.collectionItemId, policy);
      const updated = await this.publish(id, content.collectionItemId, actor.id, '按企业审核策略自动发布');
      await this.audit(actor, 'content.auto_approve', 'ContentVersion', id, { from: content.status, to: 'approved', policy });
      return updated;
    }
    const updated = await this.prisma.contentVersion.update({ where: { id }, data: { status: 'in_review', reviewerNote: null, reviewedAt: null, reviewedById: null } });
    await this.audit(actor, 'content.submit', 'ContentVersion', id, { from: content.status, to: 'in_review' });
    return updated;
  }

  async approve(id: string, actor: AuthUser, note: string) {
    const content = await this.mustFind(id, actor);
    if (content.status !== 'in_review') {
      throw new BadRequestException({ code: 'INVALID_CONTENT_TRANSITION', message: '只有送审中的内容可以批准' });
    }
    const policy = await this.moderationPolicy(actor);
    await this.assertReviewedProvenance(content.collectionItemId, policy);
    const updated = await this.publish(id, content.collectionItemId, actor.id, note);
    await this.audit(actor, 'content.approve', 'ContentVersion', id, { note });
    return updated;
  }

  async reject(id: string, actor: AuthUser, note: string) {
    const content = await this.mustFind(id, actor);
    if (content.status !== 'in_review') {
      throw new BadRequestException({ code: 'INVALID_CONTENT_TRANSITION', message: '只有送审中的内容可以退回' });
    }
    const updated = await this.prisma.contentVersion.update({ where: { id }, data: { status: 'rejected', reviewerNote: note, reviewedAt: new Date(), reviewedById: actor.id } });
    await this.audit(actor, 'content.reject', 'ContentVersion', id, { note });
    return updated;
  }

  private async mustFind(id: string, actor?: AuthUser) {
    const content = await this.prisma.contentVersion.findFirst({ where: { id, ...(actor?.organizationId ? { collectionItem: { organizationId: actor.organizationId } } : { collectionItem: { organizationId: '__missing_org__' } }) } });
    if (!content) throw new NotFoundException({ code: 'CONTENT_NOT_FOUND', message: '内容版本不存在' });
    return content;
  }

  private async mustCollection(id: string, actor?: AuthUser) {
    const item = await this.prisma.collectionItem.findFirst({ where: { id, ...(actor?.organizationId ? { organizationId: actor.organizationId } : { organizationId: '__missing_org__' }) } });
    if (!item) throw new NotFoundException({ code: 'COLLECTION_NOT_FOUND', message: '关联产品不存在' });
    return item;
  }

  private async moderationPolicy(actor?: AuthUser): Promise<ModerationPolicy> {
    const row = actor?.organizationId
      ? await this.prisma.organizationSetting.findUnique({ where: { organizationId_key: { organizationId: actor.organizationId, key: 'moderationPolicy' } }, select: { valueJson: true } })
      : await this.prisma.systemSetting.findUnique({ where: { key: 'moderationPolicy' }, select: { valueJson: true } });
    if (!row) return DEFAULT_MODERATION_POLICY;
    try {
      const value: unknown = JSON.parse(row.valueJson);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_MODERATION_POLICY;
      const policy = value as Record<string, unknown>;
      // 策略缺失或类型不正确时保持默认的收紧行为，只有显式 false 才关闭门槛。
      return {
        requireReviewedProvenance: policy.requireReviewedProvenance !== false,
        requireHumanApproval: policy.requireHumanApproval !== false,
      };
    } catch {
      return DEFAULT_MODERATION_POLICY;
    }
  }

  private async assertReviewedProvenance(collectionItemId: string, policy: ModerationPolicy) {
    if (!policy.requireReviewedProvenance) return;
    const provenance = await this.prisma.provenanceRecord.findMany({ where: { collectionItemId } });
    if (!provenance.length || provenance.some((record) => record.verificationStatus !== 'reviewed')) {
      throw new BadRequestException({ code: 'PROVENANCE_INCOMPLETE', message: '来源材料尚未全部核验，不能发布内容' });
    }
  }

  private async publish(id: string, collectionItemId: string, actorId: string, reviewerNote: string) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.contentVersion.update({ where: { id }, data: { status: 'approved', reviewerNote, reviewedAt: new Date(), reviewedById: actorId } });
      await tx.collectionItem.update({ where: { id: collectionItemId }, data: { lifecycleStatus: 'published' } });
      return result;
    });
  }

  private async audit(actor: AuthUser, action: string, entityType: string, entityId: string, details: unknown) {
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action, entityType, entityId, detailsJson: JSON.stringify(details) } });
  }
}
