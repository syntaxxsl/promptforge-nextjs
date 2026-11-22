'use client'

import { useEffect, useMemo, useState } from 'react'
import Icon from '@/components/Icon'
import { useCloudCollection } from '@/lib/studio/use-cloud-collection'
import { createId, nowIso, readCollection } from '@/lib/studio/store'

type MemoryItem = {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

const CATEGORIES = ['Proje bağlamı', 'Yazım tercihi', 'Çalışma kuralı', 'Fikir', 'Diğer']

export default function MemoryStudio({ userId }: { userId: string }) {
  const [items, setItems] = useState<MemoryItem[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [tags, setTags] = useState('')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState('')
  const { ready } = useCloudCollection({
    userId, collection: 'memories', records: items, setRecords: setItems,
    sort: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
    onUnavailable: () => setNotice('Bulut eşitlemesi kullanılamıyor; kayıtların bu cihazda korunuyor.')
  })

  useEffect(() => { setItems(readCollection<MemoryItem>(userId, 'memories')) }, [userId])

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return items.filter(item => !term || (item.title + ' ' + item.content + ' ' + item.category + ' ' + item.tags.join(' ')).toLocaleLowerCase('tr').includes(term))
  }, [items, query])

  function addMemory() {
    if (!title.trim() || !content.trim()) {
      setNotice('Başlık ve içerik gerekli.')
      return
    }
    const timestamp = nowIso()
    const item: MemoryItem = {
      id: createId('memory'), title: title.trim().slice(0, 120),
      content: content.trim().slice(0, 4000), category,
      tags: tags.split(',').map(tag => tag.trim()).filter(Boolean).slice(0, 12),
      createdAt: timestamp, updatedAt: timestamp
    }
    setItems(current => [item, ...current])
    setTitle(''); setContent(''); setTags('')
    setNotice('Hafıza kaydı eklendi. AI Chat yeni mesajlarda bu kayıtları bağlam olarak kullanabilir.')
  }

  function removeMemory(id: string) {
    setItems(current => current.filter(item => item.id !== id))
    setNotice('Kayıt silindi.')
  }

  async function copyMemory(item: MemoryItem) {
    try {
      await navigator.clipboard.writeText(item.title + '\n' + item.content)
      setCopied(item.id)
      setNotice('Kayıt panoya kopyalandı.')
    } catch {
      setNotice('Panoya kopyalanamadı.')
    }
  }

  return <main className="pf-memory-studio mx-auto w-full max-w-[1450px] space-y-5 px-4 py-5 md:px-8 md:py-8">
    <header className="pf-memory-hero"><div><span><Icon name="sparkles" className="h-4 w-4" /> PERSONAL CONTEXT</span><h1>AI Memory</h1><p>Projelerin, tercihlerin ve çalışma kuralların için kendi bilgi hafızanı oluştur. Kayıtlar hesap bazında saklanır.</p></div><div className="pf-memory-count"><strong>{items.length}</strong><small>kayıtlı hafıza</small></div></header>
    <div className="grid gap-4 xl:grid-cols-[.78fr_1.22fr]">
      <section className="pf-memory-panel">
        <div className="pf-memory-head"><span>01 / YENİ KAYIT</span><h2>Hafızaya ekle</h2><p>Yalnızca ileride tekrar kullanmak istediğin, hassas olmayan proje ve çalışma bilgilerini kaydet.</p></div>
        <label>Başlık<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} placeholder="Örn. PromptForge tasarım dili" /></label>
        <label>Kategori<select value={category} onChange={event => setCategory(event.target.value)}>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>İçerik<textarea value={content} onChange={event => setContent(event.target.value)} rows={6} maxLength={4000} placeholder="Bu bilgiyi gelecekteki sohbetlerde nasıl kullanmalıyım?" /></label>
        <label>Etiketler<input value={tags} onChange={event => setTags(event.target.value)} placeholder="promptforge, tasarım, kod (virgülle ayır)" /></label>
        <button type="button" onClick={addMemory} className="pf-btn pf-btn-primary w-full justify-center"><Icon name="plus" className="h-4 w-4" /> Hafızaya kaydet</button>
        {notice && <p role="status" className="pf-memory-notice">{notice}</p>}
        <p className="pf-memory-sync"><i />{ready ? 'Yerel kayıt ve bulut eşitleme hazır' : 'Kayıt alanı hazırlanıyor…'}</p>
      </section>
      <section className="pf-memory-panel">
        <div className="pf-memory-head"><span>02 / KİŞİSEL BİLGİ TABANI</span><h2>Kayıtların</h2><p>AI Chat, bu hafıza kayıtlarını yanıtlarına bağlam olarak ekler.</p></div>
        <div className="pf-memory-search"><Icon name="search" className="h-4 w-4" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Hafızada ara..." /></div>
        {filtered.length ? <div className="pf-memory-list">{filtered.map(item => <article key={item.id} className="pf-memory-item"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span>{item.category}</span><h3>{item.title}</h3></div><button type="button" onClick={() => removeMemory(item.id)} aria-label={item.title + ' kaydını sil'}><Icon name="trash" className="h-4 w-4" /></button></div><p>{item.content}</p>{item.tags.length > 0 && <div className="pf-memory-tags">{item.tags.map(tag => <span key={tag}>{tag}</span>)}</div>}<button type="button" onClick={() => void copyMemory(item)} className="pf-memory-copy"><Icon name="copy" className="h-3.5 w-3.5" />{copied === item.id ? 'Kopyalandı' : 'Kopyala'}</button></article>)}</div> : <div className="pf-memory-empty"><Icon name="sparkles" className="h-7 w-7" /><strong>{query ? 'Eşleşen kayıt yok' : 'Henüz hafıza kaydı yok'}</strong><p>{query ? 'Başka bir arama dene.' : 'İlk kaydını oluşturarak kişisel bilgi alanını başlat.'}</p></div>}
      </section>
    </div>
  </main>
}
