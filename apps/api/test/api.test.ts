import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createApp } from '../dist/main';

let app: INestApplication;

before(async () => {
  // 开发、自检和生产共用当前数据库；本测试套件只读，不写入业务数据。
  process.env.DATABASE_URL ||= 'file:./dev.db';
  app = await createApp();
  await app.init();
});

after(async () => {
  await app.close();
});

test('健康检查返回当前服务标识', async () => {
  const response = await request(app.getHttpServer()).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.service, 'yichu-jianqi-api');
});

test('公开目录可读且不要求后台登录', async () => {
  const response = await request(app.getHttpServer()).get('/api/collections').expect(200);
  assert.ok(Array.isArray(response.body.items));
  assert.equal(typeof response.body.total, 'number');
});

test('后台产品接口拒绝未登录请求', async () => {
  await request(app.getHttpServer()).get('/api/products').expect(401);
});

test('不存在的企业不会返回产品内容', async () => {
  const response = await request(app.getHttpServer()).get('/api/brands/__missing__').expect(404);
  assert.equal(response.body.error.code, 'BRAND_NOT_FOUND');
});
