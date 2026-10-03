import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Container, IconButton } from '@mui/material'
import ArrowUpRightRoundedIcon from '@mui/icons-material/ArrowUpwardRounded'
import LoginRoundedIcon from '@mui/icons-material/LoginRounded'
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function PublicShell({ children }) {
  const location = useLocation(); const navigate = useNavigate(); const { user, connection, logout, settings, brand } = useMuseum(); const copy = settings.publicCopy || {}
  const brandSlug = brand?.slug || settings.brandSlug || ''
  const leave = () => { logout(); navigate('/') }
  return <Box className="public-shell">
    <header className="public-header"><Container maxWidth="lg" className="public-header-inner">
      <RouterLink to={brandSlug ? `/b/${brandSlug}` : '/'} className="public-brand"><span className="public-brand-mark"><TuneRoundedIcon fontSize="small" /></span><span><strong>一触见企</strong><small>PRODUCT KNOWLEDGE HUB</small></span></RouterLink>
      <nav className="public-header-nav" aria-label="主导航"><RouterLink className={location.pathname.startsWith('/b/') ? 'is-active' : ''} to={brandSlug ? `/b/${brandSlug}` : '/'}>{copy.navProducts || '产品目录'}</RouterLink><a href={brandSlug ? `/b/${brandSlug}#about` : '#about'}>{copy.navHow || '使用方式'}</a><a href={brandSlug ? `/b/${brandSlug}#contact` : '#contact'}>{copy.navContact || '联系企业'}</a></nav>
      <div className="public-header-actions"><span className="public-connection"><i className={connection === 'connected' ? 'is-live' : ''} />{connection === 'connected' ? 'LIVE' : 'OFFLINE'}</span>{!user ? <Button component={RouterLink} to="/login" size="small" startIcon={<LoginRoundedIcon />} variant="outlined">企业登录</Button> : <><Button component={RouterLink} to="/admin/products" size="small" variant="outlined">进入管控台 <ArrowUpRightRoundedIcon fontSize="small" /></Button><IconButton aria-label="退出后台" title="退出后台" onClick={leave}><LogoutRoundedIcon fontSize="small" /></IconButton></>}</div>
    </Container></header>
    {connection !== 'connected' && <div className="public-status-strip"><span>{copy.connectionTitle || '企业服务未连接'}</span><span>{copy.connectionCopy || '暂时无法读取企业发布的产品资料。'}</span></div>}
    <Box component="main">{children}</Box><footer className="public-footer"><Container maxWidth="lg" className="public-footer-inner"><span>{copy.footerLeft || '一触见企 · XiHack 2026'}</span><span>{copy.footerRight || '产品知识 × NFC × 一线跟进'}</span></Container></footer>
  </Box>
}
