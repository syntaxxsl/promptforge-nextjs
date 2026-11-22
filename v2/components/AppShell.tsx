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
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

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
    })
  }, [])

  // Privacy-first telemetry: route only; never send prompts, query strings, or generated content.
  useEffect(() => {
    if (!pathname || pathname.startsWith('/api/')) return
    fetch('/api/monitor/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'page_view', route: pathname }),
      keepalive: true
    }).catch(() => {})
  }, [pathname])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem('pf-v2-nav-collapsed', next ? '1' : '0')
      return next
    })
  }

  function toggleTheme() {
    setTheme((prev) => {
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

  const sidebarWidth = collapsed ? 'w-16' : 'w-64'

  return (
    <div className="min-h-screen flex">
      {/* Mobile overlay */}
      {navOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${sidebarWidth} ${navOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 bg-surface border-r border-border transition-transform duration-200 flex flex-col`}
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-border">
          {!collapsed && <span className="font-semibold text-primary">PromptForge 2.0</span>}
          <button onClick={toggleCollapsed} className="pf-btn pf-btn-ghost p-1.5" aria-label="Menüyü daralt/genişlet">
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto pf-scroll px-2 py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.title}>
              {!collapsed && (
                <div className="px-2 mb-1 text-xs uppercase tracking-wide text-muted">{group.title}</div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setNavOpen(false)}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors ${
                        isActive(item.href)
                          ? 'bg-surface-2 text-primary'
                          : 'text-fg hover:bg-surface-2'
                      } ${item.soon ? 'opacity-50' : ''}`}
                    >
                      <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.soon && (
                        <span className="ml-auto text-[10px] text-muted">yakında</span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="p-2 border-t border-border space-y-1">
          <button onClick={toggleTheme} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-fg hover:bg-surface-2">
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
            {!collapsed && <span>{theme === 'dark' ? 'Açık tema' : 'Koyu tema'}</span>}
          </button>
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-fg hover:bg-surface-2">
            <Icon name="logout" className="h-4 w-4" />
            {!collapsed && <span>Çıkış</span>}
          </button>
          {!collapsed && email && <div className="px-2 pt-1 text-xs text-muted truncate">{email}</div>}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 md:hidden flex items-center px-4 border-b border-border bg-surface">
          <button onClick={() => setNavOpen(true)} className="pf-btn pf-btn-ghost p-1.5" aria-label="Menüyü aç">
            <Icon name="menu" />
          </button>
          <span className="ml-3 font-semibold text-primary">PromptForge 2.0</span>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}