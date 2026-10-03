import { useState } from 'react'
import { Popup } from 'antd-mobile'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function PublicLeadPopup({ open, onClose, brandSlug, productSlug, source }) {
  const { submitLead } = useMuseum()
  const [form, setForm] = useState({ name: '', contact: '', message: '', consent: false })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const name = form.name.trim()
    const contact = form.contact.trim()
    const phone = /^1\d{10}$/.test(contact) ? contact : undefined
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) ? contact : undefined
    if (!name) { setError('请填写称呼'); return }
    if (!phone && !email) { setError('请填写有效的手机号或邮箱'); return }
    if (!form.message.trim()) { setError('请简要说明你的需求'); return }
    if (!form.consent) { setError('请先确认联系方式的使用范围'); return }
    setError('')
    setSubmitting(true)
    const ok = await submitLead({ brandSlug, productSlug, name, phone, email, message: form.message.trim(), consent: true, source })
    setSubmitting(false)
    if (ok) setSubmitted(true)
  }

  return <Popup visible={open} onMaskClick={onClose} onClose={onClose} position="bottom" bodyClassName="public-popup-body">
    <div className="public-popup-content">
      <header className="public-popup-head"><div><span className="public-kicker">CONTACT / 企业沟通</span><h2>把需求交给企业</h2></div><button className="public-icon-button" type="button" aria-label="关闭联系窗口" onClick={onClose}><CloseOutlined /></button></header>
      {submitted ? <div className="public-submit-success" role="status"><CheckOutlined aria-hidden="true" /><h3>意向已提交</h3><p>企业会根据你的需求和联系方式跟进。</p><button className="public-button public-button-primary" type="button" onClick={onClose}>完成</button></div> :
        <form className="public-lead-form" onSubmit={submit} noValidate>
          <label>怎么称呼<input autoComplete="name" value={form.name} maxLength={80} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>手机号或邮箱<input autoComplete="email" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} /></label>
          <label>想了解什么<textarea rows={3} maxLength={1000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label>
          <label className="public-consent"><input type="checkbox" checked={form.consent} onChange={(event) => setForm({ ...form, consent: event.target.checked })} /><span>我同意企业为本次产品咨询使用以上联系方式</span></label>
          {error && <p className="public-form-error" role="alert">{error}</p>}
          <button className="public-button public-button-primary" type="submit" disabled={submitting}>{submitting ? '提交中…' : '提交意向'}</button>
        </form>}
    </div>
  </Popup>
}
