import { useEffect, useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import QRCode from 'qrcode'
import { ActionSheet, Button as MobileButton, Card, Collapse, Space, Toast } from 'antd-mobile'
import { AppstoreOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined, DownloadOutlined, InfoCircleOutlined, LinkOutlined, MessageOutlined, MobileOutlined, QrcodeOutlined, ShareAltOutlined } from '@ant-design/icons'
import PublicLeadPopup from '../components/PublicLeadPopup.jsx'
import PublicProductNav, { publicEntrySource, publicProductPaths } from '../components/PublicProductNav.jsx'
import PublicShell from '../components/PublicShell.jsx'
import usePublicProduct from '../components/usePublicProduct.js'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function CollectionDetailPage() {
  const { product, status, brandSlug, productSlug, settings, brand } = usePublicProduct()
  const { recordInteraction, notify } = useMuseum()
  const [qr, setQr] = useState('')
  const [leadOpen, setLeadOpen] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const source = publicEntrySource(window.location.search)
  const paths = publicProductPaths(brandSlug, productSlug, window.location.search)
  const productUrl = useMemo(() => `${window.location.origin}${paths.product.split('?')[0]}`, [paths.product])
  const coverUrl = product?.cover || null
  const companyName = product?.brand?.name || brand?.name || settings.brandName || '企业产品空间'
  const companyDescription = product?.brand?.description || brand?.description || '企业简介尚未提供。'

  useEffect(() => {
    if (product) recordInteraction({ brandSlug, productSlug: product.slug, event: 'view', source })
  }, [brandSlug, product?.id, product?.slug, recordInteraction, source])

  useEffect(() => {
    if (!product || settings.featureQr === false) return
    QRCode.toDataURL(`${productUrl}?src=qr`, { width: 240, margin: 1, color: { dark: '#162427', light: '#ffffff' } }).then(setQr).catch(() => setQr(''))
  }, [product?.id, productUrl, settings.featureQr])

  const copyNfcLink = async () => {
    try {
      await navigator.clipboard.writeText(`${productUrl}?src=nfc`)
      Toast.show({ icon: <CheckOutlined />, content: 'NFC 产品链接已复制' })
    } catch { notify('复制失败，请从地址栏复制产品链接', 'warning') }
  }

  const downloadQr = () => {
    if (!qr || !product) return
    const anchor = document.createElement('a'); anchor.href = qr; anchor.download = `${product.slug}-qr.png`; anchor.click()
  }

  const openShare = () => ActionSheet.show({ actions: [
    settings.featureNfc !== false ? { key: 'nfc', text: '复制 NFC 产品链接', icon: <MobileOutlined />, onClick: copyNfcLink } : null,
    settings.featureQr !== false ? { key: 'qr', text: '下载产品二维码', icon: <QrcodeOutlined />, onClick: downloadQr } : null,
    { key: 'copy', text: '复制产品页地址', icon: <LinkOutlined />, onClick: async () => { await navigator.clipboard.writeText(productUrl); Toast.show('产品页地址已复制') } },
  ].filter(Boolean), cancelText: '取消' })

  return <PublicShell>
    <main className="mobile-product-page">
      <div className="mobile-product-topbar"><RouterLink to={`/b/${brandSlug}`} className="mobile-back-link"><ArrowLeftOutlined /> 产品目录</RouterLink><div className="mobile-product-view-nav">{product && <PublicProductNav brandSlug={brandSlug} productSlug={productSlug} active="product" />}</div></div>
      {status === 'loading' && <div className="public-state"><span className="public-state-mark" /><p>正在读取产品资料</p></div>}
      {status === 'missing' && <div className="public-state public-state-error"><InfoCircleOutlined /><h1>产品暂时不可用</h1><p>链接可能已归档，或尚未发布。</p><RouterLink to={`/b/${brandSlug}`}>返回产品目录</RouterLink></div>}
      {product && <>
        <section className="mobile-product-intro" aria-labelledby="product-title">
          <div className="mobile-product-kicker"><AppstoreOutlined /> PRODUCT VALUE / 01</div>
          <h1 id="product-title">{product.title}</h1>
          <div className="mobile-product-value"><span>它对你有什么价值</span><p className="mobile-product-summary">{product.summary || product.useCase || '产品价值说明待补充。'}</p></div>
          <div className="mobile-product-hero-media">{coverUrl && !imageFailed ? <img src={coverUrl} alt={`${product.title} 产品外观`} onError={() => setImageFailed(true)} /> : <div className="public-image-fallback"><span>PRODUCT</span><strong>{product.title}</strong></div>}<small>产品图片由企业提供</small></div>
          <div className="mobile-product-primary-actions"><RouterLink to={paths.ask} className="mobile-primary-action"><MessageOutlined /> 问问产品资料 <ArrowRightOutlined /></RouterLink><button type="button" className="mobile-secondary-action" onClick={() => setLeadOpen(true)}>联系企业</button></div>
          <div className="mobile-product-meta"><span className="public-live-dot" />{product.category || '产品资料'}<span>·</span>{product.knowledgeFiles?.length || 0} 份已确认资料<button type="button" onClick={openShare} aria-label="分享产品"><ShareAltOutlined /></button></div>
        </section>

        <section className="mobile-product-video" aria-labelledby="video-title"><div className="mobile-section-label">02 / WATCH</div><h2 id="video-title">先看它怎么工作</h2><div className="public-video-frame">{product.mediaUrl ? <video controls playsInline poster={product.cover || undefined} src={product.mediaUrl} aria-label={`${product.title} 产品讲解视频`} onPlay={() => recordInteraction({ brandSlug, productSlug: product.slug, event: 'play', source })} /> : <div className="public-video-empty"><span className="public-video-empty-icon">▶</span><strong>讲解视频待上传</strong><p>企业上传并发布视频后，会在这里直接播放。</p></div>}</div>{product.description && <p className="mobile-product-description">{product.description}</p>}</section>

        <section className="mobile-product-details" aria-label="产品详情"><Collapse accordion defaultActiveKey={['value']}><Collapse.Panel key="value" title="它解决什么问题"><p>{product.summary || '产品价值说明待补充。'}</p><dl><div><dt>适用场景</dt><dd>{product.useCase || '适用场景待补充。'}</dd></div><div><dt>适合谁</dt><dd>{product.audience || '适用对象待补充。'}</dd></div></dl></Collapse.Panel><Collapse.Panel key="company" title={`了解 ${companyName}`}><p>{companyDescription}</p></Collapse.Panel><Collapse.Panel key="share" title="带走这页：NFC / 二维码"><p>卡片只保存产品链接，内容更新无需重新制卡。</p><Space wrap><MobileButton size="small" fill="outline" onClick={copyNfcLink}><MobileOutlined /> 复制 NFC 链接</MobileButton><MobileButton size="small" fill="outline" onClick={downloadQr} disabled={!qr}><DownloadOutlined /> 下载二维码</MobileButton></Space>{qr && <img src={qr} alt={`打开${product.title}的二维码`} className="mobile-product-qr" />}</Collapse.Panel></Collapse></section>
        <Card className="mobile-product-trust"><InfoCircleOutlined /><div><strong>资料边界</strong><p>问答只依据企业确认的资料，参数和合作条件请以企业确认为准。</p></div></Card>
      </>}
      {product && <PublicLeadPopup open={leadOpen} onClose={() => setLeadOpen(false)} brandSlug={brandSlug} productSlug={product.slug} source={source} />}
    </main>
  </PublicShell>
}
