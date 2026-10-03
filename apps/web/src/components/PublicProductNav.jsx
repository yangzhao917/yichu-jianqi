import { Link, useLocation } from 'react-router-dom'
import { AppstoreOutlined, MessageOutlined } from '@ant-design/icons'

export function publicProductPaths(brandSlug, productSlug, search = '') {
  const base = `/b/${encodeURIComponent(brandSlug)}/p/${encodeURIComponent(productSlug)}`
  const source = new URLSearchParams(search).get('src')
  const suffix = source ? `?src=${encodeURIComponent(source)}` : ''
  return { product: `${base}${suffix}`, ask: `${base}/ask${suffix}` }
}

export function publicEntrySource(search = '') {
  return new URLSearchParams(search).get('src') || 'direct'
}

export default function PublicProductNav({ brandSlug, productSlug, active }) {
  const { search } = useLocation()
  const paths = publicProductPaths(brandSlug, productSlug, search)
  return <nav className="product-view-nav" aria-label="产品页面">
    <Link to={paths.product} aria-current={active === 'product' ? 'page' : undefined} className={active === 'product' ? 'is-active' : ''}><AppstoreOutlined aria-hidden="true" /><span>产品介绍</span></Link>
    <Link to={paths.ask} aria-current={active === 'ask' ? 'page' : undefined} className={active === 'ask' ? 'is-active' : ''}><MessageOutlined aria-hidden="true" /><span>知识问答</span></Link>
  </nav>
}
