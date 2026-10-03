import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/constants';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const settingDescriptions: Record<string, string> = {
  venueName: '展馆名称', venueTagline: '展馆副标题', publicWebUrl: '公共站点地址', nfcBaseUrl: 'NFC/二维码稳定链接前缀',
  defaultPixelleWorkflow: 'Pixelle-Video 默认工作流名', defaultFrameTemplate: '默认视频画幅模板', defaultVideoDurationSeconds: '默认视频时长（秒）', defaultOutputMode: '默认输出形态', defaultLanguage: '默认内容语言', moderationPolicy: '内容审核策略', featureNfc: 'NFC 入口开关', featureQr: '二维码入口开关', featureAgent: 'Agent 工作流开关',
  publicCopy: '公共产品页文案', catalogCategories: '产品分类选项', workflowDurationOptions: 'Agent 时长选项（秒）',
};

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async publicSettings(brandSlug?: string) {
    const organization = brandSlug ? await this.prisma.organization.findUnique({ where: { slug: brandSlug }, select: { id: true } }) : null;
    const rows = organization
      ? await this.prisma.organizationSetting.findMany({ where: { organizationId: organization.id, isPublic: true }, orderBy: { key: 'asc' } })
      : await this.prisma.systemSetting.findMany({ where: { isPublic: true }, orderBy: { key: 'asc' } });
    return { settings: Object.fromEntries(rows.map((row) => [row.key, this.parse(row.valueJson)])), updatedAt: rows.reduce<string | null>((latest, row) => !latest || row.updatedAt.toISOString() > latest ? row.updatedAt.toISOString() : latest, null) };
  }

  async adminSettings(actor?: AuthUser) {
    const organizationRows = actor?.organizationId ? await this.prisma.organizationSetting.findMany({ where: { organizationId: actor.organizationId }, orderBy: { key: 'asc' } }) : [];
    const globalRows = await this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
    const rows = [...globalRows.filter((row) => !organizationRows.some((orgRow) => orgRow.key === row.key)), ...organizationRows];
    return { settings: Object.fromEntries(rows.map((row) => [row.key, { value: this.parse(row.valueJson), isPublic: row.isPublic, description: row.description }])), providerStatus: this.providerStatus() };
  }

  async update(dto: UpdateSettingsDto, actor: AuthUser) {
    // DTO 转换可能把未提交的可选字段变成 undefined，只有明确提交的键才写入设置。
    const entries = Object.entries(dto).filter(([, value]) => value !== undefined);
    if (!entries.length) throw new BadRequestException({ code: 'SETTINGS_EMPTY', message: '至少提交一个设置项' });
    const unknown = entries.find(([key]) => !settingDescriptions[key]);
    if (unknown) throw new BadRequestException({ code: 'SETTING_UNSUPPORTED', message: `不支持的设置项：${unknown[0]}` });
    if (!actor.organizationId) throw new BadRequestException({ code: 'ORGANIZATION_REQUIRED', message: '当前账号尚未绑定展商' });
    await this.prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        const isPublic = ['venueName', 'venueTagline', 'publicWebUrl', 'nfcBaseUrl', 'publicCopy', 'catalogCategories', 'featureNfc', 'featureQr', 'featureAgent'].includes(key);
        await tx.organizationSetting.upsert({ where: { organizationId_key: { organizationId: actor.organizationId!, key } }, update: { valueJson: JSON.stringify(value), isPublic, description: settingDescriptions[key], updatedById: actor.id }, create: { organizationId: actor.organizationId!, key, valueJson: JSON.stringify(value), isPublic, description: settingDescriptions[key], updatedById: actor.id } });
      }
      await tx.auditLog.create({ data: { actorId: actor.id, action: 'settings.update', entityType: 'SystemSetting', entityId: 'global', detailsJson: JSON.stringify({ keys: entries.map(([key]) => key) }) } });
    });
    return this.adminSettings(actor);
  }

  providerStatus() {
    const aliyunRequired = [process.env.ALIYUN_DYPNS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID, process.env.ALIYUN_DYPNS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET, process.env.ALIYUN_DYPNS_SIGN_NAME, process.env.ALIYUN_DYPNS_TEMPLATE_CODE];
    return {
      authMode: process.env.AUTH_MODE ?? 'aliyun',
      aliyunNumberAuthConfigured: aliyunRequired.every(Boolean),
      pixelleVideoConfigured: Boolean(process.env.PIXELLE_VIDEO_API_URL || process.env.PIXELLE_VIDEO_URL || process.env.PIXELLE_VIDEO_COMMAND),
      pixelleVideoCommit: process.env.PIXELLE_VIDEO_COMMIT || null,
      secretsStoredInDatabase: false,
    };
  }

  private parse(value: string): unknown {
    try { return JSON.parse(value); } catch { return value; }
  }
}
