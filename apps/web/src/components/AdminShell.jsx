import { useEffect } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Button, Layout, Menu, Tag } from 'antd'
import { AppstoreOutlined, BankOutlined, ContactsOutlined, LogoutOutlined } from '@ant-design/icons'
import { useMuseum } from '../state/MuseumContext.jsx'
import AdminTheme from './AdminTheme.jsx'

const navItems = [
  { key: '/admin/products', icon: <AppstoreOutlined />, label: <RouterLink to="/admin/products">产品管理</RouterLink> },
  { key: '/admin/leads', icon: <ContactsOutlined />, label: <RouterLink to="/admin/leads">线索跟进</RouterLink> },
  { key: '/admin/profile', icon: <BankOutlined />, label: <RouterLink to="/admin/profile">企业资料</RouterLink> },
]

export default function AdminShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, connection, logout, loadManagementData, settings, brand } = useMuseum()
  const pageTitle = location.pathname === '/admin/leads' ? '线索跟进' : location.pathname === '/admin/profile' ? '企业资料' : '产品管理'
  const brandSlug = brand?.slug || settings.brandSlug || ''

  useEffect(() => { loadManagementData() }, [loadManagementData])
  const leave = () => { logout(); navigate('/') }

  return <AdminTheme>
    <Layout className="console-shell">
      <Layout.Sider width={228} className="console-sidebar" theme="light">
        <RouterLink to={brandSlug ? `/b/${brandSlug}` : '/'} className="console-brand">
          <span className="console-brand-mark">企</span>
          <span><strong>{brand?.name || settings.brandName || '企业工作台'}</strong><small>一触见企 · 管控台</small></span>
        </RouterLink>
        <span className="console-nav-label">工作空间</span>
        <Menu mode="inline" selectedKeys={[location.pathname]} items={navItems} className="console-menu" aria-label="企业后台导航" />
        <div className="console-sidebar-foot">
          <Tag color={connection === 'connected' ? 'success' : 'error'}>{connection === 'connected' ? '企业服务已连接' : '企业服务未连接'}</Tag>
          <Button type="text" icon={<LogoutOutlined />} onClick={leave}>退出登录</Button>
        </div>
      </Layout.Sider>
      <Layout className="console-workspace">
        <Layout.Header className="console-header">
          <div><span className="console-header-kicker">企业工作台</span><h1>{pageTitle}</h1></div>
          <Button type="text" className="console-user-button" onClick={() => navigate('/admin/profile')} aria-label="打开企业资料">
            <div className="console-user"><Avatar>{user?.name?.slice(0, 1) || '企'}</Avatar><span><strong>{user?.name || '企业管理员'}</strong><small>{user?.role || 'admin'} · {user?.brandSlug || brandSlug}</small></span></div>
          </Button>
        </Layout.Header>
        <nav className="console-mobile-nav" aria-label="企业后台导航"><Menu mode="horizontal" selectedKeys={[location.pathname]} items={navItems} /></nav>
        <Layout.Content className="console-content">{children}</Layout.Content>
      </Layout>
    </Layout>
  </AdminTheme>
}
