'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import Icon from '@/components/Icon'
import { NAV_GROUPS } from '@/lib/nav'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')

  useEffect(() => {
    if (window.localStorage.getItem('pf-v2-nav-collapsed') === '1') setCollapsed(true)
    const savedTheme = window.localStorage.getItem('pf-v2-theme') as 'dark' | 'light' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email || '')
      setIsAdmin(data.user?.app_metadata?.role === 'admin')
    })
  }, [])

  useEffect(() => {
    if (!pathname || pathname.startsWith('/api/')) return
    fetch('/api/monitor/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'page_view', route: pathname }),
      keepalive: true
    }).catch(() => {})
  }, [pathname])

  useEffect(() => { setNavOpen(false); setCommandOpen(false) }, [pathname])

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(true)
      }
      if (event.key === 'Escape') setCommandOpen(false)
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev
      window.localStorage.setItem('pf-v2-nav-collapsed', next ? '1' : '0')
      return next
    })
  }

  function toggleTheme() {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      window.localStorage.setItem('pf-v2-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      return next
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const pageLabel = NAV_GROUPS.flatMap(group => group.items).find(item => isActive(item.href))?.label || 'Çalışma Alanı'
  const commandItems = NAV_GROUPS.filter(group => group.title !== 'Yönetim' || isAdmin).flatMap(group => group.items.map(item => ({ ...item, group: group.title })))
  const filteredCommands = commandItems.filter(item => (item.label + ' ' + item.group).toLocaleLowerCase('tr').includes(commandQuery.toLocaleLowerCase('tr')))
  const sidebarWidth = collapsed ? 'md:w-[76px]' : 'md:w-[264px]'

  return (
    <div className="pf-app min-h-screen">
      {navOpen && <button aria-label="Menüyü kapat" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setNavOpen(false)} />}
      <aside className={`pf-sidebar fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col border-r border-border transition-all duration-300 ${sidebarWidth} ${navOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className={`flex h-[76px] shrink-0 items-center border-b border-border ${collapsed ? 'justify-center px-2' : 'justify-between px-5'}`}>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
            <span className="pf-brand-mark"><Icon name="sparkles" className="h-5 w-5" /></span>
            {!collapsed && <span className="min-w-0"><span className="block text-[15px] font-bold tracking-tight text-fg">PromptForge</span><span className="block text-[10px] font-semibold uppercase tracking-[.2em] text-muted">AI Workspace</span></span>}
          </Link>
          {!collapsed && <button onClick={toggleCollapsed} className="pf-icon-btn hidden md:inline-flex" aria-label="Menüyü daralt"><Icon name="chevronLeft" className="h-4 w-4" /></button>}
          {collapsed && <button onClick={toggleCollapsed} className="pf-icon-btn hidden md:inline-flex" aria-label="Menüyü genişlet"><Icon name="chevronRight" className="h-4 w-4" /></button>}
          <button onClick={() => setNavOpen(false)} className="pf-icon-btn md:hidden" aria-label="Menüyü kapat"><Icon name="chevronLeft" className="h-4 w-4" /></button>
        </div>
        <div className={`px-3 pt-5 ${collapsed ? 'md:px-2' : ''}`}>
          <Link href="/dashboard" className={`pf-sidebar-home ${isActive('/dashboard') ? 'is-active' : ''} ${collapsed ? 'md:justify-center md:px-0' : ''}`}>
            <Icon name="overview" className="h-[18px] w-[18px] shrink-0" />{!collapsed && <><span>Genel Bakış</span><span className="ml-auto text-[10px] text-muted">⌘ 1</span></>}
          </Link>
        </div>
        <nav className="pf-scroll min-h-0 flex-1 space-y-6 overflow-y-auto px-3 py-5">
          {NAV_GROUPS.filter(group => group.title !== 'Genel' && (group.title !== 'Yönetim' || isAdmin)).map(group => (
            <section key={group.title}>
              {!collapsed && <h2 className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-muted/80">{group.title}</h2>}
              <ul className="space-y-1">{group.items.map(item => (
                <li key={item.href}><Link href={item.href} title={collapsed ? item.label : undefined} className={`pf-nav-link ${isActive(item.href) ? 'is-active' : ''} ${collapsed ? 'md:justify-center md:px-0' : ''} ${item.soon ? 'opacity-50' : ''}`}>
                  <Icon name={item.icon} className="h-[17px] w-[17px] shrink-0" />{!collapsed && <><span className="min-w-0 flex-1 truncate">{item.label}</span>{item.soon && <span className="pf-soon">Yakında</span>}{item.badge && <span className="pf-nav-badge">{item.badge}</span>}</>}
                </Link></li>
              ))}</ul>
            </section>
          ))}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <div className={`mb-2 flex items-center gap-2 rounded-xl bg-surface-2/70 p-2.5 ${collapsed ? 'md:justify-center md:px-1' : ''}`}>
            <span className="pf-avatar"><Icon name="user" className="h-4 w-4" /></span>
            {!collapsed && <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-fg">{email || 'Hesabım'}</span><span className="block text-[10px] text-muted">{isAdmin ? 'Yönetici' : 'PromptForge üyesi'}</span></span>}
          </div>
          <div className={`grid ${collapsed ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
            <button onClick={toggleTheme} className="pf-bottom-action" title="Temayı değiştir"><Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />{!collapsed && <span>{theme === 'dark' ? 'Açık tema' : 'Koyu tema'}</span>}</button>
            <button onClick={logout} className="pf-bottom-action" title="Çıkış yap"><Icon name="logout" className="h-4 w-4" />{!collapsed && <span>Çıkış</span>}</button>
          </div>
        </div>
      </aside>
      <div className={`min-h-screen min-w-0 transition-[padding] duration-300 ${collapsed ? 'md:pl-[76px]' : 'md:pl-[264px]'}`}>
        <header className="pf-topbar sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-border px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setNavOpen(true)} className="pf-icon-btn md:hidden" aria-label="Menüyü aç"><Icon name="menu" className="h-5 w-5" /></button>
            <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted">PromptForge / Workspace</div><div className="truncate text-sm font-semibold text-fg">{pageLabel}</div></div>
          </div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => { setCommandQuery(""); setCommandOpen(true) }} className="pf-command-trigger"><Icon name="search" className="h-4 w-4" /><span className="hidden sm:inline">Araç ve sayfa ara</span><kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[9px] text-muted sm:inline">⌘ K</kbd></button><Link href="/projects" className="pf-top-action hidden lg:inline-flex"><Icon name="folder" className="h-4 w-4" /> Projeler</Link><Link href="/settings" className="pf-icon-btn" aria-label="Ayarlar"><Icon name="settings" className="h-[18px] w-[18px]" /></Link><span className="hidden h-8 w-px bg-border sm:block" /><span className="pf-avatar hidden sm:flex"><Icon name="user" className="h-4 w-4" /></span></div>
        </header>
        <main className="pf-main min-h-[calc(100vh-76px)]">{children}</main>
      </div>
      {commandOpen && <div className="pf-command-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCommandOpen(false) }}>
        <section className="pf-command-panel" role="dialog" aria-modal="true" aria-label="PromptForge hızlı arama">
          <div className="pf-command-search"><Icon name="search" className="h-5 w-5 text-muted" /><input autoFocus value={commandQuery} onChange={event => setCommandQuery(event.target.value)} placeholder="Bir araç, sayfa veya özellik ara..." aria-label="Araç ve sayfa ara" /><kbd>ESC</kbd></div>
          <div className="pf-command-meta"><span>ÇALIŞMA ALANLARI</span><span>{filteredCommands.length} sonuç</span></div>
          <div className="pf-command-results pf-scroll">
            {filteredCommands.length ? filteredCommands.map(item => <Link key={item.href} href={item.href} onClick={() => setCommandOpen(false)} className="pf-command-result"><span className="pf-tool-icon"><Icon name={item.icon} className="h-4 w-4" /></span><span className="min-w-0 flex-1"><strong>{item.label}</strong><small>{item.group}</small></span><Icon name="arrowRight" className="h-4 w-4 text-muted" /></Link>) : <div className="px-5 py-10 text-center text-sm text-muted">Bu aramayla eşleşen bir çalışma alanı yok.</div>}
          </div>
          <div className="pf-command-footer"><span><kbd>↵</kbd> Sayfayı açmak için seç</span><span><kbd>ESC</kbd> Kapat</span></div>
        </section>
      </div>}
    </div>
  )
}
