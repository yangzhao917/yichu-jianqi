import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMuseum } from '../state/MuseumContext.jsx'

export default function usePublicProduct() {
  const { brandSlug, productSlug, slug } = useParams()
  const { brand, settings, loadBrand, loadProduct } = useMuseum()
  const currentBrandSlug = brandSlug || brand?.slug || settings.brandSlug || ''
  const currentProductSlug = productSlug || slug
  const [product, setProduct] = useState(null)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    if (!currentProductSlug) { setStatus('missing'); return undefined }
    let active = true
    setProduct(null)
    setStatus('loading')
    const load = async () => {
      if (brandSlug) await loadBrand(brandSlug)
      const item = await loadProduct(currentBrandSlug, currentProductSlug)
      if (!active) return
      setProduct(item?.status === 'approved' ? item : null)
      setStatus(item?.status === 'approved' ? 'ready' : 'missing')
    }
    void load()
    return () => { active = false }
  }, [brandSlug, currentBrandSlug, currentProductSlug, loadBrand, loadProduct])

  return { product, status, brand, brandSlug: currentBrandSlug, productSlug: currentProductSlug, settings }
}
