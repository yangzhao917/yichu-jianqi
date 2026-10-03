import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, WORKFLOW_STEPS } from '../common/constants';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { WorkflowEvidenceDto } from './dto/workflow-evidence.dto';
import { PixelleVideoProvider } from './workflow-provider';

@Injectable()
export class WorkflowsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(PixelleVideoProvider) private readonly provider: PixelleVideoProvider) {}

  async list(actor: AuthUser) {
    const where = actor.organizationId ? { collectionItem: { organizationId: actor.organizationId } } : { requestedById: '__missing_org__' };
    return this.prisma.workflowTask.findMany({ where, include: this.fullInclude(), orderBy: { updatedAt: 'desc' } });
  }

  async get(id: string, actor?: AuthUser) {
    const task = await this.prisma.workflowTask.findFirst({ where: { id, ...(actor ? (actor.organizationId ? { collectionItem: { organizationId: actor.organizationId } } : { requestedById: '__missing_org__' }) : {}) }, include: this.fullInclude() });
    if (!task) throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND', message: '工作流任务不存在' });
    return task;
  }

  async create(collectionItemId: string, dto: CreateWorkflowDto, actor: AuthUser) {
    const collection = await this.prisma.collectionItem.findUnique({ where: { id: collectionItemId } });
    if (!collection) throw new NotFoundException({ code: 'COLLECTION_NOT_FOUND', message: '关联产品不存在' });
    if (!actor.organizationId || collection.organizationId !== actor.organizationId) throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: '产品不存在或无权访问' });
    const configured = await this.settingValues(['featureAgent', 'defaultVideoDurationSeconds', 'defaultOutputMode', 'defaultLanguage', 'defaultFrameTemplate', 'defaultPixelleWorkflow'], actor);
    if (configured.featureAgent === false) throw new BadRequestException({ code: 'FEATURE_AGENT_DISABLED', message: 'Agent 工作流已由企业配置关闭' });
    const durationSeconds = dto.durationSeconds ?? this.numberSetting(configured.defaultVideoDurationSeconds, 45);
    const outputMode = dto.outputMode ?? (configured.defaultOutputMode === 'script' ? 'script' : 'video');
    const language = dto.language ?? this.stringSetting(configured.defaultLanguage, 'zh-CN');
    const frameTemplate = dto.frameTemplate ?? this.stringSetting(configured.defaultFrameTemplate, '1080x1920/image_default.html');
    const workflowName = dto.workflowName ?? this.stringSetting(configured.defaultPixelleWorkflow, 'museum_story_zh');
    let contentVersionId = dto.contentVersionId;
    if (contentVersionId) {
      const content = await this.prisma.contentVersion.findUnique({ where: { id: contentVersionId } });
      if (!content || content.collectionItemId !== collectionItemId) throw new BadRequestException({ code: 'CONTENT_COLLECTION_MISMATCH', message: '内容版本不属于该产品' });
    } else {
      const candidate = await this.prisma.contentVersion.create({ data: { collectionItemId, title: `${dto.title}｜Agent候选`, kind: outputMode === 'script' ? 'audio_text' : 'video', script: `候选脚本待生成：${collection.description}`, status: 'draft' } });
      contentVersionId = candidate.id;
    }
    const task = await this.prisma.workflowTask.create({
      data: {
        collectionItemId,
        contentVersionId,
        requestedById: actor.id,
        title: dto.title,
        durationSeconds,
        outputMode,
        language,
        frameTemplate,
        workflowName,
        provider: 'unconfigured',
        providerVersion: process.env.PIXELLE_VIDEO_COMMIT || null,
        status: 'waiting_configuration',
        currentStep: 'research',
        steps: { create: WORKFLOW_STEPS.map((step, index) => ({ key: step.key, label: step.label, provider: step.provider, stepOrder: index, status: step.key === 'topic' ? 'completed' : ['research', 'script', 'storyboard', 'voice_or_video'].includes(step.key) ? 'waiting_configuration' : 'pending', finishedAt: step.key === 'topic' ? new Date() : undefined })) },
      },
      include: this.fullInclude(),
    });
    const waitingSteps = task.steps.filter((step) => step.status === 'waiting_configuration').map((step) => step.key);
    await this.audit(actor, 'workflow.create', 'WorkflowTask', task.id, { collectionItemId, contentVersionId, waitingSteps });
    return { ...task, waitingConfiguration: waitingSteps.length > 0, waitingConfigurationReason: '外部媒体生成器尚未接入，候选步骤保持待配置。' };
  }

  async retry(id: string, actor: AuthUser, stepKey?: string) {
    const task = await this.get(id, actor);
    if (actor.role !== 'admin' && task.requestedById !== actor.id) throw new BadRequestException({ code: 'WORKFLOW_OWNER_ONLY', message: '只有任务发起人或管理员可以重试工作流' });
    const step = stepKey ? task.steps.find((candidate) => candidate.key === stepKey) : task.steps.find((candidate) => ['failed', 'waiting_configuration'].includes(candidate.status));
    if (!step) throw new BadRequestException({ code: 'WORKFLOW_STEP_NOT_RETRYABLE', message: '没有可重试的步骤' });
    let result = await this.provider.prepare(step.key);
    if (result.status === 'queued' && step.key === 'voice_or_video') {
      const content = task.contentVersionId ? await this.prisma.contentVersion.findUnique({ where: { id: task.contentVersionId }, select: { title: true, script: true } }) : null;
      if (!content) throw new BadRequestException({ code: 'WORKFLOW_CONTENT_REQUIRED', message: '媒体生成步骤缺少候选内容' });
      result = await this.provider.submitVideo({ title: content.title, text: content.script, workflow: task.workflowName ?? undefined, frameTemplate: task.frameTemplate ?? undefined, durationSeconds: task.durationSeconds ?? undefined, outputMode: task.outputMode ?? undefined, language: task.language ?? undefined });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.workflowStep.update({ where: { id: step.id }, data: { status: result.status, provider: result.provider, providerVersion: result.providerVersion, providerTaskId: result.providerTaskId ?? null, errorMessage: result.reason, startedAt: result.status === 'queued' ? new Date() : null, finishedAt: null, evidenceJson: null } });
      return tx.workflowTask.update({ where: { id }, data: { status: result.status === 'queued' ? 'queued' : result.status === 'failed' ? 'failed' : 'waiting_configuration', currentStep: step.key, provider: result.provider, providerVersion: result.providerVersion, providerTaskId: result.providerTaskId ?? null, errorMessage: result.reason, generationEvidenceJson: null }, include: this.fullInclude() });
    });
    await this.audit(actor, 'workflow.retry', 'WorkflowTask', id, { step: step.key, result });
    return { ...updated, retry: { step: step.key, ...result, generationEvidence: null } };
  }

  async recordEvidence(id: string, stepKey: string, dto: WorkflowEvidenceDto) {
    const task = await this.get(id);
    const step = task.steps.find((candidate) => candidate.key === stepKey);
    if (!step) throw new NotFoundException({ code: 'WORKFLOW_STEP_NOT_FOUND', message: '工作流步骤不存在' });
    if (step.status === 'completed') throw new BadRequestException({ code: 'WORKFLOW_STEP_COMPLETED', message: '该步骤已经记录过生成证据' });
    const evidence = { ...(dto.evidenceJson ?? {}), ...(dto.evidenceUrl ? { evidenceUrl: dto.evidenceUrl } : {}), recordedAt: new Date().toISOString() };
    const nextStep = task.steps.find((candidate) => candidate.stepOrder > step.stepOrder);
    const allCompleted = task.steps.every((candidate) => candidate.key === stepKey || candidate.status === 'completed');
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.workflowStep.update({ where: { id: step.id }, data: { status: dto.complete === false ? 'running' : 'completed', outputRef: dto.mediaUrl, providerVersion: dto.providerVersion ?? step.providerVersion, evidenceJson: JSON.stringify(evidence), errorMessage: null, startedAt: step.startedAt ?? new Date(), finishedAt: dto.complete === false ? null : new Date() } });
      if (task.contentVersionId && stepKey === 'voice_or_video' && dto.complete !== false) {
        await tx.contentVersion.update({ where: { id: task.contentVersionId }, data: { mediaUrl: dto.mediaUrl } });
      }
      return tx.workflowTask.update({ where: { id }, data: { status: allCompleted && dto.complete !== false ? 'completed' : 'queued', currentStep: nextStep?.key ?? stepKey, provider: 'pixelle-video', providerVersion: dto.providerVersion ?? task.providerVersion, providerTaskId: task.providerTaskId, errorMessage: null, generationEvidenceJson: JSON.stringify(evidence) }, include: this.fullInclude() });
    });
    return { ...updated, evidenceRecorded: true, publicationRequiresHumanReview: true };
  }

  private fullInclude() {
    return { collectionItem: { select: { id: true, slug: true, title: true, lifecycleStatus: true } }, contentVersion: { select: { id: true, title: true, status: true, mediaUrl: true } }, requestedBy: { select: { id: true, name: true, email: true, role: true } }, steps: { orderBy: { stepOrder: 'asc' as const } } } satisfies Prisma.WorkflowTaskInclude;
  }

  private async settingValues(keys: string[], actor?: AuthUser) {
    const rows = actor?.organizationId
      ? await this.prisma.organizationSetting.findMany({ where: { organizationId: actor.organizationId, key: { in: keys } }, select: { key: true, valueJson: true } })
      : await this.prisma.systemSetting.findMany({ where: { key: { in: keys } }, select: { key: true, valueJson: true } });
    return Object.fromEntries(rows.map((row) => {
      try { return [row.key, JSON.parse(row.valueJson)]; } catch { return [row.key, row.valueJson]; }
    })) as Record<string, unknown>;
  }

  private numberSetting(value: unknown, fallback: number) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 5 && value <= 3600 ? value : fallback;
  }

  private stringSetting(value: unknown, fallback: string) {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  }

  private async audit(actor: AuthUser, action: string, entityType: string, entityId: string, details: unknown) {
    await this.prisma.auditLog.create({ data: { actorId: actor.id, action, entityType, entityId, detailsJson: JSON.stringify(details) } });
  }
}
