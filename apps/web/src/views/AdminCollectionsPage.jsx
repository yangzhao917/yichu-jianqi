import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Dropdown, Empty, Form, Input, List, Modal, Space, Table, Tag, Typography, Upload } from 'antd'
import {
  CheckCircleOutlined, CopyOutlined, FileTextOutlined, LinkOutlined,
  MoreOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined,
} from '@ant-design/icons'
import AdminShell from '../components/AdminShell.jsx'
import { useMuseum } from '../state/MuseumContext.jsx'

const emptyForm = {
  title: '', slug: '', subtitle: '', description: '', useCase: '',
  audience: '', category: '', cover: '', status: 'draft',
  specifications: [], resources: [],
}
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const maxVideoBytes = 100 * 1024 * 1024
const maxImageBytes = 10 * 1024 * 1024
const maxKnowledgeBytes = 1024 * 1024
const statusColor = { approved: 'success', draft: 'default', archived: 'warning', in_review: 'processing' }

function ProductEditor({ product, open, onClose }) {
  const { createProduct, updateProduct } = useMuseum()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    form.setFieldsValue(product ? {
      ...emptyForm, ...product,
      subtitle: product.summary || product.subtitle || '',
      cover: product.coverImageUrl || product.cover || '',
    } : emptyForm)
  }, [form, open, product])

  const save = async (values) => {
    setSaving(true)
    const payload = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]))
    const saved = product
      ? await updateProduct(product.id, { ...product, ...payload })
      : await createProduct({ ...emptyForm, ...payload })
    setSaving(false)
    if (saved) onClose()
  }

  return <Modal className="console-modal" title={product ? '编辑产品介绍' : '新建产品'} open={open} onCancel={onClose} onOk={() => form.submit()} okText="保存产品" cancelText="取消" confirmLoading={saving} cancelButtonProps={{ disabled: saving }} closable={!saving} mask={{ closable: !saving }} width={660} destroyOnHidden>
    <Form form={form} layout="vertical" onFinish={save} className="console-product-form">
      <Form.Item name="title" label="产品名称" rules={[{ required: true, whitespace: true, min: 2, message: '产品名称至少 2 个字符' }]}><Input maxLength={120} showCount /></Form.Item>
      <Form.Item name="slug" label="产品链接标识" extra="稳定链接用于 NFC 与二维码；发布后修改会影响已发出的链接。" rules={[{ required: true, message: '请输入产品链接标识' }, { pattern: slugPattern, message: '只可使用小写字母、数字和连字符' }]}><Input maxLength={100} /></Form.Item>
      <Form.Item name="subtitle" label="一句话说清产品价值" rules={[{ required: true, whitespace: true, min: 2, message: '核心价值至少 2 个字符' }]}><Input.TextArea rows={2} maxLength={500} showCount /></Form.Item>
      <Form.Item name="description" label="详细介绍" rules={[{ required: true, whitespace: true, min: 2, message: '详细介绍至少 2 个字符' }]}><Input.TextArea rows={4} maxLength={10000} showCount /></Form.Item>
      <div className="console-form-grid">
        <Form.Item name="useCase" label="使用场景"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
        <Form.Item name="audience" label="适用对象"><Input maxLength={1000} /></Form.Item>
        <Form.Item name="category" label="分类"><Input maxLength={100} /></Form.Item>
        <Form.Item name="cover" label="产品图片地址" rules={[{ type: 'url', warningOnly: false, message: '请输入完整的图片 URL' }]}><Input type="url" /></Form.Item>
      </div>
    </Form>
  </Modal>
}

function ProductAssets({ product, open, onClose }) {
  const {
    products, notify, uploadProductVideo, uploadProductImage, loadKnowledgeFiles,
    uploadKnowledgeFiles, confirmKnowledgeFile, verifyKnowledgeFile,
  } = useMuseum()
  const current = products.find((item) => item.id === product?.id) || product
  const [files, setFiles] = useState(null)
  const [knowledgeQueue, setKnowledgeQueue] = useState([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !product?.id) return undefined
    let active = true
    setFiles(null)
    setKnowledgeQueue([])
    setError('')
    loadKnowledgeFiles(product.id)
      .then((items) => { if (active) setFiles(items) })
      .catch((reason) => { if (active) { setFiles([]); setError(`资料列表加载失败：${reason.message}`) } })
    return () => { active = false }
  }, [open, product?.id, loadKnowledgeFiles])

  const reloadFiles = async () => {
    try { setFiles(await loadKnowledgeFiles(product.id)); setError('') }
    catch (reason) { setError(`资料列表加载失败：${reason.message}`) }
  }
  const uploadVideo = async (file) => {
    if (!/\.(mp4|webm)$/i.test(file.name)) { notify('请选择 MP4 或 WebM 视频文件', 'warning'); return Upload.LIST_IGNORE }
    if (file.size > maxVideoBytes) { notify('视频文件不能超过 100 MB', 'warning'); return Upload.LIST_IGNORE }
    setBusy('video')
    await uploadProductVideo(product.id, file)
    setBusy('')
    return Upload.LIST_IGNORE
  }
  const uploadImage = async (file) => {
    if (!/\.(jpe?g|png|webp)$/i.test(file.name)) { notify('请选择 JPG、PNG 或 WebP 图片文件', 'warning'); return Upload.LIST_IGNORE }
    if (file.size > maxImageBytes) { notify('产品图片不能超过 10 MB', 'warning'); return Upload.LIST_IGNORE }
    setBusy('image')
    await uploadProductImage(product.id, file)
    setBusy('')
    return Upload.LIST_IGNORE
  }
  const selectKnowledge = (file) => {
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) { notify('请选择 PDF、DOCX 或 TXT 资料', 'warning'); return Upload.LIST_IGNORE }
    if (file.size > maxKnowledgeBytes) { notify('资料文件不能超过 1 MB', 'warning'); return Upload.LIST_IGNORE }
    return false
  }
  const uploadKnowledgeBatch = async () => {
    const selected = knowledgeQueue.map((file) => file.originFileObj || file).filter(Boolean)
    if (!selected.length) { notify('请先选择要上传的资料', 'warning'); return }
    setBusy('knowledge')
    const result = await uploadKnowledgeFiles(product.id, selected)
    if (result?.length) { setKnowledgeQueue([]); await reloadFiles() }
    setBusy('')
  }
  const runFileAction = async (file, action) => {
    setBusy(file.id)
    if (action === 'confirm') await confirmKnowledgeFile(product.id, file.id)
    else await verifyKnowledgeFile(product.id, file.id)
    await reloadFiles()
    setBusy('')
  }

  return <Modal className="console-modal" title={`${current?.title || '产品'} · 内容管理`} open={open} onCancel={onClose} footer={<Space><Button icon={<ReloadOutlined />} onClick={reloadFiles} disabled={Boolean(busy)}>刷新资料状态</Button><Button type="primary" onClick={onClose} disabled={Boolean(busy)}>完成</Button></Space>} closable={!busy} mask={{ closable: !busy }} width={700} destroyOnHidden>
    <section className="console-asset-section">
      <div className="console-asset-heading"><div><h3>产品视频</h3><p>{current?.mediaUrl ? current.status === 'approved' ? '已上传，可在公开产品页播放。' : '已上传，产品发布后可在公开页播放。' : '尚未上传，公开产品页会显示缺失状态。'}</p></div><Upload accept=".mp4,.webm,video/mp4,video/webm" showUploadList={false} beforeUpload={uploadVideo} disabled={Boolean(busy)}><Button icon={<UploadOutlined />} loading={busy === 'video'}>{current?.mediaUrl ? '替换视频' : '上传视频'}</Button></Upload></div>
      <Typography.Text type="secondary">MP4 / WebM，单个文件不超过 100 MB。</Typography.Text>
      {current?.mediaUrl && current.status === 'approved' && <div className="console-asset-link"><Button type="link" href={current.mediaUrl} target="_blank" icon={<LinkOutlined />}>检查已上传视频</Button></div>}
    </section>
    <section className="console-asset-section">
      <div className="console-asset-heading"><div><h3>产品图片</h3><p>{current?.cover ? '已上传，替换后会更新公开产品页主图。' : '上传产品主图，客户先看到产品外观和价值。'}</p></div><Upload accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={uploadImage} disabled={Boolean(busy)}><Button icon={<UploadOutlined />} loading={busy === 'image'}>{current?.cover ? '替换图片' : '上传图片'}</Button></Upload></div>
      <Typography.Text type="secondary">JPG / PNG / WebP，单个文件不超过 10 MB。</Typography.Text>
    </section>
    <section className="console-asset-section">
      <div className="console-asset-heading"><div><h3>问答知识库</h3><p>可批量上传资料；确认索引后，阿里云检索服务与大模型会据此回答问题。</p></div><Space><Upload multiple accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" beforeUpload={selectKnowledge} onChange={({ fileList }) => setKnowledgeQueue(fileList.slice(-20))} fileList={knowledgeQueue} disabled={Boolean(busy)}><Button icon={<UploadOutlined />}>选择资料</Button></Upload><Button type="primary" onClick={uploadKnowledgeBatch} disabled={Boolean(busy) || !knowledgeQueue.length} loading={busy === 'knowledge'}>批量上传</Button></Space></div>
      <Typography.Text type="secondary">PDF / DOCX / TXT，单个文件不超过 1 MB，最多一次选择 20 个文件。</Typography.Text>
      {error && <Alert type="error" showIcon message={error} className="console-inline-alert" />}
      <List className="console-file-list" loading={files === null} dataSource={files || []} locale={{ emptyText: '还没有上传资料' }} renderItem={(file) => <List.Item actions={[
        ['pending', 'pending_confirmation', 'failed'].includes(file.status) ? <Button key="confirm" size="small" loading={busy === file.id} disabled={Boolean(busy) && busy !== file.id} onClick={() => runFileAction(file, 'confirm')}>确认索引</Button> : null,
        file.status === 'indexing' ? <Button key="verify" size="small" loading={busy === file.id} disabled={Boolean(busy) && busy !== file.id} onClick={() => runFileAction(file, 'verify')}>检查索引</Button> : null,
      ].filter(Boolean)}><List.Item.Meta title={file.url ? <a href={file.url} target="_blank" rel="noreferrer">{file.name}</a> : file.name} description={<span>{file.statusLabel}{file.errorMessage ? ` · ${file.errorMessage}` : ''}</span>} /></List.Item>} />
    </section>
  </Modal>
}

export default function AdminCollectionsPage() {
  const { products, brand, settings, updateProductStatus, notify, connection } = useMuseum()
  const [query, setQuery] = useState('')
  const [editor, setEditor] = useState(null)
  const [assets, setAssets] = useState(null)
  const [changingId, setChangingId] = useState('')
  const filtered = useMemo(() => products.filter((item) => `${item.title} ${item.slug} ${item.category}`.toLowerCase().includes(query.trim().toLowerCase())), [products, query])
  const brandSlug = brand?.slug || settings.brandSlug || products.find((item) => item.brandSlug)?.brandSlug || products.find((item) => item.brand?.slug)?.brand?.slug || products.find((item) => item.organization?.slug)?.organization?.slug || ''
  const productPath = (product) => {
    const slug = product?.brandSlug || product?.brand?.slug || product?.organization?.slug || brandSlug
    return slug && product?.slug ? `/b/${encodeURIComponent(slug)}/p/${encodeURIComponent(product.slug)}` : ''
  }

  const changeStatus = async (product, status) => {
    setChangingId(product.id)
    await updateProductStatus(product.id, status)
    setChangingId('')
  }
  const copyLink = async (product) => {
    const path = productPath(product)
    if (!path) { notify('企业链接尚未加载，请刷新后重试', 'warning'); return }
    const url = new URL(path, window.location.origin).href
    try { await navigator.clipboard.writeText(url); notify('产品链接已复制，可写入 NFC 卡片或生成二维码', 'success') }
    catch { notify('复制失败，请打开产品页面后从地址栏复制', 'warning') }
  }
  const moreItems = (product) => [
    ...(product.status === 'approved' ? [{ key: 'copy', label: '复制公开链接', icon: <CopyOutlined /> }] : []),
    ...(product.status === 'draft' ? [{ key: 'publish', label: '发布产品', icon: <CheckCircleOutlined /> }] : []),
    ...(product.status === 'archived' ? [{ key: 'restore', label: '恢复为草稿' }] : []),
    ...(product.status !== 'archived' ? [{ key: 'archive', label: '归档产品', danger: true }] : []),
  ]
  const handleMenu = (product, key) => {
    if (key === 'copy') copyLink(product)
    else changeStatus(product, { publish: 'approved', restore: 'draft', archive: 'archived' }[key])
  }
  const actions = (product) => <Space size={4} wrap className="console-row-actions">
    <Button type="text" size="small" onClick={() => setEditor(product)}>编辑</Button>
    <Button type="text" size="small" onClick={() => setAssets(product)}>内容</Button>
    {product.status === 'approved' && (productPath(product) ? <Button type="link" size="small" href={productPath(product)} target="_blank" rel="noreferrer">预览</Button> : <Button type="link" size="small" disabled title="企业链接尚未加载">预览</Button>)}
    <Dropdown menu={{ items: moreItems(product), onClick: ({ key }) => handleMenu(product, key) }} disabled={changingId === product.id} trigger={['click']}><Button type="text" size="small" icon={<MoreOutlined />} aria-label={`${product.title}更多操作`} /></Dropdown>
  </Space>

  const columns = [
    { title: '产品', key: 'product', render: (_, product) => <div className="console-product-name"><span className="console-product-icon"><FileTextOutlined /></span><span><strong>{product.title}</strong><small>{product.slug} · {product.category || '未分类'}</small></span></div> },
    { title: '状态', key: 'status', width: 110, render: (_, product) => <Tag color={statusColor[product.status] || 'default'}>{product.statusLabel || product.status}</Tag> },
    { title: '视频', key: 'video', width: 112, render: (_, product) => product.mediaUrl ? '已上传' : '待上传' },
    { title: '操作', key: 'actions', width: 255, render: (_, product) => actions(product) },
  ]

  return <AdminShell>
    <div className="console-page">
      <div className="console-page-heading"><div><span>产品资料</span><h2>产品管理</h2><p>维护统一的产品介绍、视频和问答资料，供客户与一线同事使用。</p></div><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ mode: 'new' })}>新建产品</Button></div>
      {connection !== 'connected' && <Alert type="error" showIcon message="企业服务未连接" description="暂时无法确认产品数据，请检查服务后刷新。" className="console-inline-alert" />}
      <div className="console-toolbar"><Input prefix={<SearchOutlined />} placeholder="搜索产品名称或链接" aria-label="搜索产品" value={query} onChange={(event) => setQuery(event.target.value)} allowClear /><span>{filtered.length} 个产品</span></div>
      <div className="console-desktop-table"><Table columns={columns} dataSource={filtered} rowKey="id" pagination={false} scroll={{ x: 760 }} locale={{ emptyText: <Empty description={query ? '没有匹配的产品' : '还没有产品'} /> }} /></div>
      <List className="console-mobile-products" dataSource={filtered} locale={{ emptyText: query ? '没有匹配的产品' : '还没有产品' }} renderItem={(product) => <List.Item><div className="console-mobile-product"><div className="console-mobile-product-head"><strong>{product.title}</strong><Tag color={statusColor[product.status] || 'default'}>{product.statusLabel || product.status}</Tag></div><small>{product.slug} · {product.category || '未分类'} · {product.mediaUrl ? '视频已上传' : '视频待上传'}</small>{actions(product)}</div></List.Item>} />
    </div>
    <ProductEditor product={editor?.mode === 'new' ? null : editor} open={Boolean(editor)} onClose={() => setEditor(null)} />
    <ProductAssets product={assets} open={Boolean(assets)} onClose={() => setAssets(null)} />
  </AdminShell>
}
