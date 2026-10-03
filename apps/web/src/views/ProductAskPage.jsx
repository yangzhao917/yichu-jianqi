import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Popup } from 'antd-mobile'
import { ArrowLeftOutlined, CloseOutlined, FileTextOutlined, SendOutlined } from '@ant-design/icons'
import PublicLeadPopup from '../components/PublicLeadPopup.jsx'
import PublicProductNav, { publicEntrySource, publicProductPaths } from '../components/PublicProductNav.jsx'
import PublicShell from '../components/PublicShell.jsx'
import usePublicProduct from '../components/usePublicProduct.js'
import { useMuseum } from '../state/MuseumContext.jsx'

const prompts = ['它解决什么问题？', '适合哪些使用场景？', '有哪些资料可以核对？']

function CitedAnswer({ answer, citations, onOpen }) {
  return String(answer || '').split(/(\[\d+\])/g).map((part, index) => {
    const id = part.match(/^\[(\d+)\]$/)?.[1]
    if (!id) return <span key={index}>{part}</span>
    const citation = citations.find((item) => String(item.id) === id)
    return citation ? <button key={index} type="button" className="public-citation" onClick={() => onOpen(citation)} aria-label={`查看引用 ${id}`}>[{id}]</button> : <span key={index}>{part}</span>
  })
}

export default function ProductAskPage() {
  const { product, status, brandSlug, productSlug } = usePublicProduct()
  const { askProduct } = useMuseum()
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [asking, setAsking] = useState(false)
  const [citation, setCitation] = useState(null)
  const [leadOpen, setLeadOpen] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const paths = publicProductPaths(brandSlug, productSlug, window.location.search)
  const source = publicEntrySource(window.location.search)

  const ask = async (event, suggestedQuestion) => {
    event?.preventDefault()
    const value = String(suggestedQuestion || question).trim()
    if (!product || !value || asking) return
    setMessages((items) => [...items, { role: 'user', text: value }])
    setQuestion('')
    setAsking(true)
    try {
      const result = await askProduct({ brandSlug, productSlug: product.slug, question: value })
      setMessages((items) => [...items, { role: 'assistant', text: result.answer || '当前资料无法确认', citations: result.citations || [], insufficientEvidence: Boolean(result.insufficientEvidence) }])
    } catch (error) {
      setMessages((items) => [...items, { role: 'error', text: `问答暂时不可用：${error.message}` }])
    } finally {
      setAsking(false)
    }
  }

  return <PublicShell>
    <div className="public-ask-page">
      <div className="public-ask-wrap">
        <div className="public-product-topline">
          <RouterLink to={paths.product} className="public-ask-back"><ArrowLeftOutlined /> 返回产品</RouterLink>
          {product && <PublicProductNav brandSlug={brandSlug} productSlug={productSlug} active="ask" />}
        </div>
        {status === 'loading' && <div className="public-state"><span className="public-state-mark" /><p>正在读取产品资料</p></div>}
        {status === 'missing' && <div className="public-state public-state-error"><h1>产品暂时不可用</h1><p>链接可能已归档，或尚未发布。</p><RouterLink to={`/b/${brandSlug}`}>返回产品目录</RouterLink></div>}
        {product && <div className="public-ask-layout">
          <aside className="public-ask-product" aria-label="产品介绍">
            <span className="public-kicker">PRODUCT VALUE / 01</span>
            <div className="public-ask-product-media">{product.cover ? <img src={product.cover} alt={`${product.title} 产品外观`} /> : <div className="public-image-fallback"><span>PRODUCT</span><strong>{product.title}</strong></div>}</div>
            <h2>{product.title}</h2>
            <span className="public-ask-value-label">它对你有什么价值</span>
            <p className="public-ask-product-summary">{product.summary || product.useCase || '产品价值说明待补充。'}</p>
            <dl className="public-ask-product-facts"><div><dt>适用场景</dt><dd>{product.useCase || '以企业资料为准'}</dd></div><div><dt>适合谁</dt><dd>{product.audience || '以企业资料为准'}</dd></div></dl>
            <RouterLink to={paths.product} className="public-ask-product-link">查看完整产品页 <span aria-hidden="true">↗</span></RouterLink>
          </aside>
          <div className="public-ask-right">
            <section className="public-ask-main" aria-labelledby="ask-title">
              <div className="public-ask-heading"><span className="public-kicker">PRODUCT KNOWLEDGE / 02</span><h1 id="ask-title">看懂价值后，<br />再向资料提问。</h1><p>回答只依据企业确认的产品资料。点击引用即可核对原文。</p></div>
              <button type="button" className="mobile-source-trigger" onClick={() => setSourcesOpen(true)}><FileTextOutlined /><span><strong>已确认资料</strong><small>{product.knowledgeFiles?.length || 0} 份可检索来源</small></span><span className="mobile-source-open">查看</span></button>
              {messages.length === 0 && <div className="public-ask-prompts" aria-label="推荐问题"><span>可以从这里开始</span>{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => ask(null, prompt)}>{prompt}<span aria-hidden="true">↗</span></button>)}</div>}
              <div className="public-ask-messages" aria-live="polite" aria-busy={asking}>
                {messages.map((message, index) => <article key={`${message.role}-${index}`} className={`public-ask-message public-ask-message-${message.role}`}><span>{message.role === 'user' ? '你的问题' : message.role === 'error' ? '服务状态' : '资料回答'}</span><p>{message.role === 'assistant' ? <CitedAnswer answer={message.text} citations={message.citations || []} onOpen={setCitation} /> : message.text}</p>{message.insufficientEvidence && <small>当前资料无法确认更多信息，请联系企业核实。</small>}</article>)}
                {asking && <div className="public-ask-loading" role="status"><i /><i /><i /><span>正在检索已确认资料</span></div>}
              </div>
              <form className="public-ask-composer" onSubmit={ask}><label htmlFor="product-question">向产品资料提问</label><div><input id="product-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="输入你想了解的问题" maxLength={500} disabled={asking} autoComplete="off" /><button type="submit" disabled={asking || !question.trim()} aria-label="发送问题"><SendOutlined /></button></div><small>回答仅供了解产品，参数和合作条件请以企业确认为准。</small></form>
            </section>
            <aside className="public-ask-aside" aria-label="资料和联系入口">
              <div className="public-ask-source-head"><FileTextOutlined /><span>已确认资料</span><strong>{product.knowledgeFiles?.length || 0}</strong></div>
              {product.knowledgeFiles?.length ? <ul>{product.knowledgeFiles.map((file) => <li key={file.id || file.url}><FileTextOutlined /><span><strong>{file.name}</strong><small>{file.locator || file.statusLabel || '公开资料'}</small></span>{file.url && <a href={file.url} target="_blank" rel="noreferrer" aria-label={`打开${file.name}`}>↗</a>}</li>)}</ul> : <p className="public-ask-no-sources">企业还没有发布可检索的资料。可以提问以查看服务状态，或联系企业获取信息。</p>}
              <button type="button" className="public-ask-contact" onClick={() => setLeadOpen(true)}>向企业咨询 <span aria-hidden="true">↗</span></button>
            </aside>
          </div>
        </div>}
      </div>
      {product && <PublicLeadPopup open={leadOpen} onClose={() => setLeadOpen(false)} brandSlug={brandSlug} productSlug={product.slug} source={source} />}
      <Popup visible={Boolean(citation)} onMaskClick={() => setCitation(null)} onClose={() => setCitation(null)} position="bottom" bodyClassName="public-popup-body"><div className="public-popup-content public-citation-content"><header className="public-popup-head"><div><span className="public-kicker">SOURCE / 引用</span><h2>引用来源</h2></div><button type="button" className="public-icon-button" aria-label="关闭引用" onClick={() => setCitation(null)}><CloseOutlined /></button></header>{citation && <div className="public-citation-detail"><h3>{citation.title || '产品资料'}</h3><span>{citation.locator || '来源定位未提供'}</span><blockquote>{citation.snippet || '未返回命中片段。'}</blockquote>{citation.url && <a href={citation.url} target="_blank" rel="noreferrer">打开原文件 ↗</a>}</div>}</div></Popup>
      <Popup visible={sourcesOpen} onMaskClick={() => setSourcesOpen(false)} onClose={() => setSourcesOpen(false)} position="bottom" bodyClassName="public-popup-body"><div className="public-popup-content"><header className="public-popup-head"><div><span className="public-kicker">PRODUCT SOURCES</span><h2>已确认资料</h2></div><button type="button" className="public-icon-button" aria-label="关闭资料" onClick={() => setSourcesOpen(false)}><CloseOutlined /></button></header>{product?.knowledgeFiles?.length ? <ul className="mobile-source-list">{product.knowledgeFiles.map((file) => <li key={file.id || file.url}><FileTextOutlined /><span><strong>{file.name}</strong><small>{file.locator || file.statusLabel || '公开资料'}</small></span>{file.url && <a href={file.url} target="_blank" rel="noreferrer" aria-label={`打开${file.name}`}>↗</a>}</li>)}</ul> : <p className="public-ask-no-sources">企业还没有发布可检索的资料。可以提问以查看服务状态，或联系企业获取信息。</p>}<button type="button" className="public-ask-contact" onClick={() => { setSourcesOpen(false); setLeadOpen(true) }}>向企业咨询 <span aria-hidden="true">↗</span></button></div></Popup>
    </div>
  </PublicShell>
}
