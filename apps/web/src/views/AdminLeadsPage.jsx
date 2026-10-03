import { useMemo, useState } from 'react'
import { Alert, Empty, List, Select, Table, Tag, Typography } from 'antd'
import { ContactsOutlined } from '@ant-design/icons'
import AdminShell from '../components/AdminShell.jsx'
import { useMuseum } from '../state/MuseumContext.jsx'

const statusOptions = [
  { value: 'new', label: '待跟进' },
  { value: 'contacted', label: '已联系' },
  { value: 'qualified', label: '已确认' },
  { value: 'closed', label: '已关闭' },
]
const sourceLabel = { nfc: 'NFC', qr: '二维码', share: '分享', direct: '直接访问' }

export default function AdminLeadsPage() {
  const { leads, updateLead, connection } = useMuseum()
  const [filter, setFilter] = useState('all')
  const [changingId, setChangingId] = useState('')
  const items = useMemo(() => leads.filter((item) => filter === 'all' || item.status === filter), [filter, leads])
  const setStatus = async (id, status) => {
    setChangingId(id)
    await updateLead(id, status)
    setChangingId('')
  }
  const statusSelect = (item) => <Select value={item.status || 'new'} options={statusOptions} aria-label={`更新${item.name || '该条线索'}状态`} onChange={(value) => setStatus(item.id, value)} loading={changingId === item.id} disabled={Boolean(changingId) && changingId !== item.id} className="console-lead-status" />

  const columns = [
    { title: '联系人', key: 'contact', width: 195, render: (_, item) => <div className="console-lead-contact"><strong>{item.name || '未填写称呼'}</strong><small>{item.company || '未填写公司'}</small><span>{[item.phone, item.email].filter(Boolean).join(' · ') || '联系方式已隐藏'}</span></div> },
    { title: '产品', dataIndex: 'productTitle', key: 'product', width: 125 },
    { title: '需求', key: 'message', width: 240, render: (_, item) => <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: '展开' }} className="console-lead-message">{item.message || '未填写需求描述'}</Typography.Paragraph> },
    { title: '入口', key: 'source', width: 98, render: (_, item) => <Tag>{sourceLabel[item.source] || item.source || '未知'}</Tag> },
    { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', width: 140 },
    { title: '跟进状态', key: 'status', width: 132, render: (_, item) => statusSelect(item) },
  ]

  return <AdminShell>
    <div className="console-page">
      <div className="console-page-heading"><div><span>客户意向</span><h2>线索跟进</h2><p>只展示访客主动同意提交的联系方式和需求。</p></div><div className="console-count"><ContactsOutlined /><strong>{leads.length}</strong><span>条线索</span></div></div>
      {connection !== 'connected' && <Alert type="error" showIcon message="企业服务未连接" description="暂时无法确认线索数据，请检查服务后刷新。" className="console-inline-alert" />}
      <div className="console-toolbar"><Select value={filter} onChange={setFilter} options={[{ value: 'all', label: '全部状态' }, ...statusOptions]} aria-label="按线索状态筛选" className="console-filter" /><span>{items.length} 条线索</span></div>
      <div className="console-desktop-table"><Table columns={columns} dataSource={items} rowKey="id" pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 930 }} locale={{ emptyText: <Empty description="还没有符合条件的线索" /> }} /></div>
      <List className="console-mobile-leads" dataSource={items} pagination={{ pageSize: 10, size: 'small' }} locale={{ emptyText: '还没有符合条件的线索' }} renderItem={(item) => <List.Item><article className="console-mobile-lead"><div className="console-mobile-lead-head"><strong>{item.name || '未填写称呼'}</strong><Tag>{sourceLabel[item.source] || item.source || '未知'}</Tag></div><small>{item.productTitle} · {item.createdAt}</small><p className="console-mobile-lead-contact">{[item.phone, item.email].filter(Boolean).join(' · ') || '联系方式已隐藏'}</p><p>{item.message || '未填写需求描述'}</p><label>跟进状态 {statusSelect(item)}</label></article></List.Item>} />
      <p className="console-privacy-note">这些联系方式由访客主动提交，仅用于企业跟进。入口来源用于区分 NFC、二维码与分享访问。</p>
    </div>
  </AdminShell>
}
