import { useEffect } from 'react'
import { Typography } from 'antd'
import AdminShell from '../components/AdminShell.jsx'
import BrandDescriptionEditor from '../components/BrandDescriptionEditor.jsx'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function AdminProfilePage() {
  const { user, brand, settings, loadBrand } = useMuseum()
  const brandSlug = brand?.slug || settings.brandSlug || ''

  useEffect(() => {
    if (!brand && brandSlug) loadBrand(brandSlug)
  }, [brand, brandSlug, loadBrand])

  return <AdminShell>
    <div className="console-page console-profile-page">
      <div className="console-page-heading"><div><span>企业空间</span><h2>企业资料</h2><p>维护企业对外展示的信息。客户从产品页继续了解企业时，会看到这里的介绍。</p></div></div>
      <section className="console-profile-summary" aria-label="企业账号信息">
        <div><span>当前管理员</span><strong>{user?.name || '企业管理员'}</strong><Typography.Text>{user?.phone || '手机号登录账号'}</Typography.Text></div>
        <div><span>所属企业</span><strong>{brand?.name || settings.brandName || '企业产品空间'}</strong><Typography.Text>{brandSlug ? `企业标识：${brandSlug}` : '企业信息加载中'}</Typography.Text></div>
      </section>
      <BrandDescriptionEditor />
    </div>
  </AdminShell>
}
