# 一触见企 API

NestJS + Prisma API，为产品 H5 和企业管控台提供服务。

## 启动

在项目根目录配置 `apps/api/.env` 后执行：

```bash
npm install
npm run db:seed
npm run dev:api
```

API 默认监听 `127.0.0.1:3001`，路由前缀为 `/api`。开发、计算和生产使用同一套接口和数据库模型。

## 认证

管理员手机号验证码由阿里云号码认证服务发送和核验。`ADMIN_PHONE`、`ORGANIZATION_SLUG`、`ORGANIZATION_NAME` 是初始化企业所需配置。缺少云服务配置时接口返回明确错误，不接受本地验证码，也不会自动创建管理员或企业。

## 主要接口

- `GET /api/brands/:brandSlug`：公开企业产品目录。
- `GET /api/brands/:brandSlug/products/:productSlug`：公开产品详情。
- `POST /api/brands/:brandSlug/products/:productSlug/chat`：基于确认资料的产品问答和引用。
- `POST /api/auth/request-code`、`POST /api/auth/login`：手机号验证码登录。
- `GET/POST/PATCH/DELETE /api/products`：管理员产品维护。
- `POST /api/products/:id/video`：上传产品视频。
- `POST /api/products/:id/knowledge-files`：上传并确认知识文件索引。
- `GET/PATCH /api/leads`、`POST /api/leads`：企业查看和访客提交线索。
- `GET /api/health`：健康检查。

## 外部服务边界

阿里云 OpenSearch、DeepSeek、号码认证服务和 Pixelle-Video 的凭据只保存在服务端环境变量。配置缺失或服务失败时，API 返回明确状态，不使用预置答案或虚假视频。V0 视频由管理员上传，Pixelle-Video 是后续内容生产工作流基座。

## 自检

```bash
npm --prefix apps/api run api:self-check
```

自检只读取当前数据库并检查健康检查、公开目录、缺失企业边界和未授权后台访问，不创建或删除业务数据。
