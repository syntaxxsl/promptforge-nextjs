'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { NAV_GROUPS } from '@/lib/nav'
import { readCollection } from '@/lib/studio/store'
import { listThreads } from '@/lib/studio/chat-store'

type Result = { id: string; title: string; detail: string; category: string; href: string; searchable: string }
type Tab = 'Tümü' | 'Araçlar' | 'Projeler' | 'Dosyalar' | 'Çıktılar' | 'Sohbetler'

export default function UniversalSearchStudio({ userId }: { userId: string }) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('Tümü')
  const [items, setItems] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const results: Result[] = []
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        results.push({ id: 'tool:' + item.href, title: item.label, detail: group.title + ' · Çalışma alanı', category: 'Araçlar', href: item.href, searchable: item.label + ' ' + group.title })
      }
    }
    const projects = readCollection<Record<string, unknown>>(userId, 'projects')
    for (const project of projects) {
      const title = String(project.name || 'İsimsiz proje')
      results.push({ id: 'project:' + String(project.id), title, detail: String(project.description || 'Proje çalışma alanı'), category: 'Projeler', href: '/projects', searchable: title + ' ' + String(project.description || '') })
    }
    const files = readCollection<Record<string, unknown>>(userId, 'project-files')
    for (const file of files) {
      const title = String(file.name || 'Dosya')
      const content = String(file.content || '')
      results.push({ id: 'file:' + String(file.id), title, detail: content.slice(0, 150) || 'Proje dosyası', category: 'Dosyalar', href: '/projects', searchable: title + ' ' + content })
    }
    const projectOutputs = readCollection<Record<string, unknown>>(userId, 'project-outputs')
    const savedOutputs = readCollection<Record<string, unknown>>(userId, 'studio-outputs')
    for (const output of [...projectOutputs, ...savedOutputs]) {
      const title = String(output.title || 'Kaydedilmiş çıktı')
      const content = String(output.payload || output.content || '')
      results.push({ id: 'output:' + String(output.id), title, detail: String(output.tool || 'AI çıktısı') + ' · ' + content.slice(0, 130), category: 'Çıktılar', href: '/outputs', searchable: title + ' ' + String(output.tool || '') + ' ' + content })
    }
    for (const thread of listThreads(userId)) {
      const excerpt = thread.messages.map(message => message.content).join(' ').slice(0, 180)
      results.push({ id: 'chat:' + thread.id, title: thread.title, detail: excerpt || 'Sohbet geçmişi', category: 'Sohbetler', href: '/history', searchable: thread.title + ' ' + excerpt })
    }
    setItems(results)
    setLoading(false)
  }, [userId])

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase('tr')
    return items.filter(item => (tab === 'Tümü' || item.category === tab) && (!term || (item.title + ' ' + item.detail + ' ' + item.searchable).toLocaleLowerCase('tr').includes(term)))
  }, [items, query, tab])
  const counts = useMemo(() => Object.fromEntries((['Araçlar','Projeler','Dosyalar','Çıktılar','Sohbetler'] as const).map(key => [key, items.filter(item => item.category === key).length])), [items])
  const tabs: Tab[] = ['Tümü','Araçlar','Projeler','Dosyalar','Çıktılar','Sohbetler']

  return <main className="mx-auto w-full max-w-[1250px] space-y-5 p-4 md:p-7">
    <header className="rounded-3xl border border-border bg-surface p-5 md:p-7">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3 py-1.5 text-[10px] font-bold tracking-[.2em] text-accent"><Icon name="search" className="h-3.5 w-3.5"/> WORKSPACE INDEX</div>
      <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">Universal Search</h1>
      <p className="mt-2 text-sm text-muted">Araçları, projeleri, dosyaları, kaydedilmiş çıktıları ve sohbetlerini tek yerden bul.</p>
      <label className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-background px-4 py-3"><Icon name="search" className="h-5 w-5 text-muted"/><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Ne arıyorsun? Örn. web sitesi, analiz, proje..." className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"/></label>
    </header>
    <div className="flex flex-wrap gap-2">{tabs.map(value => <button key={value} type="button" onClick={() => setTab(value)} className={'rounded-full border px-3 py-2 text-xs transition '+(tab===value?'border-accent/40 bg-accent/10 text-fg':'border-border bg-surface text-muted hover:text-fg')}>{value}{value!=='Tümü'&&<span className="ml-1.5 opacity-60">{counts[value]||0}</span>}</button>)}</div>
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-fg">Arama sonuçları</h2><span className="text-xs text-muted">{loading?'Yükleniyor…':filtered.length+' sonuç'}</span></div>
      {filtered.length ? <div className="divide-y divide-border">{filtered.map(item => <Link key={item.id} href={item.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-background"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background"><Icon name={item.category==='Araçlar'?'layers':item.category==='Projeler'?'folder':item.category==='Sohbetler'?'message':item.category==='Çıktılar'?'sparkles':'paperclip'} className="h-4 w-4 text-muted"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium text-fg">{item.title}</strong><small className="mt-0.5 block truncate text-xs text-muted">{item.detail}</small></span><span className="hidden rounded-full border border-border px-2 py-1 text-[10px] text-muted sm:inline">{item.category}</span><Icon name="arrowRight" className="h-4 w-4 text-muted"/></Link>)}</div> : <div className="px-6 py-14 text-center"><Icon name="search" className="mx-auto h-7 w-7 text-muted"/><p className="mt-3 text-sm font-medium text-fg">{loading?'İçerikler yükleniyor…':'Eşleşen sonuç bulunamadı'}</p><p className="mt-1 text-xs text-muted">Arama kelimeni değiştirmeyi veya farklı bir kategori seçmeyi dene.</p></div>}
    </section>
    <p className="text-center text-[11px] text-muted">Arama, bu cihazda bulunan ve daha önce eşitlenmiş çalışma kayıtlarını tarar. Özel dosya içerikleri yalnızca oturum açmış hesabın yerel çalışma alanında aranır.</p>
  </main>
}
