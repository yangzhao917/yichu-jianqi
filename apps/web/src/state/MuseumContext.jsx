import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { productCategories } from '../data.js'

const BusinessContext = createContext(null)
const apiBase = import.meta.env.VITE_API_BASE || '/api'
const AUTH_KEY = 'yichu-jianqi-auth'
const TOKEN_KEY = 'yichu-jianqi-token'

export const DEFAULT_PUBLIC_COPY = {
  navProducts: '产品', navHow: '使用方式', navContact: '联系展商',
  heroEyebrow: 'PRODUCT EXPLAINER / 01', heroTitle: '让产品自己讲清楚。', heroEnglish: 'One tap. One clear product story.',
  heroLead: '展会现场碰一下 NFC 卡片，先看懂产品用途、适用场景和关键参数，再决定是否联系展商。', heroPrimaryCta: '浏览产品', heroSecondaryCta: '如何使用 NFC？', heroReadyLabel: 'NFC / QR READY',
  catalogEyebrow: 'PRODUCTS / 02', catalogTitle: '先理解，再开始对话。', catalogNote: '产品信息由展商维护；视频未配置时会明确标注。',
  methodEyebrow: 'WHY THIS EXISTS / 03', methodTitle: '减少重复讲解，把时间交还给展商。', methodCopy: '人多时，工作人员无法同时回答每一个“它是做什么的”。稳定的产品页把用途、场景与资料放在一个入口，让观众先自助理解，再留下真实意向。', methodCta: '展商登录管理内容',
  methodStep1Title: '碰卡或扫码', methodStep1Copy: 'NFC 与二维码只保存稳定产品页地址，内容更新无需重新制卡。', methodStep2Title: '三分钟看懂', methodStep2Copy: '产品用途、规格、资料和已审核的讲解内容集中展示。', methodStep3Title: '自愿留资', methodStep3Copy: '只有明确同意后才会提交联系信息，并标记入口来源。',
  closingEyebrow: 'KEEP THE CONVERSATION', closingTitle: '让每一次触碰都成为一次有效介绍。', closingCta: '查看全部产品',
  detailBackCta: '返回产品目录', detailStoryEyebrow: 'HOW IT WORKS / 01', detailCuratorLabel: 'PRODUCT CONTEXT', detailRelatedEyebrow: 'MORE FROM THIS BRAND', detailRelatedTitle: '继续了解', detailRelatedCta: '返回产品目录',
  nfcEyebrow: 'NFC / QR ENTRY', nfcTitle: '把产品页带到展台之外', nfcCopy: '复制稳定链接写入 NFC 卡片，或下载二维码贴在展签旁。', nfcFoot: '标签只保存 URL，产品内容更新无需重新制卡',
  leadEyebrow: 'CONTACT THE EXHIBITOR', leadTitle: '想进一步了解？', leadCopy: '留下你愿意提供的信息，展商会按你选择的方式联系。提交前请确认同意使用这些信息。',
  connectionTitle: '企业服务未连接', connectionCopy: '暂时无法读取企业发布的产品资料。',
  footerLeft: '一触见企 · XiHack 2026', footerRight: '产品知识 × NFC × 一线跟进',
}
export const DEFAULT_CATALOG_CATEGORIES = productCategories.slice(1)

const settingsSeed = {
  brandName: '企业产品空间', brandSlug: '', brandTagline: '',
  publicWebUrl: 'http://localhost:3000', nfcBaseUrl: '',
  publicCopy: DEFAULT_PUBLIC_COPY, catalogCategories: DEFAULT_CATALOG_CATEGORIES,
  defaultPixelleWorkflow: 'product_explainer_zh', defaultFrameTemplate: '1080x1920/image_default.html',
  defaultVideoDurationSeconds: 45, defaultOutputMode: 'video', defaultLanguage: 'zh-CN', workflowDurationOptions: [30, 60, 90],
  moderationPolicy: { requireReviewedProvenance: true, requireHumanApproval: true }, featureNfc: true, featureQr: true, featureAgent: true,
  pixelleConfigured: false, aliyunConfigured: false,
}

const readStorage = (key) => { try { return JSON.parse(window.localStorage.getItem(key) || 'null') } catch { return null } }
const request = async (path, options = {}, token) => {
  const { timeoutMs = 7000, ...fetchOptions } = options
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${apiBase}${path}`, { ...fetchOptions, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(fetchOptions.headers || {}) } })
    const body = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) { const message = body?.message || body?.error?.message || body?.error || `API ${response.status}`; const error = new Error(Array.isArray(message) ? message.join('；') : String(message)); error.code = body?.code || body?.error?.code; error.details = body?.details || body?.error?.details || null; throw error }
    return body
  } finally { window.clearTimeout(timer) }
}
const requestMultipart = async (path, formData, token) => {
  const controller = new AbortController(); const timer = window.setTimeout(() => controller.abort(), 120000)
  try {
    const response = await fetch(`${apiBase}${path}`, { method: 'POST', body: formData, signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} })
    const body = response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) { const message = body?.message || body?.error?.message || body?.error || `API ${response.status}`; throw new Error(Array.isArray(message) ? message.join('；') : String(message)) }
    return body
  } finally { window.clearTimeout(timer) }
}
const listOf = (payload) => payload?.items || payload?.data || payload || []
const toUiStatus = (status) => status === 'published' ? 'approved' : status || 'draft'
const toApiStatus = (status) => status === 'approved' ? 'published' : status === 'in_review' ? 'draft' : status || 'draft'

export const normalizeProduct = (item = {}) => {
  const content = item.contents?.find((entry) => ['approved', 'published'].includes(entry.status || entry.lifecycleStatus)) || item.contents?.[0]
  const uploadedVideo = item.mediaAssets?.find((entry) => entry.kind === 'video' && entry.status === 'ready')
  const specs = Array.isArray(item.specifications) ? item.specifications : []
  const resources = Array.isArray(item.resources) ? item.resources : []
  const status = toUiStatus(item.status || item.lifecycleStatus)
  return {
    ...item, id: item.id, slug: item.slug || item.productSlug, brandSlug: item.brandSlug || item.brand?.slug || item.organization?.slug || '', title: item.title || item.name || '未命名产品', subtitle: item.subtitle || item.summary || '',
    summary: item.summary || item.subtitle || '', description: item.description || '', useCase: item.useCase || item.description || item.summary || '', audience: item.audience || item.targetAudience || '',
    category: item.category || '未分类', status, statusLabel: item.statusLabel || ({ approved: '已发布', draft: '草稿', archived: '已归档', in_review: '待审核' }[status] || status), lifecycleStatus: item.lifecycleStatus || toApiStatus(status),
    cover: item.cover || item.coverImageUrl || null, coverImageUrl: item.coverImageUrl || item.cover || null, tags: Array.isArray(item.tags) ? item.tags : [],
    specifications: specs, resources, narrative: item.narrative || content?.narrationText || item.description || item.summary || '', detail: item.detail || content?.script || item.description || '',
    mediaUrl: item.mediaUrl || uploadedVideo?.mediaUrl || content?.mediaUrl || null, mediaStatus: item.mediaStatus || (item.mediaUrl || uploadedVideo?.mediaUrl || content?.mediaUrl ? 'ready' : 'pending'),
    sourceUrl: item.sourceUrl || '', knowledgeFiles: (item.knowledgeFiles || item.documents || []).map(normalizeKnowledgeFile), updatedAt: item.updatedAt ? String(item.updatedAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
  }
}
const normalizeReview = (item = {}) => ({ id: item.id, productId: item.productId || item.collectionItemId || item.product?.id, collectionId: item.productId || item.collectionItemId, productTitle: item.productTitle || item.product?.title || item.collectionTitle || '未命名产品', collectionTitle: item.productTitle || item.product?.title || item.collectionTitle || '未命名产品', type: item.type || item.title || '内容版本', status: item.status || 'in_review', statusLabel: item.statusLabel || ({ in_review: '待审核', approved: '已通过', rejected: '已退回' }[item.status] || item.status), author: item.author || item.createdBy?.name || '企业编辑', risk: item.risk || '中', riskCopy: item.riskCopy || item.reviewerNote || '请核对企业提交的用途和参数。', createdAt: item.createdAt ? String(item.createdAt).replace('T', ' ').slice(0, 16) : '', excerpt: item.excerpt || item.script || item.narrationText || '' })
const normalizeJob = (task = {}) => {
  const steps = (task.steps || []).map((step) => ({ name: step.label || step.key, state: step.status === 'completed' ? 'done' : step.status === 'waiting_configuration' ? 'blocked' : ['running', 'queued'].includes(step.status) ? 'current' : 'pending', note: step.errorMessage || step.outputRef || step.evidenceJson || step.key }))
  const activeIndex = (task.steps || []).findIndex((step) => step.status !== 'completed')
  return { id: task.id, productId: task.productId || task.collectionItemId || task.product?.id, collectionId: task.productId || task.collectionItemId, title: task.title || '产品讲解工作流', durationSeconds: task.durationSeconds || null, outputMode: task.outputMode || null, language: task.language || null, frameTemplate: task.frameTemplate || null, workflowName: task.workflowName || null, status: task.status === 'waiting_configuration' ? 'blocked' : task.status === 'completed' ? 'waiting_review' : task.status, statusLabel: ({ waiting_configuration: '等待配置', completed: '等待审核', queued: '排队中', running: '处理中', failed: '失败' }[task.status] || task.status), createdAt: task.createdAt ? String(task.createdAt).replace('T', ' ').slice(0, 16) : '', currentStep: activeIndex === -1 ? steps.length : Math.max(activeIndex + 1, 1), steps }
}
const normalizeLead = (item = {}) => ({ ...item, productTitle: item.productTitle || item.product?.title || '未命名产品', statusLabel: item.statusLabel || ({ new: '待跟进', contacted: '已联系', qualified: '已确认', closed: '已关闭' }[item.status] || item.status), createdAt: item.createdAt ? String(item.createdAt).replace('T', ' ').slice(0, 16) : '' })
const normalizeKnowledgeFile = (item = {}) => ({
  ...item,
  id: item.id || item.fileId,
  name: item.name || item.fileName || item.originalName || item.title || '未命名资料',
  status: item.status || item.indexStatus || 'pending',
  statusLabel: item.statusLabel || ({ pending: '待确认', pending_confirmation: '待确认', indexing: '索引中', ready: '可检索', searchable: '可检索', indexed: '可检索', failed: '索引失败' }[item.status || item.indexStatus] || item.status || '待确认'),
  locator: item.locator || item.sourceLocator || '',
  url: item.url || item.fileUrl || item.downloadUrl || '',
  errorMessage: item.errorMessage || item.error || '',
})
const normalizeSettings = (payload) => { const raw = payload?.settings || {}; const values = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, value && typeof value === 'object' && 'value' in value ? value.value : value])); const providerStatus = payload?.providerStatus || {}; return { ...settingsSeed, ...values, publicCopy: { ...DEFAULT_PUBLIC_COPY, ...(values.publicCopy || {}) }, catalogCategories: Array.isArray(values.catalogCategories) && values.catalogCategories.length ? values.catalogCategories : DEFAULT_CATALOG_CATEGORIES, workflowDurationOptions: Array.isArray(values.workflowDurationOptions) && values.workflowDurationOptions.length ? values.workflowDurationOptions : [30, 60, 90], pixelleConfigured: providerStatus.pixelleVideoConfigured ?? values.pixelleConfigured ?? false, aliyunConfigured: providerStatus.aliyunNumberAuthConfigured ?? values.aliyunConfigured ?? false, providerStatus } }

export function MuseumProvider({ children }) {
  const [brand, setBrand] = useState(null); const [products, setProducts] = useState([]); const [reviews, setReviews] = useState([]); const [jobs, setJobs] = useState([]); const [leads, setLeads] = useState([]); const [interactionSummary, setInteractionSummary] = useState({ totalViews: 0, totalPlays: 0, byProduct: [], bySource: [] }); const [settings, setSettings] = useState(settingsSeed); const [user, setUser] = useState(() => readStorage(AUTH_KEY)); const [token, setToken] = useState(() => { try { return window.localStorage.getItem(TOKEN_KEY) || '' } catch { return '' } }); const [connection, setConnection] = useState('disconnected'); const [notice, setNotice] = useState(null)
  const notify = useCallback((message, tone = 'info') => { setNotice({ message, tone }); window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => setNotice(null), 3600) }, [])
  const loadBrand = useCallback(async (slug = settings.brandSlug) => { try { const payload = await request(`/brands/${encodeURIComponent(slug)}`); if (payload?.brand) setBrand(payload.brand); if (Array.isArray(payload?.products)) setProducts(payload.products.map(normalizeProduct)); setConnection('connected'); return payload } catch { setConnection('disconnected'); return null } }, [settings.brandSlug])
  const loadProduct = useCallback(async (brandSlug, productSlug) => { try { const payload = await request(`/brands/${encodeURIComponent(brandSlug)}/products/${encodeURIComponent(productSlug)}`); const product = normalizeProduct(payload); if (product?.id) setProducts((previous) => previous.some((entry) => entry.id === product.id) ? previous.map((entry) => entry.id === product.id ? product : entry) : [product, ...previous]); setConnection('connected'); return product } catch { return null } }, [])
  const loadManagementData = useCallback(async (authToken = token, actor = user) => {
    if (!authToken) return false
    const calls = [['products', request('/products', {}, authToken)], ['leads', request('/leads', {}, authToken)], ['summary', request('/interactions/summary', {}, authToken)], ['workflows', request('/workflows', {}, authToken)], ['reviews', request('/content/review-queue', {}, authToken)]]
    const results = await Promise.allSettled(calls.map(([, promise]) => promise)); const byName = Object.fromEntries(calls.map(([name], index) => [name, results[index]])); let loaded = false
    if (byName.products?.status === 'fulfilled') { const items = listOf(byName.products.value); if (Array.isArray(items)) { setProducts(items.map(normalizeProduct)); loaded = true } }
    if (byName.leads?.status === 'fulfilled') { const items = listOf(byName.leads.value); if (Array.isArray(items)) { setLeads(items.map(normalizeLead)); loaded = true } }
    if (byName.summary?.status === 'fulfilled' && byName.summary.value) { setInteractionSummary(byName.summary.value); loaded = true }
    if (byName.workflows?.status === 'fulfilled') { const items = listOf(byName.workflows.value); if (Array.isArray(items)) { setJobs(items.map(normalizeJob)); loaded = true } }
    if ((actor?.role === 'admin' || actor?.role === 'reviewer') && byName.reviews?.status === 'fulfilled') { const items = listOf(byName.reviews.value); if (Array.isArray(items)) { setReviews(items.map(normalizeReview)); loaded = true } }
    if (loaded) setConnection('connected'); return loaded
  }, [token, user])
  const initialize = useCallback(async () => { await loadBrand(settings.brandSlug); try { const payload = await request(`/settings/public?brandSlug=${encodeURIComponent(settings.brandSlug)}`); setSettings((current) => ({ ...current, ...normalizeSettings(payload) })) } catch {} if (token) await loadManagementData(token, user) }, [loadBrand, loadManagementData, settings.brandSlug, token, user])
  const establishSession = useCallback(async (payload) => { const nextUser = payload.user || payload; const nextToken = payload.accessToken || ''; setUser(nextUser); setToken(nextToken); setConnection('connected'); window.localStorage.setItem(AUTH_KEY, JSON.stringify(nextUser)); window.localStorage.setItem(TOKEN_KEY, nextToken); if (nextUser.brandSlug) setSettings((current) => ({ ...current, brandSlug: nextUser.brandSlug })); await loadManagementData(nextToken, nextUser); notify('已进入企业工作台', 'success') }, [loadManagementData, notify])
  const login = useCallback(async (phone, code) => { await establishSession(await request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, code }) })) }, [establishSession])
  const register = useCallback(async (payload) => { await establishSession(await request('/auth/register', { method: 'POST', body: JSON.stringify(payload) })) }, [establishSession])
  const logout = useCallback(() => { setUser(null); setToken(''); window.localStorage.removeItem(AUTH_KEY); window.localStorage.removeItem(TOKEN_KEY); notify('已退出企业后台') }, [notify])
  const updateBrand = useCallback(async (form) => {
    if (!token) { notify('请先登录企业后台', 'warning'); return false }
    try { const updated = await request('/brands/me', { method: 'PATCH', body: JSON.stringify({ description: form.description }) }, token); setBrand((current) => ({ ...(current || {}), ...updated })); notify('企业简介已更新', 'success'); return true } catch (error) { notify(`企业简介更新失败：${error.message}`, 'warning'); return false }
  }, [notify, token])
  const productBody = (form) => ({ slug: form.slug, title: form.title, summary: form.subtitle || form.summary || form.title, description: form.description || form.useCase || form.subtitle || form.title, useCase: form.useCase || '', audience: form.audience || '', category: form.category, coverImageUrl: form.cover || form.coverImageUrl || undefined, specifications: form.specifications || [], resources: form.resources || [], lifecycleStatus: toApiStatus(form.status || 'draft') })
  const createProduct = useCallback(async (form) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; try { const created = await request('/products', { method: 'POST', body: JSON.stringify(productBody(form)) }, token); setProducts((previous) => [normalizeProduct(created), ...previous]); notify('产品已保存到企业空间', 'success'); return true } catch (error) { notify(`产品保存失败：${error.message}`, 'warning'); return false } }, [notify, token])
  const updateProduct = useCallback(async (id, form) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; try { const updated = await request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(productBody(form)) }, token); setProducts((previous) => previous.map((entry) => entry.id === id ? normalizeProduct({ ...entry, ...updated, specifications: form.specifications || [], resources: form.resources || [] }) : entry)); notify('产品信息已保存', 'success'); return true } catch (error) { notify(`产品更新失败：${error.message}`, 'warning'); return false } }, [notify, token])
  const updateProductStatus = useCallback(async (id, status) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; try { const updated = await request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify({ lifecycleStatus: toApiStatus(status) }) }, token); setProducts((previous) => previous.map((entry) => entry.id === id ? normalizeProduct({ ...entry, ...updated }) : entry)); notify('产品状态已更新', 'success'); return true } catch (error) { notify(`状态更新失败：${error.message}`, 'warning'); return false } }, [notify, token])
  const review = useCallback(async (id, status) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; try { await request(`/content/${id}/${status === 'approved' ? 'approve' : 'reject'}`, { method: 'POST', body: JSON.stringify({ note: status === 'approved' ? '企业审核通过' : '请补充产品资料后重提' }) }, token); await loadManagementData(token, user); notify(status === 'approved' ? '内容已通过审核' : '内容已退回', status === 'approved' ? 'success' : 'warning'); return true } catch (error) { notify(`审核操作失败：${error.message}`, 'warning'); return false } }, [loadManagementData, notify, token, user])
  const createJob = useCallback(async (form) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; const product = products.find((item) => item.id === (form.productId || form.collectionId)); const durationSeconds = Number(form.duration || settings.defaultVideoDurationSeconds || 45); const title = `${product?.title || '未命名产品'} · 展会讲解`; const payload = { title, durationSeconds, outputMode: form.mode || settings.defaultOutputMode || 'video', language: form.language || settings.defaultLanguage, frameTemplate: form.frameTemplate || settings.defaultFrameTemplate, workflowName: form.workflowName || settings.defaultPixelleWorkflow }; try { const created = await request(`/workflows/products/${product?.id}`, { method: 'POST', body: JSON.stringify(payload) }, token); setJobs((previous) => [normalizeJob(created), ...previous]); notify('产品讲解工作流已创建', 'success'); return true } catch (error) { notify(`工作流创建失败：${error.message}`, 'warning'); return false } }, [notify, products, settings.defaultFrameTemplate, settings.defaultLanguage, settings.defaultOutputMode, settings.defaultPixelleWorkflow, settings.defaultVideoDurationSeconds, token])
  const retryJob = useCallback(async (id) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; try { const payload = await request(`/workflows/${id}/retry`, { method: 'POST' }, token); setJobs((previous) => previous.map((job) => job.id === id ? normalizeJob(payload) : job)); notify('已提交工作流重试请求', 'success'); return true } catch (error) { notify(`工作流重试失败：${error.message}`, 'warning'); return false } }, [notify, token])
  const recordInteraction = useCallback(async ({ productSlug, event, source = 'direct', brandSlug = brand?.slug || settings.brandSlug }) => { try { await request('/interactions', { method: 'POST', body: JSON.stringify({ brandSlug, productSlug, event, source }) }) } catch {} }, [brand?.slug, settings.brandSlug])
  const submitLead = useCallback(async (form) => { const body = { brandSlug: form.brandSlug || brand?.slug || settings.brandSlug, productSlug: form.productSlug, name: form.name, phone: form.phone || undefined, email: form.email || undefined, company: form.company || undefined, message: form.message || undefined, consent: Boolean(form.consent), source: form.source || 'direct' }; try { const created = await request('/leads', { method: 'POST', body: JSON.stringify(body) }); setLeads((previous) => [normalizeLead({ ...created, ...body }), ...previous]); notify('联系方式已提交给企业', 'success'); return true } catch (error) { notify(`提交失败：${error.message}`, 'warning'); return false } }, [brand?.slug, notify, settings.brandSlug])
  const updateLead = useCallback(async (id, status) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; try { const updated = await request(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }, token); setLeads((previous) => previous.map((item) => item.id === id ? normalizeLead({ ...item, ...updated }) : item)); notify('线索状态已更新', 'success'); return true } catch (error) { notify(`线索更新失败：${error.message}`, 'warning'); return false } }, [notify, token])
  const uploadProductVideo = useCallback(async (productId, file) => {
    if (!token) { notify('请先登录企业后台', 'warning'); return null }
    const body = new FormData(); body.append('file', file)
    try {
      const payload = await requestMultipart(`/products/${encodeURIComponent(productId)}/video`, body, token)
      const mediaUrl = payload?.mediaUrl || payload?.product?.mediaUrl
      if (mediaUrl) setProducts((previous) => previous.map((entry) => entry.id === productId ? { ...entry, mediaUrl, mediaStatus: 'ready' } : entry))
      notify('产品视频已上传', 'success'); return payload
    } catch (error) { notify(`视频上传失败：${error.message}`, 'warning'); return null }
  }, [notify, token])
  const uploadProductImage = useCallback(async (productId, file) => {
    if (!token) { notify('请先登录企业后台', 'warning'); return null }
    const body = new FormData(); body.append('file', file)
    try {
      const payload = await requestMultipart(`/products/${encodeURIComponent(productId)}/image`, body, token)
      const mediaUrl = payload?.mediaUrl || ''
      if (mediaUrl) setProducts((previous) => previous.map((entry) => entry.id === productId ? { ...entry, cover: mediaUrl, coverImageUrl: mediaUrl } : entry))
      notify('产品图片已上传', 'success'); return payload
    } catch (error) { notify(`图片上传失败：${error.message}`, 'warning'); return null }
  }, [notify, token])
  const loadKnowledgeFiles = useCallback(async (productId) => {
    if (!token) throw new Error('请先登录企业后台')
    const payload = await request(`/products/${encodeURIComponent(productId)}/knowledge-files`, {}, token)
    return listOf(payload).map(normalizeKnowledgeFile)
  }, [token])
  const uploadKnowledgeFiles = useCallback(async (productId, files) => {
    if (!token) { notify('请先登录企业后台', 'warning'); return [] }
    const body = new FormData(); files.forEach((file) => body.append('files', file))
    try {
      const payload = await requestMultipart(`/products/${encodeURIComponent(productId)}/knowledge-files`, body, token)
      const items = listOf(payload).map(normalizeKnowledgeFile)
      notify(`${items.length} 份资料已上传，等待确认索引`, 'success'); return items
    } catch (error) { notify(`资料上传失败：${error.message}`, 'warning'); return [] }
  }, [notify, token])
  const uploadKnowledgeFile = useCallback(async (productId, file) => {
    const items = await uploadKnowledgeFiles(productId, [file])
    return items[0] || null
  }, [uploadKnowledgeFiles])
  const confirmKnowledgeFile = useCallback(async (productId, fileId) => {
    if (!token) { notify('请先登录企业后台', 'warning'); return null }
    try {
      const payload = await request(`/products/${encodeURIComponent(productId)}/knowledge-files/${encodeURIComponent(fileId)}/confirm`, { method: 'POST' }, token)
      notify('资料已提交索引', 'success'); return normalizeKnowledgeFile(payload?.file || payload)
    } catch (error) { notify(`索引确认失败：${error.message}`, 'warning'); return null }
  }, [notify, token])
  const verifyKnowledgeFile = useCallback(async (productId, fileId) => {
    if (!token) { notify('请先登录企业后台', 'warning'); return null }
    try {
      const payload = await request(`/products/${encodeURIComponent(productId)}/knowledge-files/${encodeURIComponent(fileId)}/verify`, { method: 'POST' }, token)
      const file = normalizeKnowledgeFile(payload?.file || payload)
      notify(file.status === 'ready' ? '资料已经可以检索' : '资料仍在索引中', file.status === 'ready' ? 'success' : 'info')
      return file
    } catch (error) { notify(`索引检查失败：${error.message}`, 'warning'); return null }
  }, [notify, token])
  const askProduct = useCallback(async ({ brandSlug, productSlug, question }) => {
    const text = String(question || '').trim(); if (!text) throw new Error('请输入问题')
    return request(`/brands/${encodeURIComponent(brandSlug)}/products/${encodeURIComponent(productSlug)}/chat`, { method: 'POST', body: JSON.stringify({ question: text }), timeoutMs: 35000 })
  }, [])
  const loadSettings = useCallback(async () => { if (!token) return null; try { const next = normalizeSettings(await request('/settings', {}, token)); setSettings((current) => ({ ...current, ...next })); return next } catch (error) { notify(`企业配置服务不可用：${error.message}`, 'warning'); return null } }, [notify, token])
  const saveSettings = useCallback(async (next) => { if (!token) { notify('请先登录企业后台', 'warning'); return false }; try { const payload = normalizeSettings(await request('/settings', { method: 'PUT', body: JSON.stringify(next) }, token)); setSettings((current) => ({ ...current, ...payload })); notify('企业配置已保存', 'success'); return true } catch (error) { notify(`企业配置保存失败：${error.message}`, 'warning'); return false } }, [notify, token])
  const clearNotice = useCallback(() => setNotice(null), [])
  const value = useMemo(() => ({ brand, products, collections: products, setProducts, reviews, jobs, leads, interactionSummary, settings, user, connection, notice, initialize, loadBrand, loadProduct, loadManagementData, login, register, logout, updateBrand, notify, clearNotice, createProduct, updateProduct, updateProductStatus, createCollection: createProduct, updateCollection: updateProduct, updateCollectionStatus: updateProductStatus, review, createJob, retryJob, recordInteraction, submitLead, updateLead, uploadProductVideo, uploadProductImage, loadKnowledgeFiles, uploadKnowledgeFile, uploadKnowledgeFiles, confirmKnowledgeFile, verifyKnowledgeFile, askProduct, loadSettings, saveSettings, approvedProducts: products.filter((item) => item.status === 'approved'), approvedCollections: products.filter((item) => item.status === 'approved'), reviewCount: reviews.filter((item) => item.status === 'in_review').length, activeJobCount: jobs.filter((item) => ['queued', 'running', 'waiting_review'].includes(item.status)).length }), [brand, products, reviews, jobs, leads, interactionSummary, settings, user, connection, notice, initialize, loadBrand, loadProduct, loadManagementData, login, register, logout, updateBrand, notify, clearNotice, createProduct, updateProduct, updateProductStatus, review, createJob, retryJob, recordInteraction, submitLead, updateLead, uploadProductVideo, uploadProductImage, loadKnowledgeFiles, uploadKnowledgeFile, uploadKnowledgeFiles, confirmKnowledgeFile, verifyKnowledgeFile, askProduct, loadSettings, saveSettings])
  return <BusinessContext.Provider value={value}>{children}</BusinessContext.Provider>
}
export const useMuseum = () => useContext(BusinessContext)
