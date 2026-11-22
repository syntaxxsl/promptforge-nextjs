'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { NAV_GROUPS } from '@/lib/nav'

export default function DashboardStudio() {
  const [query, setQuery] = useState('')
  const tools = useMemo(() => NAV_GROUPS.flatMap(group =>
    group.items.map(item => ({ ...item, group: group.title }))
  ), [])
  const filtered = tools.filter(item =>
    (item.label + ' ' + item.group).toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr'))
  )
  const featured = [
    { label: 'AI Chat', description: 'Modellerle sohbet et ve fikirlerini geliştir.', href: '/chat', icon: 'message' as const },
    { label: 'Website Builder', description: 'Web sitesi arayüzü ve kod taslakları oluştur.', href: '/website-builder', icon: 'code' as const },
    { label: 'Image Studio', description: 'Görsel fikirlerini üretim brieflerine dönüştür.', href: '/image', icon: 'image' as const },
    { label: 'Code Studio', description: 'Kod yaz, düzenle ve projelerini yönet.', href: '/code', icon: 'terminal' as const }
  ]
  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-8 p-4 md:p-7">
      <header className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 md:p-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-accent">
            <Icon name="sparkles" className="h-4 w-4" /> PromptForge 2.0
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-fg md:text-4xl">Çalışma alanın hazır.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">Yaz, tasarla, araştır, geliştir. İhtiyacın olan yapay zekâ araçlarını tek bir çalışma alanından aç.</p>
          <label className="mt-6 flex max-w-xl items-center gap-3 rounded-xl border border-border bg-background px-4 py-3">
            <Icon name="search" className="h-4 w-4 shrink-0 text-muted" />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Araç veya kategori ara..." className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
            <span className="text-xs tabular-nums text-muted">{filtered.length}</span>
          </label>
        </div>
      </header>

      {!query && <section className="space-y-3">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-fg">Hızlı erişim</h2><p className="mt-1 text-xs text-muted">Sık kullanılan çalışma alanları</p></div><span className="text-xs text-muted">4 kısayol</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map(item => <Link key={item.href} href={item.href} className="group rounded-2xl border border-border bg-surface p-4 transition hover:border-accent/40 hover:bg-accent/5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent"><Icon name={item.icon} className="h-5 w-5" /></div>
            <h3 className="mt-4 text-sm font-semibold text-fg">{item.label}</h3>
            <p className="mt-1 text-xs leading-5 text-muted">{item.description}</p>
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-accent">Çalışma alanını aç <Icon name="arrow-right" className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></div>
          </Link>)}
        </div>
      </section>}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-semibold text-fg">{query ? 'Arama sonuçları' : 'Tüm araçlar'}</h2><p className="mt-1 text-xs text-muted">{filtered.length} çalışma alanı listeleniyor</p></div></div>
        {filtered.length === 0 ? <div className="rounded-2xl border border-border bg-surface p-10 text-center"><Icon name="search" className="mx-auto h-6 w-6 text-muted" /><p className="mt-3 text-sm text-fg">Eşleşen araç bulunamadı.</p><p className="mt-1 text-xs text-muted">Farklı bir kelime deneyebilirsin.</p></div> :
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {(query ? [{ title: 'Sonuçlar', items: filtered }] : NAV_GROUPS).map(group => {
              const items = query ? group.items : group.items
              if (!items.length) return null
              return <section key={group.title} className="rounded-2xl border border-border bg-surface p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-[.14em] text-muted">{group.title}</h3>
                <div className="grid grid-cols-1 gap-1">
                  {items.map(item => <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg transition hover:bg-background">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-muted"><Icon name={item.icon} className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <Icon name="arrow-up-right" className="h-3.5 w-3.5 text-muted" />
                  </Link>)}
                </div>
              </section>
            })}
          </div>}
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
        <span>PromptForge 2.0 · Modüler AI çalışma alanı</span>
        <div className="flex gap-4"><Link href="/projects" className="hover:text-fg">Projelerim</Link><Link href="/files" className="hover:text-fg">Dosyalarım</Link><Link href="/settings" className="hover:text-fg">Ayarlar</Link></div>
      </footer>
    </main>
  )
}
