// 使用当前应用和当前数据库做只读自检，不创建企业、产品、线索或临时数据库记录。
import { createApp } from '../dist/main';

async function main() {
  process.env.DATABASE_URL ||= 'file:./dev.db';
  const app = await createApp();
  try {
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('无法读取临时端口');
    const base = `http://127.0.0.1:${address.port}/api`;
    const request = async (path: string, init?: RequestInit) => {
      const response = await fetch(`${base}${path}`, init);
      const body = await response.json().catch(() => ({}));
      return { response, body };
    };

    const health = await request('/health');
    if (!health.response.ok || health.body.status !== 'ok') throw new Error(`健康检查失败：${health.response.status} ${JSON.stringify(health.body)}`);

    const catalog = await request('/collections');
    if (!catalog.response.ok || !Array.isArray(catalog.body.items)) throw new Error(`公开目录失败：${catalog.response.status} ${JSON.stringify(catalog.body)}`);

    const missingBrand = await request('/brands/__missing__');
    if (missingBrand.response.status !== 404 || missingBrand.body.error?.code !== 'BRAND_NOT_FOUND') throw new Error(`企业边界失败：${missingBrand.response.status} ${JSON.stringify(missingBrand.body)}`);

    const unauthorized = await request('/products');
    if (unauthorized.response.status !== 401) throw new Error(`未授权后台访问应拒绝，实际为 ${unauthorized.response.status}`);

    console.log(JSON.stringify({ ok: true, checks: ['health', 'public catalog read', 'missing organization boundary', 'unauthorized admin rejection'], database: process.env.DATABASE_URL, writes: 0 }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
