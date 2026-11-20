'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Icon, { type IconName } from './Icon'
import QuickCommand from './QuickCommand'
import { normalizePermissions } from '../../lib/permissions'

type NavItem = {
  icon: IconName
  label: string
  href: string
  soon?: boolean
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    title: 'Genel',
    items: [
      { icon: 'overview', label: 'Panel', href: '/panel' },
      { icon: 'folder', label: 'Projeler', href: '/panel#projeler' },
      { icon: 'activity', label: 'Geçmiş', href: '/activity' },
    ],
  },
  {
    title: 'Asistanlar',
    items: [
      { icon: 'message', label: 'AI Chat', href: '/sohbet' },
      { icon: 'sparkles', label: 'Command Center', href: '/komut' },
      { icon: 'pulse', label: 'AI Arena', href: '/arena', soon: true },
      { icon: 'user', label: 'Asistanım', href: '/asistanim', soon: true },
      { icon: 'users', label: 'AI Teams', href: '/teams', soon: true },
    ],
  },
  {
    title: 'Oluştur',
    items: [
      { icon: 'code', label: 'Website Builder', href: '/dashboard' },
      { icon: 'pen', label: 'AI Writer', href: '/writer' },
      { icon: 'layers', label: 'Sunum', href: '/sunum' },
      { icon: 'map', label: 'Zihin Haritası', href: '/zihin-haritasi' },
    ],
  },
  {
    title: 'Geliştir',
    items: [
      { icon: 'bug', label: 'Code Studio', href: '/critic' },
      { icon: 'vision', label: 'Görselden Kod', href: '/vision' },
    ],
  },
  {
    title: 'Araçlar',
    items: [
      { icon: 'folder', label: 'Belge Analizi', href: '/belge' },
      { icon: 'compass', label: 'Dil Araçları', href: '/dil' },
      { icon: 'pulse', label: 'Test Üretici', href: '/test' },
    ],
  },
  {
    title: 'Yakında',
    items: [{ icon: 'image', label: 'Stüdyolar', href: '/studios' }],
  },
  {
    title: 'Hesap',
    items: [
      { icon: 'settings', label: 'Ayarlar', href: '/settings' },
      { icon: 'user', label: 'Profil', href: '/profile' },
    ],
  },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [navOpen, setNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [canHealth, setCanHealth] = useState(false)

  // Menünün daraltılmış hâli tarayıcıda hatırlanır.
  useEffect(() => {
    if (window.localStorage.getItem('pf-nav-collapsed') === '1') {
      setCollapsed(true)
    }
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      window.localStorage.setItem('pf-nav-collapsed', previous ? '0' : '1')
      return !previous
    })
  }

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data } = await supabase.auth.getUser()

      if (cancelled) return

      if (!data.user) {
        router.replace('/auth')
        return
      }

      setEmail(data.user.email || '')

      const extended = await supabase
        .from('users')
        .select('role, permissions')
        .eq('id', data.user.id)
        .maybeSingle()

      // Yetki kolonu yoksa yalnızca rolü oku.
      const profile = extended.error
        ? (
            await supabase
              .from('users')
              .select('role')
              .eq('id', data.user.id)
              .maybeSingle()
          ).data
        : extended.data

      if (cancelled) return

      const role = String((profile as any)?.role || '').toLowerCase().trim()
      const permissions = normalizePermissions((profile as any)?.permissions)

      setIsAdmin(role === 'admin' || permissions.length > 0)
      setCanHealth(role === 'admin' || permissions.includes('security'))
    }

    load()

    return () => {
      cancelled = true
    }
  }, [router])

  // Sayfa değişince mobil çekmece kapanır.
  useEffect(() => {
    setNavOpen(false)
  }, [pathname])

  // Sunucuya "buradayım" sinyali: canlı aktiflik ve sayfa görüntüleme sayacı.
  useEffect(() => {
    const ping = async (event: 'view' | 'ping' | 'logout') => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token

        if (!token) return

        await fetch('/api/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event, path: pathname }),
          keepalive: event === 'logout',
        })
      } catch {
        // Takip hatası kullanıcıyı etkilemez, sessizce geçilir.
      }
    }

    ping('view')

    const interval = window.setInterval(() => ping('ping'), 60_000)

    return () => window.clearInterval(interval)
  }, [pathname])

  const logout = async () => {
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token

      if (token) {
        fetch('/api/presence', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ event: 'logout', path: pathname }),
          keepalive: true,
        }).catch(() => {})
      }
    } catch {
      // Çıkışı engelleme.
    }

    await supabase.auth.signOut()
    router.replace('/auth')
  }

  const isActive = (href: string) => {
    // Aynı sayfanın bölüm bağlantısı, sayfa bağlantısını da aktif göstermesin.
    if (href.includes('#')) return false
    return pathname === href
  }

  const adminItems: NavItem[] = [
    { icon: 'terminal', label: 'Admin Paneli', href: '/admin' },
    ...(canHealth
      ? [{ icon: 'pulse' as IconName, label: 'Sistem Sağlığı', href: '/health' }]
      : []),
  ]

  const renderItem = (item: NavItem, isCollapsed: boolean) => {
    const active = isActive(item.href)

    if (item.soon) {
      return (
        <div
          key={item.label}
          title={`${item.label} — yakında`}
          className={`flex cursor-default items-center gap-2.5 rounded-lg py-[7px] text-[13px] font-medium text-[#4e5462] ${
            isCollapsed ? 'justify-center px-0' : 'px-2.5'
          }`}
        >
          <Icon name={item.icon} className="h-[17px] w-[17px] shrink-0" />
          {!isCollapsed && (
            <>
              <span className="truncate">{item.label}</span>
              <span className="ml-auto rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#6f7686] ring-1 ring-[#242a36]">
                yakında
              </span>
            </>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.label}
        href={item.href}
        title={isCollapsed ? item.label : undefined}
        className={`relative flex items-center gap-2.5 rounded-lg py-[7px] text-[13px] font-medium transition-colors ${
          isCollapsed ? 'justify-center px-0' : 'px-2.5'
        } ${
          active
            ? 'bg-[#7c5cff]/12 text-white'
            : 'text-[#8b909d] hover:bg-white/[0.035] hover:text-[#e7e9ee]'
        }`}
      >
        {active && (
          <span className="absolute -left-2 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-[#7c5cff]" />
        )}
        <Icon
          name={item.icon}
          className={`h-[17px] w-[17px] shrink-0 ${active ? 'text-[#a48bff]' : ''}`}
        />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  const groupLabel = (title: string, isCollapsed: boolean) =>
    isCollapsed ? (
      <div className="mx-2 my-2 h-px bg-[#1b1f28]" />
    ) : (
      <p className="mt-5 mb-1.5 flex items-center gap-2 px-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6573]">
        <span className="h-px w-2.5 bg-[#7c5cff]/60" />
        {title}
      </p>
    )

  const renderSidebar = (isCollapsed: boolean) => (
    <div className="flex h-full flex-col border-r border-[#1b1f28] bg-[#0a0c11] text-[#e7e9ee]">
      <div
        className={`flex shrink-0 items-center ${
          isCollapsed ? 'flex-col gap-2 px-2 py-3' : 'h-16 gap-2.5 px-4'
        }`}
      >
        <Link href="/panel" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#a855f7] text-[13px] font-black text-white">
            P
          </span>
          {!isCollapsed && (
            <span className="text-[15px] font-semibold tracking-tight">
              PromptForge
            </span>
          )}
        </Link>

        <button
          onClick={toggleCollapsed}
          title={isCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          aria-label={isCollapsed ? 'Menüyü genişlet' : 'Menüyü daralt'}
          className={`grid h-7 w-7 place-items-center rounded-md text-[#6f7686] hover:bg-white/[0.06] hover:text-white ${
            isCollapsed ? 'w-full' : 'ml-auto'
          }`}
        >
          <Icon
            name={isCollapsed ? 'chevronRight' : 'chevronLeft'}
            className="h-4 w-4"
          />
        </button>
      </div>

      <div className={isCollapsed ? 'px-2 pb-1' : 'px-3 pb-1'}>
        <Link
          href="/komut"
          title="Yeni Proje"
          className={`flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#7c5cff] py-2 text-[13px] font-semibold text-white hover:bg-[#8b6fff] ${
            isCollapsed ? 'px-0' : 'px-3'
          }`}
        >
          <Icon name="plus" className="h-4 w-4" strokeWidth={2} />
          {!isCollapsed && 'Yeni Proje'}
        </Link>
      </div>

      <nav className={`pf-scroll min-h-0 flex-1 overflow-y-auto pb-4 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        {groups.map((group) => (
          <div key={group.title}>
            {groupLabel(group.title, isCollapsed)}
            <div className="space-y-0.5">{group.items.map((item) => renderItem(item, isCollapsed))}</div>
          </div>
        ))}

        {isAdmin && (
          <div>
            {groupLabel('Yönetim', isCollapsed)}
            <div className="space-y-0.5">{adminItems.map((item) => renderItem(item, isCollapsed))}</div>
          </div>
        )}
      </nav>

      <div className={`shrink-0 border-t border-[#1b1f28] py-3 ${isCollapsed ? 'px-2' : 'px-3'}`}>
        <div
          className={`flex items-center gap-2.5 rounded-lg px-1 py-1 ${
            isCollapsed ? 'flex-col gap-1.5' : ''
          }`}
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1a1f2a] text-[11px] font-semibold uppercase text-[#a48bff]">
            {(email || '?').slice(0, 1)}
          </span>
          {!isCollapsed && (
            <p className="min-w-0 flex-1 truncate text-[11.5px] text-[#7c8291]" title={email}>
              {email || 'Misafir'}
            </p>
          )}
          <button
            onClick={logout}
            aria-label="Çıkış yap"
            title="Çıkış yap"
            className="grid h-7 w-7 place-items-center rounded-md text-[#7c8291] hover:bg-white/[0.06] hover:text-white"
          >
            <Icon name="logout" className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#08090d] text-[#e7e9ee]">
      {/* SOL MENÜ — MASAÜSTÜ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden transition-[width] duration-200 lg:block ${
          collapsed ? 'w-[68px]' : 'w-[236px]'
        }`}
      >
        {renderSidebar(collapsed)}
      </aside>

      {/* SOL MENÜ — MOBİL ÇEKMECE */}
      {navOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="pf-fade absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          />

          <div className="pf-slide-in absolute inset-y-0 left-0 w-[272px] shadow-2xl">
            {renderSidebar(false)}
          </div>
        </div>
      )}

      {/* MOBİL ÜST BAR */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-[#1b1f28] bg-[#0a0c11]/95 px-3 backdrop-blur-xl lg:hidden">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Menüyü aç"
          className="grid h-9 w-9 place-items-center rounded-lg text-[#c7cad3] hover:bg-white/[0.06]"
        >
          <Icon name="menu" className="h-[18px] w-[18px]" />
        </button>

        <Link href="/panel" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-[#7c5cff] to-[#a855f7] text-[11px] font-black text-white">
            P
          </span>
          <span className="text-[14px] font-semibold tracking-tight">PromptForge</span>
        </Link>

        <Link
          href="/komut"
          className="ml-auto flex h-9 items-center gap-1 rounded-lg bg-[#7c5cff] px-3 text-[12px] font-semibold text-white"
        >
          <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
          Yeni
        </Link>
      </header>

      <div className={collapsed ? 'lg:pl-[68px]' : 'lg:pl-[236px]'}>
        {/* MASAÜSTÜ ÜST BAR — tek komut kutusu */}
        <header className="sticky top-0 z-30 hidden h-14 items-center gap-4 border-b border-[#1b1f28] bg-[#08090d]/85 px-6 backdrop-blur-xl lg:flex">
          <div className="w-full max-w-2xl">
            <QuickCommand compact />
          </div>
          <Link
            href="/dashboard"
            className="ml-auto flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#242a36] px-3 text-[12.5px] font-medium text-[#c7cad3] hover:border-[#7c5cff]/50 hover:text-white"
          >
            <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
            Yeni Proje
          </Link>
        </header>

        <main>{children}</main>
      </div>
    </div>
  )
}
