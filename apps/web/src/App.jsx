import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Alert } from 'antd'
import AdminTheme from './components/AdminTheme.jsx'
import { useMuseum } from './state/MuseumContext.jsx'
import HomePage from './views/HomePage.jsx'
import CollectionDetailPage from './views/CollectionDetailPage.jsx'
import ProductAskPage from './views/ProductAskPage.jsx'
import LoginPage from './views/LoginPage.jsx'
import RegisterPage from './views/RegisterPage.jsx'
import AdminCollectionsPage from './views/AdminCollectionsPage.jsx'
import AdminLeadsPage from './views/AdminLeadsPage.jsx'
import AdminProfilePage from './views/AdminProfilePage.jsx'

function Protected({ children }) { const { user } = useMuseum(); const location = useLocation(); return user ? children : <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace /> }
function GuestOnly({ children }) { const { user } = useMuseum(); return user ? <Navigate to="/admin/products" replace /> : children }

export default function App() {
  const { initialize, notice, clearNotice } = useMuseum()
  useEffect(() => { initialize() }, [initialize])
  return <>
    <Routes>
      <Route path="/" element={<HomePage />} /><Route path="/b/:brandSlug" element={<HomePage />} /><Route path="/collections" element={<HomePage />} /><Route path="/b/:brandSlug/p/:productSlug/ask" element={<ProductAskPage />} /><Route path="/b/:brandSlug/p/:productSlug" element={<CollectionDetailPage />} /><Route path="/collections/:slug" element={<CollectionDetailPage />} />
      <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
      <Route path="/admin/products" element={<Protected><AdminCollectionsPage /></Protected>} /><Route path="/admin/collections" element={<Navigate to="/admin/products" replace />} /><Route path="/admin/leads" element={<Protected><AdminLeadsPage /></Protected>} /><Route path="/admin/profile" element={<Protected><AdminProfilePage /></Protected>} /><Route path="/admin/analytics" element={<Navigate to="/admin/products" replace />} /><Route path="/admin/review" element={<Navigate to="/admin/products" replace />} /><Route path="/admin/agent" element={<Navigate to="/admin/products" replace />} /><Route path="/admin/settings" element={<Navigate to="/admin/profile" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {notice && <AdminTheme><Alert className="global-notice" type={notice.tone === 'warning' ? 'warning' : notice.tone === 'success' ? 'success' : 'info'} message={notice.message} showIcon closable onClose={clearNotice} /></AdminTheme>}
  </>
}
