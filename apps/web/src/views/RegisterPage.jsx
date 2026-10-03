import React from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { Alert, Button, Form, Input } from 'antd'
import { ArrowLeftOutlined, ArrowRightOutlined, BankOutlined, LockOutlined } from '@ant-design/icons'
import AdminTheme from '../components/AdminTheme.jsx'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useMuseum()
  const [form] = Form.useForm()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState('')
  const registrationToken = window.sessionStorage.getItem('yichu-jianqi-registration-ticket') || ''

  const submit = async (values) => {
    setPending(true)
    setError('')
    try {
      await register({ ...values, registrationToken })
      window.sessionStorage.removeItem('yichu-jianqi-registration-ticket')
      navigate('/admin/products')
    } catch (reason) {
      setError(reason.code === 'PHONE_REGISTERED' ? '手机号已注册，请返回登录。' : reason.message || '注册失败，请稍后再试。')
    } finally {
      setPending(false)
    }
  }

  return <AdminTheme>
    <div className="console-login">
      <header className="console-login-header"><RouterLink to="/" className="console-brand"><span className="console-brand-mark">企</span><span><strong>一触见企</strong><small>企业管控台</small></span></RouterLink><RouterLink to="/login" className="console-login-back"><ArrowLeftOutlined /> 返回登录</RouterLink></header>
      <main className="console-login-main">
        <section className="console-login-context"><span className="console-login-eyebrow">企业注册</span><h1>先创建企业空间<br />再维护产品内容</h1><p>手机号验证通过后，只需补充企业信息。注册完成后，企业产品和客户线索都会归属于这个空间。</p><div className="console-login-context-foot"><LockOutlined /> 企业资料仅向已授权管理员开放</div></section>
        <section className="console-login-form-panel" aria-labelledby="register-title"><div className="console-login-form-inner"><span className="console-login-eyebrow">CREATE SPACE</span><h2 id="register-title">注册企业账号</h2><p>补充企业信息即可完成注册。</p>
          {!registrationToken && <Alert type="warning" showIcon message="请先在登录页完成手机号验证" description={<RouterLink to="/login" className="console-form-link">返回登录并验证手机号</RouterLink>} className="console-inline-alert" />}
          <Form form={form} layout="vertical" onFinish={submit} disabled={!registrationToken} className="console-login-form" requiredMark={false}>
            <Form.Item name="organizationName" label="企业名称" rules={[{ required: true, message: '请输入企业名称' }, { min: 2, message: '企业名称至少 2 个字' }]}><Input prefix={<BankOutlined />} placeholder="请输入企业名称" maxLength={120} /></Form.Item>
            <Form.Item name="creditCode" label="统一社会信用代码" rules={[{ required: true, message: '请输入统一社会信用代码' }, { pattern: /^[0-9A-Z]{18}$/i, message: '请输入 18 位统一社会信用代码' }]}><Input placeholder="请输入 18 位统一社会信用代码" maxLength={18} style={{ textTransform: 'uppercase' }} /></Form.Item>
            <Form.Item name="description" label="公司介绍"><Input.TextArea rows={4} maxLength={2000} showCount placeholder="介绍公司的主营方向、产品能力或服务范围" /></Form.Item>
            {error && <Alert type="error" showIcon message={error} className="console-inline-alert" />}
            <Button type="primary" htmlType="submit" loading={pending} block className="console-login-submit">完成注册 <ArrowRightOutlined /></Button>
          </Form>
        </div></section>
      </main>
      <footer className="console-login-footer">一触见企 · 企业管理员注册</footer>
    </div>
  </AdminTheme>
}
