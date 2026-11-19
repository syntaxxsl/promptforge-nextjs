'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type NavItem = {
  icon: string
  label: string
  href: string
}

type NavGroup = {
  title: string
  items: NavItem[]
}

const groups: NavGroup[] = [
  {
    title: 'Çalışma',
    items: [
      { icon: '🏠', label: 'Ana Sayfa', href: '/dashboard' },
      { icon: '📁', label: 'Projelerim', href: '/dashboard#projects-section' },
      { icon: '👤', label: 'Profilim', href: '/profile' },
      { icon: '🕘', label: 'Aktivite', href: '/activity' },
    ],
  },
  {
    title: 'Keşfet',
    items: [
      { icon: '🎨', label: 'Galeri', href: '/gallery' },
      { icon: '🧩', label: 'Keşfet', href: '/explore' },
      { icon: '🛒', label: 'Pazaryeri', href: '/marketplace' },
      { icon: '🧰', label: 'Araçlar', href: '/tools' },
      { icon: '👁️', label: 'Vision', href: '/vision' },
      { icon: '🧠', label: 'Critic', href: '/critic' },
    ],
  },
  {
    title: 'Hesap',
    items: [
      { icon: '⚙️', label: 'Ayarlar', href: '/settings' },
      { icon: '🛡️', label: 'Güvenlik', href: '/security' },
      { icon: '🎧', label: 'Destek', href: '/support' },
      { icon: '💬', label: 'Geri Bildirim', href: '/feedback' },
    ],
  },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const [navOpen, setNavOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

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

      const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle()

      if (cancelled) return

      setIsAdmin(
        String(profile?.role || '').toLowerCase().trim() === 'admin'
      )
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
    const base = href.split('#')[0]
    return pathname === base
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-[#0b0e16] text-white border-r border-[#1e2431]">
      <Link href="/dashboard" className="flex items-center gap-2 px-4 h-16 shrink-0">
        <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center font-black text-white">
          P
        </span>
        <span className="text-lg font-black tracking-tight">
          Prompt<span className="text-purple-500">Forge</span>
        </span>
      </Link>

      <div className="px-3 pb-3">
        <Link
          href="/dashboard"
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-bold shadow-lg shadow-purple-900/20 transition-transform hover:-translate-y-0.5"
        >
          + Yeni Proje
        </Link>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 space-y-5 pf-scroll">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {group.title}
            </p>

            <div className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(item.href)

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-purple-600/15 text-purple-400 ring-1 ring-purple-500/30'
                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="text-base w-5 text-center shrink-0">
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}

        {isAdmin && (
          <div>
            <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Yönetim
            </p>

            <div className="space-y-1">
              <Link
                href="/admin"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  pathname === '/admin'
                    ? 'bg-purple-600/15 text-purple-400 ring-1 ring-purple-500/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-base w-5 text-center shrink-0">🛠️</span>
                <span className="truncate">Admin Paneli</span>
              </Link>

              <Link
                href="/health"
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  pathname === '/health'
                    ? 'bg-purple-600/15 text-purple-400 ring-1 ring-purple-500/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-base w-5 text-center shrink-0">🩺</span>
                <span className="truncate">Sistem Sağlığı</span>
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-[#1e2431] px-3 pt-3 pb-4 shrink-0">
        <p className="px-1 mb-2 text-[11px] text-gray-500 truncate" title={email}>
          {email || 'Misafir'}
        </p>

        <button
          onClick={logout}
          className="w-full px-3 py-2 rounded-xl bg-[#171c28] hover:bg-[#222939] text-gray-300 text-xs font-bold transition-colors"
        >
          Çıkış Yap
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#090b10] text-white">
      {/* SOL MENÜ — MASAÜSTÜ */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 z-40 w-[252px]">
        {sidebar}
      </aside>

      {/* SOL MENÜ — MOBİL ÇEKMECE */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pf-fade"
            onClick={() => setNavOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 w-[280px] shadow-2xl pf-slide-in">
            {sidebar}
          </div>
        </div>
      )}

      {/* MOBİL ÜST BAR */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center gap-3 px-4 h-14 border-b border-[#1e2431] bg-[#0b0e16]/95 backdrop-blur-xl">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Menüyü aç"
          className="w-10 h-10 rounded-xl bg-[#171c28] flex items-center justify-center text-lg"
        >
          ☰
        </button>

        <Link href="/dashboard" className="text-base font-black tracking-tight">
          Prompt<span className="text-purple-500">Forge</span>
        </Link>

        <Link
          href="/dashboard"
          className="ml-auto px-3 h-9 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold flex items-center"
        >
          + Yeni
        </Link>
      </header>

      <main className="lg:pl-[252px] pf-enter">{children}</main>
    </div>
  )
}
