'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { NAV_GROUPS } from '@/lib/nav'

const featured = [
  { label: 'AI Chat', description: 'Fikirlerini konuşarak geliştir, içerik üret ve cevaplar al.', href: '/chat', icon: 'message' as const, tone: 'violet' },
  { label: 'Website Builder', description: 'Web deneyimleri tasarla ve kod çalışmalarına başla.', href: '/website-builder', icon: 'code' as const, tone: 'blue' },
  { label: 'Image Studio', description: 'Görsel üretim fikirlerini yaratıcı brief’lere dönüştür.', href: '/image', icon: 'image' as const, tone: 'pink' },
  { label: 'Code Studio', description: 'Kodlarını yaz, incele ve geliştirme akışını sürdür.', href: '/code', icon: 'terminal' as const, tone: 'green' }
]

export default function DashboardStudio() {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => NAV_GROUPS.filter(group => group.title !== 'Yönetim'), [])
  const tools = useMemo(() => groups.flatMap(group => group.items.map(item => ({ ...item, group: group.title }))), [groups])
  const filtered = tools.filter(item => (item.label + ' ' + item.group).toLocaleLowerCase('tr').includes(query.toLocaleLowerCase('tr')))

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-9 px-4 py-6 md:px-8 md:py-9">
      <section className="pf-hero relative overflow-hidden rounded-[28px] border border-border px-6 py-8 md:px-10 md:py-11">
        <div className="pf-hero-orb pf-hero-orb-one" /><div className="pf-hero-orb pf-hero-orb-two" />
        <div className="relative z-10 max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-accent"><Icon name="sparkles" className="h-3.5 w-3.5" /> Your creative AI workspace</div>
          <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-[-.04em] text-fg md:text-[46px]">Fikrini al. <span className="pf-gradient-text">Üretime dönüştür.</span></h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted md:text-[15px]">Yazma, tasarlama, araştırma ve geliştirme araçların tek bir çalışma alanında. Bugün ne oluşturmak istiyorsun?</p>
          <label className="pf-search mt-7 flex max-w-[580px] items-center gap-3 rounded-2xl px-4 py-3.5">
            <Icon name="search" className="h-[18px] w-[18px] shrink-0 text-muted" /><input aria-label="Çalışma alanlarında ara" value={query} onChange={event => setQuery(event.target.value)} placeholder="Bir araç ara... ör. görsel, kod, araştırma" className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted" />
            <kbd className="hidden rounded-md border border-border bg-surface px-2 py-1 text-[10px] text-muted sm:inline">ARA</kbd>{query && <button type="button" onClick={() => setQuery('')} className="text-xs text-muted hover:text-fg">Temizle</button>}
          </label>
        </div>
        <div className="pointer-events-none absolute bottom-7 right-8 hidden items-center gap-3 opacity-70 xl:flex"><div className="pf-hero-orbit"><Icon name="sparkles" className="h-7 w-7" /></div><div className="space-y-2"><div className="h-2 w-24 rounded-full bg-accent/30" /><div className="h-2 w-16 rounded-full bg-fg/10" /><div className="h-2 w-20 rounded-full bg-fg/10" /></div></div>
      </section>
      {!query && <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="pf-eyebrow">Hızlı başlangıç</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">Nereden başlayalım?</h2></div><span className="text-xs text-muted">Öne çıkan çalışma alanları</span></div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">{featured.map(item => <Link key={item.href} href={item.href} className={`pf-feature-card group tone-${item.tone}`}>
          <div className="flex items-start justify-between"><span className="pf-feature-icon"><Icon name={item.icon} className="h-5 w-5" /></span><Icon name="arrowRight" className="h-4 w-4 text-muted transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-fg" /></div>
          <h3 className="mt-5 text-[15px] font-semibold text-fg">{item.label}</h3><p className="mt-2 min-h-[42px] text-xs leading-5 text-muted">{item.description}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-fg">Çalışma alanını aç <Icon name="arrowRight" className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
        </Link>)}</div>
      </section>}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="pf-eyebrow">{query ? 'Arama' : 'Keşfet'}</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">{query ? 'Arama sonuçları' : 'Tüm çalışma alanları'}</h2><p className="mt-1 text-xs text-muted">{query ? filtered.length : tools.length} araç ve çalışma alanı</p></div><div className="pf-chip"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Workspace hazır</div></div>
        {query ? (filtered.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(item => <Link key={item.href} href={item.href} className="pf-tool-row"><span className="pf-tool-icon"><Icon name={item.icon} className="h-[18px] w-[18px]" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-fg">{item.label}</span><span className="mt-0.5 block text-[11px] text-muted">{item.group}</span></span><Icon name="arrowRight" className="h-4 w-4 text-muted" /></Link>)}</div> : <div className="pf-empty"><Icon name="search" className="mx-auto h-6 w-6 text-muted" /><p className="mt-3 text-sm font-semibold text-fg">Eşleşen araç bulunamadı</p><p className="mt-1 text-xs text-muted">Başka bir kelime deneyebilirsin.</p></div>) : <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map(group => <section key={group.title} className="pf-category-card"><div className="mb-3 flex items-center justify-between"><h3 className="text-[11px] font-bold uppercase tracking-[.18em] text-muted">{group.title}</h3><span className="text-[10px] tabular-nums text-muted">{group.items.length} araç</span></div><div className="space-y-1">{group.items.map(item => <Link key={item.href} href={item.href} className="pf-tool-row"><span className="pf-tool-icon"><Icon name={item.icon} className="h-[17px] w-[17px]" /></span><span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{item.label}</span>{item.soon && <span className="pf-soon">Yakında</span>}<Icon name="arrowRight" className="h-3.5 w-3.5 text-muted opacity-0 transition group-hover:opacity-100" /></Link>)}</div></section>)}
        </div>}
      </section>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-5 text-[11px] text-muted"><span>PromptForge · Creative AI Workspace</span><div className="flex gap-5"><Link href="/projects" className="hover:text-fg">Projelerim</Link><Link href="/files" className="hover:text-fg">Dosyalarım</Link><Link href="/settings" className="hover:text-fg">Ayarlar</Link></div></footer>
    </div>
  )
}
