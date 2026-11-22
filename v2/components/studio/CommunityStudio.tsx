'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'

type Template = { id: string; owner_id: string; title: string; description: string; category: string; prompt: string; status: 'pending' | 'approved' | 'rejected'; created_at: string; updated_at: string }

const CATEGORIES = ['Tümü', 'Web tasarım', 'Yazılım', 'Marka', 'Araştırma', 'İçerik', 'Video', 'Ses', 'Tasarım', 'Diğer']

export default function CommunityStudio({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Tümü')
  const [tab, setTab] = useState<'discover' | 'submit' | 'moderate'>('discover')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [prompt, setPrompt] = useState('')
  const [submitCategory, setSubmitCategory] = useState('Yazılım')
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)
  const [notice, setNotice] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const response = await fetch('/api/community/templates', { cache: 'no-store' })
      const payload = await response.json()
      setTemplates(Array.isArray(payload.templates) ? payload.templates : [])
      setAvailable(payload.available !== false)
      if (payload.message) setNotice(payload.message)
    } catch {
      setAvailable(false)
      setNotice('Topluluk alanına şu anda ulaşılamıyor.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void refresh() }, [userId])

  const visible = useMemo(() => templates.filter(item =>
    (isAdmin || item.status === 'approved' || item.owner_id === userId) &&
    (category === 'Tümü' || item.category === category) &&
    (item.title + ' ' + item.description + ' ' + item.prompt).toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))
  ), [templates, category, query, userId, isAdmin])
  const pending = templates.filter(item => item.status === 'pending')

  async function submit() {
    setNotice('')
    const response = await fetch('/api/community/templates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, category: submitCategory, prompt })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setNotice(payload.error || 'Şablon gönderilemedi.'); return }
    setTitle(''); setDescription(''); setPrompt('')
    setNotice('Şablonun moderasyon kuyruğuna gönderildi.')
    setTab('discover'); await refresh()
  }

  async function moderate(id: string, status: 'approved' | 'rejected') {
    const response = await fetch('/api/community/templates/moderate', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) { setNotice(payload.error || 'Moderasyon işlemi başarısız.'); return }
    setNotice(status === 'approved' ? 'Şablon yayınlandı.' : 'Şablon reddedildi.')
    await refresh()
  }

  async function copy(item: Template) {
    try { await navigator.clipboard.writeText(item.prompt); setNotice(item.title + ' panoya kopyalandı.') }
    catch { setNotice('Panoya kopyalanamadı.') }
  }

  return <main className="pf-community-studio mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 md:px-8 md:py-8">
    <header className="pf-community-hero"><div><span><Icon name="users" className="h-4 w-4" /> CREATOR COMMUNITY</span><h1>Community Marketplace</h1><p>Topluluk tarafından paylaşılan prompt şablonlarını keşfet. Kendi şablonunu gönder; yayınlanmadan önce moderasyondan geçsin.</p></div><strong>{templates.filter(item => item.status === 'approved').length}<small>yayındaki şablon</small></strong></header>
    <nav className="pf-community-tabs"><button type="button" aria-pressed={tab === 'discover'} onClick={() => setTab('discover')}>Keşfet</button><button type="button" aria-pressed={tab === 'submit'} onClick={() => setTab('submit')}>Şablon gönder</button>{isAdmin && <button type="button" aria-pressed={tab === 'moderate'} onClick={() => setTab('moderate')}>Moderasyon ({pending.length})</button>}</nav>
    {notice && <p role="status" className="pf-community-notice">{notice}</p>}
    {!available && <div className="pf-community-setup"><Icon name="info" className="h-5 w-5" /><div><strong>Topluluk veritabanı henüz etkin değil</strong><p>V2 Supabase projesinde community_templates migration dosyası uygulanınca gönderi ve moderasyon akışı açılacak. Hazır Prompt Library şu anda kullanılabilir.</p></div></div>}
    {tab === 'discover' && <><div className="pf-community-controls"><label><Icon name="search" className="h-4 w-4" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Topluluk şablonlarında ara..." /></label><div>{CATEGORIES.map(item => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>{loading ? <p className="text-xs text-muted">Şablonlar yükleniyor…</p> : visible.length ? <div className="pf-community-grid">{visible.map(item => <article key={item.id} className="pf-community-card"><div><span>{item.category}</span>{item.status !== 'approved' && <small>{item.status === 'pending' ? 'Onay bekliyor' : 'Reddedildi'}</small>}</div><h2>{item.title}</h2><p>{item.description}</p><pre>{item.prompt}</pre><footer><button type="button" onClick={() => void copy(item)}><Icon name="copy" className="h-3.5 w-3.5" /> Promptu kopyala</button></footer></article>)}</div> : <div className="pf-community-empty"><Icon name="users" className="h-7 w-7" /><strong>Henüz topluluk şablonu yok</strong><p>İlk şablonları sen gönderebilirsin. Yayın öncesi moderasyon uygulanır.</p></div>}</>}
    {tab === 'submit' && <section className="pf-community-form"><div><span>COMMUNITY CONTRIBUTION</span><h2>Şablonunu paylaş</h2><p>Yalnızca kendi oluşturduğun, özgün ve başkalarına faydalı promptları gönder.</p></div><label>Başlık<input value={title} onChange={event => setTitle(event.target.value)} maxLength={80} placeholder="Örn. SaaS landing page tasarımcısı" /></label><label>Kategori<select value={submitCategory} onChange={event => setSubmitCategory(event.target.value)}>{CATEGORIES.filter(item => item !== 'Tümü').map(item => <option key={item}>{item}</option>)}</select></label><label>Kısa açıklama<input value={description} onChange={event => setDescription(event.target.value)} maxLength={300} placeholder="Bu şablon ne işe yarar?" /></label><label>Prompt<textarea value={prompt} onChange={event => setPrompt(event.target.value)} rows={8} maxLength={10000} placeholder="Paylaşmak istediğin özgün prompt..." /></label><button type="button" onClick={() => void submit()} disabled={!title.trim() || prompt.trim().length < 20} className="pf-btn pf-btn-primary"><Icon name="plus" className="h-4 w-4" /> Moderasyona gönder</button><small>Gönderiler otomatik yayınlanmaz. İncelendikten sonra toplulukta görünür.</small></section>}
    {tab === 'moderate' && isAdmin && <section className="pf-community-moderation"><div><span>ADMIN REVIEW</span><h2>Bekleyen gönderiler</h2></div>{pending.length ? pending.map(item => <article key={item.id}><div><strong>{item.title}</strong><small>{item.category} · {item.owner_id}</small></div><p>{item.description}</p><pre>{item.prompt}</pre><footer><button type="button" onClick={() => void moderate(item.id, 'approved')}>Yayınla</button><button type="button" onClick={() => void moderate(item.id, 'rejected')}>Reddet</button></footer></article>) : <p className="text-xs text-muted">Bekleyen gönderi yok.</p>}</section>}
  </main>
}
