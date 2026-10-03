# Pixelle-Video 基座边界

> Pixelle-Video 不参与当前 V0，后续是否采用以 [PRD.md](../../docs/PRD.md) 的 V3 方向为准。

后续视频 Agent 直接以 [ATH-MaaS/Pixelle-Video](https://github.com/ATH-MaaS/Pixelle-Video) 为创作运行时基座。来源上下文和中文合规检查在这个基座之上扩展。NestJS 不重写视频生成逻辑，只负责把企业已审核的产品资料和任务状态交给 Pixelle-Video，并接收生成证据。

## 配置

- `PIXELLE_VIDEO_API_URL`：部署后的 Pixelle-Video FastAPI 地址（适配器调用 `/api/video/generate/async`）。`PIXELLE_VIDEO_URL` 为兼容别名。
- `PIXELLE_VIDEO_COMMIT`：部署时固定的仓库 commit 或版本号，当前集成已核实为 `848b054e4fae40dabc62ec58e960b573e83793ac`，写入工作流任务/步骤的 `providerVersion`。
- `PIXELLE_VIDEO_WORKFLOW` 和 `PIXELLE_FRAME_TEMPLATE`：环境级默认值；企业管理员可在设置中维护 `defaultPixelleWorkflow` 与 `defaultFrameTemplate`，工作流提交优先使用数据库设置。
- `PIXELLE_VIDEO_WORKFLOW`：产品讲解工作流名称；默认值由企业后台配置。

未配置 Pixelle-Video API 或模型服务时，任务返回 `waiting_configuration`；配置 API URL 后，NestJS 调用基座的 `POST /api/video/generate/async`，把返回的 `task_id` 写入步骤。外部轮询器使用 Pixelle 的 `GET /api/tasks/{task_id}` 后回写生成证据。只有回写 `generationEvidenceJson`、媒体地址和完成状态后，才能进入 `completed`，因此 API 不会伪造视频已生成。

worker 回写接口为 `POST /api/workflows/:id/steps/:stepKey/evidence`，需要 `x-workflow-callback-token` 请求头和 `WORKFLOW_CALLBACK_TOKEN` 配置。请求至少包含 `mediaUrl`，可同时提交 `evidenceUrl`、`providerVersion` 和可审计的 `evidenceJson`。回写媒体只更新候选内容的媒体地址，发布仍需人工审核。
