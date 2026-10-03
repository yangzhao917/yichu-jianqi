import test from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../dist/auth/auth.service';

test('注册会创建企业管理员并把手机号绑定到企业', async () => {
  let organizationData: any;
  let userData: any;
  let tokenPayload: any;
  const organization = { id: 'org-1', slug: 'acme-123456', name: '西安示例设备有限公司', creditCode: '91610100MA6TEST1234' };
  const createdUser = { id: 'user-1', email: 'acme-123456@local.invalid', phone: '13800138000', name: '企业管理员', role: 'admin', organizationId: organization.id, organization };
  const transactionClient = {
    organization: {
      create: async ({ data }: any) => {
        organizationData = data;
        return organization;
      },
    },
    user: {
      create: async ({ data }: any) => {
        userData = data;
        return createdUser;
      },
    },
  };
  const prisma: any = {
    user: { findUnique: async () => null },
    organization: {
      findFirst: async () => null,
      findUnique: async () => null,
    },
    $transaction: async (callback: (client: any) => Promise<any>) => callback(transactionClient),
  };
  const numberAuth = { verifyCode: async (phone: string, code: string) => phone === '13800138000' && code === '123456' };
  const jwt = {
    signAsync: async (payload: any) => {
      tokenPayload = payload;
      return payload.purpose === 'enterprise-registration' ? 'registration-ticket' : 'jwt-token';
    },
    verifyAsync: async () => ({ purpose: 'enterprise-registration', phone: '13800138000' }),
  };
  const service = new AuthService(prisma, jwt as any, numberAuth as any);

  const result = await service.register({ registrationToken: 'registration-ticket', organizationName: '西安示例设备有限公司', creditCode: '91610100ma6test1234', description: '提供工业设备和远程运维服务。' });

  assert.equal(organizationData.name, '西安示例设备有限公司');
  assert.equal(organizationData.creditCode, '91610100MA6TEST1234');
  assert.equal(organizationData.description, '提供工业设备和远程运维服务。');
  assert.equal(userData.phone, '13800138000');
  assert.equal(userData.organizationId, 'org-1');
  assert.equal(userData.role, 'admin');
  assert.equal(result.accessToken, 'jwt-token');
  assert.equal(result.user.organizationId, 'org-1');
  assert.equal(tokenPayload.organizationId, 'org-1');
});

test('验证码通过后，登录会按手机号找到已关联企业的用户', async () => {
  const user = { id: 'user-1', email: 'acme-123456@local.invalid', phone: '13800138000', name: '企业管理员', role: 'admin', organizationId: 'org-1', organization: { id: 'org-1', slug: 'acme-123456' } };
  const prisma: any = {
    user: { findUnique: async ({ where }: any) => where.phone === '13800138000' ? user : null },
  };
  const numberAuth = { verifyCode: async () => true };
  const jwt = { signAsync: async () => 'jwt-token' };
  const service = new AuthService(prisma, jwt as any, numberAuth as any);

  const result = await service.login({ phone: '13800138000', code: '123456' });

  assert.equal(result.user.phone, '13800138000');
  assert.equal(result.user.organizationId, 'org-1');
  assert.equal(result.user.brandSlug, 'acme-123456');
});

test('未注册手机号验证通过后会得到短时注册凭证', async () => {
  let ticketPayload: any;
  const prisma: any = { user: { findUnique: async () => null } };
  const numberAuth = { verifyCode: async () => true };
  const jwt = { signAsync: async (payload: any) => { ticketPayload = payload; return 'registration-ticket'; } };
  const service = new AuthService(prisma, jwt as any, numberAuth as any);

  await assert.rejects(
    service.login({ phone: '13800138001', code: '123456' }),
    (error: any) => error instanceof UnauthorizedException
      && error.getResponse()?.code === 'ACCOUNT_NOT_REGISTERED'
      && error.getResponse()?.details?.registrationToken === 'registration-ticket',
  );
  assert.deepEqual(ticketPayload, { purpose: 'enterprise-registration', phone: '13800138001' });
});

test('注册凭证无效时不会创建企业或用户', async () => {
  let transactionCalled = false;
  const prisma: any = {
    user: { findUnique: async () => { throw new Error('不应查询用户'); } },
    $transaction: async () => { transactionCalled = true; },
  };
  const numberAuth = { verifyCode: async () => false };
  const service = new AuthService(prisma, { signAsync: async () => 'unused', verifyAsync: async () => ({}) } as any, numberAuth as any);

  await assert.rejects(
    service.register({ registrationToken: 'invalid-ticket', organizationName: '无效凭证企业', creditCode: '91610100MA6TEST5678' }),
    (error: any) => error instanceof UnauthorizedException && error.getResponse()?.code === 'REGISTRATION_TOKEN_INVALID',
  );
  assert.equal(transactionCalled, false);
});
