import { useEffect, useState } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, LockOutlined, PhoneOutlined, SendOutlined } from '@ant-design/icons'
import AdminTheme from '../components/AdminTheme.jsx'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useMuseum()
  const [form] = Form.useForm()
  const [countdown, setCountdown] = useState(0)
  const [pending, setPending] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [error, setError] = useState('')
  const [requestFeedback, setRequestFeedback] = useState(null)

  useEffect(() => {
    if (!countdown) return undefined
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [countdown])

  const requestCode = async () => {
    try { await form.validateFields(['phone']) } catch { return }
    const phone = form.getFieldValue('phone')
    setError('')
    setRequestFeedback(null)
    setRequesting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE || '/api'}/auth/request-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone }) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.message || '验证码服务不可用')
      setCountdown(60)
      setRequestFeedback({ type: 'success', text: '验证码已发送，请检查手机。' })
    } catch (reason) {
      setRequestFeedback({ type: 'error', text: `验证码发送失败：${reason.message}` })
    } finally { setRequesting(false) }
  }

  const submit = async ({ phone, code }) => {
    setError('')
    // 发送成功提示只属于“获取验证码”这一步；提交登录后清掉，避免和登录结果叠加。
    setRequestFeedback(null)
    setPending(true)
    try {
      await login(phone, code)
      navigate(new URLSearchParams(location.search).get('redirect') || '/admin/products')
    } catch (reason) {
      if (reason.code === 'ACCOUNT_NOT_REGISTERED' && reason.details?.registrationToken) {
        window.sessionStorage.setItem('yichu-jianqi-registration-ticket', reason.details.registrationToken)
        navigate('/register')
        return
      }
      setError(reason.message || '登录失败，请稍后再试。')
    } finally { setPending(false) }
  }

  return <AdminTheme>
    <div className="console-login">
      <header className="console-login-header"><RouterLink to="/" className="console-brand"><span className="console-brand-mark">企</span><span><strong>一触见企</strong><small>企业管控台</small></span></RouterLink><RouterLink to="/" className="console-login-back"><ArrowLeftOutlined /> 返回产品页</RouterLink></header>
      <main className="console-login-main">
        <section className="console-login-context"><span className="console-login-eyebrow">企业管理员入口</span><h1>管理产品内容<br />与客户线索</h1><p>一处更新产品介绍、讲解视频与问答资料，及时跟进客户主动提交的需求。</p><div className="console-login-context-foot"><LockOutlined /> 企业资料仅向已授权管理员开放</div></section>
        <section className="console-login-form-panel" aria-labelledby="login-title"><div className="console-login-form-inner"><span className="console-login-eyebrow">WELCOME BACK</span><h2 id="login-title">登录企业后台</h2><p>使用管理员手机号验证码登录。<RouterLink to="/register" className="console-form-link">没有企业账号？先注册</RouterLink></p>
          <Form form={form} layout="vertical" onFinish={submit} className="console-login-form" requiredMark={false}>
            <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入 11 位手机号' }]}><Input prefix={<PhoneOutlined />} inputMode="tel" maxLength={11} autoComplete="tel" placeholder="请输入手机号" /></Form.Item>
            <Form.Item label="验证码" required><div className="console-code-row"><Form.Item name="code" noStyle rules={[{ required: true, message: '请输入验证码' }, { pattern: /^\d{4,6}$/, message: '验证码为 4 至 6 位数字' }]}><Input inputMode="numeric" maxLength={6} autoComplete="one-time-code" placeholder="请输入验证码" /></Form.Item><Button type="default" icon={<SendOutlined />} onClick={requestCode} loading={requesting} disabled={Boolean(countdown)}>{countdown ? `${countdown}s` : '获取验证码'}</Button></div></Form.Item>
            {requestFeedback && <Alert type={requestFeedback.type} showIcon message={requestFeedback.text} className="console-inline-alert" />}
            {error && <Alert type="error" showIcon message={error} className="console-inline-alert" />}
            <Button type="primary" htmlType="submit" loading={pending} block className="console-login-submit">进入工作台 <ArrowRightOutlined /></Button>
          </Form>
        </div></section>
      </main>
      <footer className="console-login-footer">一触见企 · XiHack 2026</footer>
    </div>
  </AdminTheme>
}
