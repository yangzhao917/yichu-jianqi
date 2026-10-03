export const ROLES = ['admin', 'editor', 'reviewer'] as const;
export type Role = (typeof ROLES)[number];

export const COLLECTION_STATUSES = ['draft', 'published', 'archived'] as const;
export type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

export const CONTENT_STATUSES = ['draft', 'in_review', 'approved', 'rejected'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const WORKFLOW_STATUSES = ['queued', 'running', 'waiting_configuration', 'failed', 'completed'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const STEP_STATUSES = ['pending', 'queued', 'running', 'waiting_configuration', 'failed', 'completed'] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const PROVENANCE_STATUSES = ['needs_evidence', 'reviewed', 'rejected'] as const;
export type ProvenanceStatus = (typeof PROVENANCE_STATUSES)[number];

export const WORKFLOW_STEPS = [
  { key: 'topic', label: '选题', provider: 'local' },
  { key: 'research', label: '资料核验', provider: 'source-review' },
  { key: 'script', label: '脚本', provider: 'llm' },
  { key: 'storyboard', label: '分镜', provider: 'llm' },
  { key: 'voice_or_video', label: '语音或视频生成', provider: 'media-generator' },
  { key: 'human_review', label: '人工审核', provider: 'human' },
  { key: 'publish', label: '发布', provider: 'local' },
] as const;

export type AuthUser = {
  id: string;
  email: string;
  phone?: string | null;
  name: string;
  role: Role;
  /** JWT 中的租户边界；缺失时只允许兼容旧数据，业务写入会拒绝。 */
  organizationId?: string | null;
  brandSlug?: string | null;
};

import type { Request } from 'express';

export type RequestWithUser = Request & { user?: AuthUser };
