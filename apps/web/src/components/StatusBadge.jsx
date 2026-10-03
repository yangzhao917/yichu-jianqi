import { Tag } from 'antd'
const labels = { approved: '已发布', in_review: '待审核', waiting_review: '等待审核', blocked: '等待配置', running: '处理中', draft: '草稿', rejected: '已退回', archived: '已归档', pending: '未开始', done: '已完成', current: '进行中' }
const colors = { approved: 'success', done: 'success', in_review: 'processing', waiting_review: 'processing', current: 'processing', running: 'processing', blocked: 'warning', rejected: 'error', archived: 'default', draft: 'default', pending: 'default' }
export default function StatusBadge({ status = 'draft', label }) { return <Tag className={`status-badge status-${status}`} color={colors[status] || 'default'}><i />{label || labels[status] || status}</Tag> }
