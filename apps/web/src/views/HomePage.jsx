import { useEffect, useMemo, useRef, useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import NfcRoundedIcon from '@mui/icons-material/NfcRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import PublicShell from '../components/PublicShell.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function HomePage() {
  const { brandSlug } = useParams()
  const { brand, approvedProducts, settings, loadBrand, recordInteraction } = useMuseum()
  const [filter, setFilter] = useState('全部')
  const [showNfc, setShowNfc] = useState(false)
  const heroRef = useRef(null)
  const categories = Array.isArray(settings.catalogCategories) ? settings.catalogCategories : []
  const publicSlug = brand?.slug || brandSlug || settings.brandSlug || ''
  const copy = settings.publicCopy || {}
  const items = useMemo(() => filter === '全部' ? approvedProducts : approvedProducts.filter((item) => item.category === filter), [approvedProducts, filter])

  useEffect(() => { if (brandSlug) loadBrand(brandSlug) }, [brandSlug, loadBrand])
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const context = gsap.context(() => {
      gsap.from('.home-hero-copy > *', { opacity: 0, y: 16, duration: .55, stagger: .06, ease: 'power2.out' })
      gsap.from('.home-hero-orbit', { opacity: 0, rotate: -8, scale: .94, duration: .8, delay: .12, ease: 'expo.out' })
      gsap.from('.home-product-card', { opacity: 0, y: 12, duration: .35, stagger: .05, delay: .18, ease: 'power2.out' })
    }, heroRef)
    return () => context.revert()
  }, [])

  return <PublicShell>
    <Box ref={heroRef} className="home-page home-page-new">
      <section className="home-hero"><Container maxWidth="lg" className="home-hero-inner">
        <Box className="home-hero-copy"><Typography className="public-kicker">PRODUCT EXPLAINER / 01</Typography><Typography component="h1">让产品<br /><em>自己讲清楚。</em></Typography><Typography className="home-hero-lead">{brand?.description || settings.brandTagline || copy.heroLead || '从一件产品开始，看懂用途、问清细节，再把真实意向交给企业。'}</Typography><Stack direction="row" useFlexGap flexWrap="wrap" className="home-hero-actions"><Button component="a" href="#products" variant="contained" endIcon={<ArrowForwardRoundedIcon />}>浏览产品</Button><Button variant="outlined" startIcon={settings.featureNfc !== false ? <NfcRoundedIcon /> : <QrCode2RoundedIcon />} onClick={() => setShowNfc((value) => !value)}>怎么进入产品页</Button></Stack><Typography className="home-hero-note"><span className="public-live-dot" />面向展会、展厅与外出销售的产品知识入口</Typography></Box>
        <Box className="home-hero-visual"><div className="home-hero-orbit"><span className="home-orbit-ring home-orbit-ring-one" /><span className="home-orbit-ring home-orbit-ring-two" /><div className="home-hero-card"><span className="home-hero-card-index">01</span><NfcRoundedIcon /><strong>TOUCH<br /><i>TO UNDERSTAND</i></strong><small>NFC / QR READY</small></div></div><div className="home-hero-label"><span>ONE PRODUCT</span><strong>ONE CLEAR<br />STORY</strong></div></Box>
      </Container></section>
      {showNfc && <Container maxWidth="lg" className="home-entry-note"><div className="home-entry-icon">{settings.featureNfc !== false ? <NfcRoundedIcon /> : <QrCode2RoundedIcon />}</div><div><Typography className="public-kicker">NFC / QR ENTRY</Typography><Typography component="h2">碰一下或扫一下，先看懂产品</Typography><Typography>卡片和二维码只保存稳定产品链接，产品内容更新无需重新制卡。</Typography></div><Button component="a" href="#products" endIcon={<ArrowForwardRoundedIcon />}>查看产品</Button></Container>}
      <section id="products" className="home-products"><Container maxWidth="lg"><div className="home-section-heading"><div><Typography className="public-kicker">PRODUCTS / 02</Typography><Typography component="h2">先理解，再开始对话。</Typography></div><Typography>{approvedProducts.length} 个已发布产品<br /><small>企业维护，客户自助了解</small></Typography></div><Stack direction="row" useFlexGap flexWrap="wrap" className="home-filter-row">{['全部', ...categories].map((option) => <Button key={option} size="small" variant={filter === option ? 'contained' : 'outlined'} onClick={() => setFilter(option)}>{option}</Button>)}</Stack><div className="home-product-grid">{items.map((item, index) => <RouterLink to={`/b/${publicSlug}/p/${item.slug}`} key={item.id} className="home-product-card" onClick={() => recordInteraction({ brandSlug: publicSlug, productSlug: item.slug, event: 'view', source: new URLSearchParams(window.location.search).get('src') || 'direct' })}><div className="home-product-media">{item.cover ? <img src={item.cover} alt={`${item.title} 产品图`} loading="lazy" /> : <div className="home-product-placeholder"><PlayArrowRoundedIcon /><small>PRODUCT / {String(index + 1).padStart(2, '0')}</small></div>}<span className="home-product-open"><ArrowUpwardRoundedIcon /></span></div><div className="home-product-body"><div className="home-product-meta"><span>{item.category || '产品资料'}</span><StatusBadge status={item.status} label={item.statusLabel} /></div><Typography component="h3">{item.title}</Typography><Typography>{item.summary || item.useCase}</Typography><span className="home-product-cta">打开产品页 <ArrowForwardRoundedIcon fontSize="small" /></span></div></RouterLink>)}{!items.length && <div className="home-empty"><strong>还没有已发布的产品</strong><span>请联系企业管理员。</span></div>}</div></Container></section>
      <section id="about" className="home-method"><Container maxWidth="lg" className="home-method-inner"><div><Typography className="public-kicker">WHY THIS EXISTS / 03</Typography><Typography component="h2">减少重复讲解，把时间交还给一线。</Typography><Typography>新人不必先背完一套产品手册，客户也不必在人多时等待工作人员。统一的产品页把基础介绍、视频和问答放在同一个入口，帮助企业降低销售培训与重复讲解成本。</Typography>{items[0] ? <Button component={RouterLink} to={`/b/${publicSlug}/p/${items[0].slug}`} endIcon={<ArrowForwardRoundedIcon />}>体验产品故事</Button> : <Button component="a" href="#products" endIcon={<ArrowForwardRoundedIcon />}>等待企业发布产品</Button>}</div><div className="home-method-steps"><div><span>01</span><strong>碰卡或扫码</strong><p>稳定产品链接，随时可分享。</p></div><div><span>02</span><strong>看懂并追问</strong><p>视频、用途和资料集中呈现。</p></div><div><span>03</span><strong>留下意向</strong><p>客户主动提交，再交给一线跟进。</p></div></div></Container></section>
      <section id="contact" className="home-closing"><Container maxWidth="lg"><Typography className="public-kicker">KEEP THE CONVERSATION</Typography><Typography component="h2">让每一次触碰，都成为一次有效介绍。</Typography><Button component="a" href="#products" variant="contained" endIcon={<ArrowForwardRoundedIcon />}>查看全部产品</Button></Container></section>
    </Box>
  </PublicShell>
}
