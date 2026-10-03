AI软件赛道 - 一触见企 - 一触见企团队

# 一触见企

一触见企是面向企业的产品故事入口。客户碰 NFC 卡片、扫描二维码或打开分享链接，就能从一个产品开始了解用途、观看企业上传的视频、提出问题并联系企业。企业维护一套经确认的产品内容，帮助销售新人快速掌握产品，减少重复培训和现场讲解成本。

## 运行结构

```text
apps/web      React + Vite 产品 H5，移动端使用 Ant Design Mobile
apps/api      NestJS API、Prisma 数据模型和 SQLite 数据库
video-agent/  Pixelle-Video 源码基座，后续用于内容生产工作流
docs/         产品需求、研究与验收记录
一触见企/     路演 PPT 与页面图稿
public/       项目公共资源
```

开发、计算和生产使用同一套应用、接口、数据库模型和认证路径。系统不会内置产品、企业、线索或验证码，企业初始化后由管理员维护真实内容。

## 启动

环境要求：Node.js 20+。

```bash
npm install
npm run db:seed
npm run dev
```

Web：<http://localhost:3000>
API：<http://127.0.0.1:3001>
健康检查：<http://127.0.0.1:3001/api/health>

首次初始化前，在 `apps/api/.env` 配置 `ADMIN_PHONE`、`ORGANIZATION_SLUG` 和 `ORGANIZATION_NAME`。管理员登录使用阿里云号码认证服务短信验证码，开发和生产均使用同一路径。阿里云、OpenSearch、DeepSeek 和存储凭据只保存在服务端环境变量。

## 产品链路

产品页 `/b/:brandSlug/p/:productSlug` 先说明产品价值，再播放企业上传的视频；问答页 `/b/:brandSlug/p/:productSlug/ask` 独立提供 RAG 问答和引用展开。NFC 与二维码只保存稳定产品 URL，卡片绑定产品，不绑定员工。访客只有主动填写并同意后才会创建线索。

## 商业模式与版本方向

- 少于 50 人的企业按月或按年订阅托管版产品页、知识库和线索管理。
- 50 人及以上企业采用软件授权、私有化部署、定制开发、实施、运维和维保合同。
- NFC 卡片制作是可选配套服务。
- 后续版本增加经企业审核的社交媒体内容分发、咨询归集和获客归因；Pixelle-Video 作为内容生产工作流基座按需求接入。

当前核心价值是降低销售培训与重复讲解成本，具体降本效果需在企业试点中测量，不在系统或材料中预设结果。

## 文档与材料

- [PRD](docs/PRD.md)
- [用户访谈记录](docs/research/customer-interview-notes.md)
- [路演 PPT](一触见企/一触见企.pptx)
- [Pixelle-Video 说明](apps/api/PIXELLE-VIDEO.md)
- [提交清单](docs/SUBMISSION.md)

产品、企业、视频和知识文件均由企业后台创建和审核后公开；缺少内容时页面展示明确状态，不使用内置内容替代。
