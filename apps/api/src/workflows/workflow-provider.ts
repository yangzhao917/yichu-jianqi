import { Injectable } from '@nestjs/common';

export type ProviderStepResult = {
  status: 'waiting_configuration' | 'queued' | 'failed';
  provider: string;
  providerVersion: string | null;
  providerTaskId?: string | null;
  reason: string;
};

/** External model calls stay behind this boundary; the MVP never fabricates generated media. */
export interface WorkflowProvider {
  prepare(stepKey: string): Promise<ProviderStepResult>;
}

@Injectable()
export class PixelleVideoProvider implements WorkflowProvider {
  async prepare(stepKey: string): Promise<ProviderStepResult> {
    const hasPixelleRunner = Boolean(process.env.PIXELLE_VIDEO_API_URL || process.env.PIXELLE_VIDEO_URL || process.env.PIXELLE_VIDEO_COMMAND);
    const version = process.env.PIXELLE_VIDEO_COMMIT || null;
    if (stepKey !== 'voice_or_video') {
      return { status: 'waiting_configuration', provider: 'unconfigured', providerVersion: version, reason: `步骤 ${stepKey} 需要对应的资料/脚本适配器，当前仅接入 Pixelle-Video 媒体生成` };
    }
    return {
      status: hasPixelleRunner ? 'queued' : 'waiting_configuration',
      provider: hasPixelleRunner ? 'pixelle-video' : 'unconfigured',
      providerVersion: version,
      reason: hasPixelleRunner
        ? `Pixelle-Video 已配置，步骤 ${stepKey} 等待提交；完成前必须回写生成证据`
        : '未配置 Pixelle-Video API URL 或命令（PIXELLE_VIDEO_API_URL / PIXELLE_VIDEO_URL / PIXELLE_VIDEO_COMMAND）',
    };
  }

  async submitVideo(input: { title: string; text: string; workflow?: string; frameTemplate?: string; durationSeconds?: number; outputMode?: string; language?: string }): Promise<ProviderStepResult> {
    const apiUrl = process.env.PIXELLE_VIDEO_API_URL || process.env.PIXELLE_VIDEO_URL;
    const version = process.env.PIXELLE_VIDEO_COMMIT || null;
    if (!apiUrl) return { status: 'waiting_configuration', provider: 'unconfigured', providerVersion: version, reason: '未配置 Pixelle-Video API URL' };
    if (process.env.PIXELLE_VIDEO_COMMAND && !process.env.PIXELLE_VIDEO_API_URL && !process.env.PIXELLE_VIDEO_URL) {
      return { status: 'waiting_configuration', provider: 'pixelle-video', providerVersion: version, reason: '仅配置了命令适配器；请由受控 worker 执行并回写证据' };
    }
    const endpoint = apiUrl.endsWith('/api/video/generate/async') ? apiUrl : `${apiUrl.replace(/\/$/, '')}/api/video/generate/async`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: input.text, mode: 'fixed', title: input.title, n_scenes: 5, min_narration_words: 5, max_narration_words: 80, duration_seconds: input.durationSeconds, output_mode: input.outputMode, language: input.language, frame_template: input.frameTemplate || process.env.PIXELLE_FRAME_TEMPLATE || '1080x1920/image_default.html', media_workflow: input.workflow || process.env.PIXELLE_VIDEO_WORKFLOW || undefined }),
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.json().catch(() => ({})) as { task_id?: string; message?: string };
      if (!response.ok || !body.task_id) return { status: 'failed', provider: 'pixelle-video', providerVersion: version, reason: `Pixelle-Video 提交失败（HTTP ${response.status}）${body.message ? `：${body.message}` : ''}` };
      return { status: 'queued', provider: 'pixelle-video', providerVersion: version, providerTaskId: body.task_id, reason: 'Pixelle-Video 已创建异步任务，等待 worker 回写媒体和生成证据' };
    } catch (error) {
      return { status: 'failed', provider: 'pixelle-video', providerVersion: version, reason: `Pixelle-Video API 不可达：${error instanceof Error ? error.message : 'unknown error'}` };
    }
  }
}
