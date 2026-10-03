import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

process.env.DATABASE_URL ||= 'file:./dev.db';
const prisma = new PrismaClient();

const required = (key: string) => {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`${key} 未配置，不能初始化企业数据`);
  return value;
};

const normalizePhone = (value: string) => value.replace(/[\s-]/g, '').replace(/^\+86/, '');
const configuredAdminPhone = normalizePhone(required('ADMIN_PHONE'));
if (!/^1\d{10}$/.test(configuredAdminPhone)) throw new Error('ADMIN_PHONE 必须是 11 位中国大陆手机号');

const organizationSlug = required('ORGANIZATION_SLUG').toLowerCase();
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organizationSlug)) throw new Error('ORGANIZATION_SLUG 只能使用小写字母、数字和连字符');
const organizationName = required('ORGANIZATION_NAME');
const organizationCreditCode = required('ORGANIZATION_CREDIT_CODE').toUpperCase();
if (!/^[0-9A-Z]{18}$/.test(organizationCreditCode)) throw new Error('ORGANIZATION_CREDIT_CODE 必须是 18 位统一社会信用代码');
const organizationTagline = process.env.ORGANIZATION_TAGLINE?.trim() || '让产品自己讲清楚。';
const organizationDescription = process.env.ORGANIZATION_DESCRIPTION?.trim() || '统一维护产品介绍、视频、问答资料和客户线索。';
const adminEmail = process.env.ADMIN_EMAIL?.trim() || 'admin@local.test';
const adminName = process.env.ADMIN_NAME?.trim() || '企业管理员';
const publicWebUrl = (process.env.PUBLIC_WEB_URL || 'http://localhost:3000').replace(/\/$/, '');

const publicCopy = {
  navProducts: '产品', navHow: '使用方式', navContact: '联系企业',
  heroEyebrow: 'PRODUCT EXPLAINER / 01', heroTitle: '让产品自己讲清楚。', heroEnglish: 'One tap. One clear product story.',
  heroLead: '从一个产品开始，先看懂用途与场景，再提出问题并把真实意向交给企业。', heroPrimaryCta: '浏览产品', heroSecondaryCta: '怎么进入产品页？', heroReadyLabel: 'NFC / QR READY',
  catalogEyebrow: 'PRODUCTS / 02', catalogTitle: '先理解，再开始对话。', catalogNote: '产品信息由企业维护；只有已发布内容会对外展示。',
  methodEyebrow: 'WHY THIS EXISTS / 03', methodTitle: '减少重复讲解，把时间交还给一线。', methodCopy: '统一的产品页把用途、场景和资料放在一个入口，帮助企业降低销售培训与重复讲解成本。', methodCta: '进入企业管控台',
  methodStep1Title: '碰卡或扫码', methodStep1Copy: 'NFC 与二维码只保存稳定产品链接。', methodStep2Title: '看懂并追问', methodStep2Copy: '产品介绍、视频和资料集中呈现。', methodStep3Title: '留下意向', methodStep3Copy: '客户主动提交，再交给一线跟进。',
  closingEyebrow: 'KEEP THE CONVERSATION', closingTitle: '让每一次触碰都成为一次有效介绍。', closingCta: '查看产品',
  detailBackCta: '返回产品目录', detailStoryEyebrow: 'HOW IT WORKS / 01', detailCuratorLabel: 'PRODUCT CONTEXT', detailRelatedEyebrow: 'MORE FROM THIS BRAND', detailRelatedTitle: '继续了解', detailRelatedCta: '返回产品目录',
  nfcEyebrow: 'NFC / QR ENTRY', nfcTitle: '把产品页带到展台之外', nfcCopy: '复制稳定链接写入 NFC 卡片，或下载二维码。', nfcFoot: '内容更新无需重新制卡',
  leadEyebrow: 'CONTACT THE EXHIBITOR', leadTitle: '想进一步了解？', leadCopy: '留下你愿意提供的信息，企业会按你选择的方式联系。',
  footerLeft: '一触见企', footerRight: '产品知识 × NFC × 一线跟进',
};

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: { name: organizationName, creditCode: organizationCreditCode, tagline: organizationTagline, description: organizationDescription },
    create: { slug: organizationSlug, name: organizationName, creditCode: organizationCreditCode, tagline: organizationTagline, description: organizationDescription },
  });

  // 企业后台首版只初始化一个管理员，不把员工样例写入真实组织。
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: adminName, role: 'admin', phone: configuredAdminPhone, organizationId: organization.id },
    create: { email: adminEmail, phone: configuredAdminPhone, name: adminName, role: 'admin', organizationId: organization.id, passwordHash: await hash('unused-password', 10) },
  });
  await prisma.user.deleteMany({ where: { email: { in: ['editor@local.test', 'reviewer@local.test'] } } });

  const settings = [
    ['brandName', organization.name, true, '企业空间名称'],
    ['brandSlug', organizationSlug, true, '企业空间地址标识'],
    ['brandTagline', organization.tagline, true, '企业空间副标题'],
    ['publicWebUrl', publicWebUrl, true, '公共站点地址'],
    ['nfcBaseUrl', `${publicWebUrl}/b/${organizationSlug}/p`, true, 'NFC/二维码产品链接前缀'],
    ['publicCopy', publicCopy, true, '公共产品页文案'],
    ['catalogCategories', ['工业硬件', '工业视觉', '能源管理', '软件服务'], true, '产品分类选项'],
    ['featureNfc', true, true, 'NFC 入口开关'],
    ['featureQr', true, true, '二维码入口开关'],
    ['featureAgent', false, true, '视频工作流开关'],
  ] as const;
  for (const [key, value, isPublic, description] of settings) {
    await prisma.organizationSetting.upsert({
      where: { organizationId_key: { organizationId: organization.id, key } },
      update: { valueJson: JSON.stringify(value), isPublic, description, updatedById: admin.id },
      create: { organizationId: organization.id, key, valueJson: JSON.stringify(value), isPublic, description, updatedById: admin.id },
    });
  }

  const systemSettings = [
    ['venueName', '一触见企', true, '产品名称'],
    ['venueTagline', '让产品自己讲清楚。', true, '产品副标题'],
    ['publicWebUrl', publicWebUrl, true, '公共站点地址'],
    ['featureNfc', true, true, 'NFC 入口开关'],
    ['featureQr', true, true, '二维码入口开关'],
    ['featureAgent', false, true, '视频工作流开关'],
  ] as const;
  for (const [key, value, isPublic, description] of systemSettings) {
    await prisma.systemSetting.upsert({ where: { key }, update: { valueJson: JSON.stringify(value), isPublic, description, updatedById: admin.id }, create: { key, valueJson: JSON.stringify(value), isPublic, description, updatedById: admin.id } });
  }

  console.log(JSON.stringify({ seeded: true, organizationSlug, adminPhoneConfigured: true, productsCreated: 0, authMode: process.env.AUTH_MODE || 'aliyun' }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
