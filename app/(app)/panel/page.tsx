'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon, { type IconName } from '../../components/Icon'
import QuickCommand from '../../components/QuickCommand'
import { supabase } from '../../../lib/supabase'

type Project = {
  id: string
  title: string | null
  updated_at: string | null
  thumbnail_url: string | null
}

const tools: { href: string; icon: IconName; title: string; text: string }[] = [
  {
    href: '/website-builder',
    icon: 'code',
    title: 'Website Builder',
    text: 'Yaz, site hazır olsun; önizle, kaydet.',
  },
  {
    href: '/sohbet',
    icon: 'message',
    title: 'AI Chat',
    text: 'Takıldığın her şeyi sor, birlikte çöz.',
  },
  {
    href: '/belge',
    icon: 'folder',
    title: 'Belge Analizi',
    text: 'Sözleşme, rapor, not: özetle ve sor.',
  },
  {
    href: '/dil',
    icon: 'compass',
    title: 'Dil Araçları',
    text: 'Çevir, özetle, yazımı düzelt.',
  },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 6) return 'İyi geceler'
  if (hour < 12) return 'Günaydın'
  if (hour < 18) return 'İyi günler'
  return 'İyi akşamlar'
}

function when(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const diff = Date.now() - date.getTime()
  const day = Math.floor(diff / 86_400_000)

  if (day <= 0) return 'bugün'
  if (day === 1) return 'dün'
  if (day < 7) return `${day} gün önce`
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

export default function PanelPage() {
  const [name, setName] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData.user

      if (cancelled) return

      if (user?.email) setName(user.email.split('@')[0])

      if (!user) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('projects')
        .select('id, title, updated_at, thumbnail_url')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(6)

      if (cancelled) return

      setProjects((data as Project[]) || [])
      setLoading(false)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="relative mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10 lg:py-14">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] pf-hero-glow" />

      <div className="pf-enter">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7c5cff]">
          PromptForge
        </p>
        <h1 className="mt-2 bg-gradient-to-b from-white via-white to-[#b9a6ff] bg-clip-text text-[26px] font-semibold tracking-tight text-transparent sm:text-[34px]">
          {greeting()}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="mt-2 text-[13.5px] text-[#878d9b]">
          Ne yapmak istediğini yaz; seni doğru araca götürüyorum.
        </p>
      </div>

      <div className="pf-enter mt-6">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-x-6 -top-10 h-40 rounded-full bg-[#7c5cff]/12 blur-3xl" />
          <div className="pf-surface relative rounded-[22px] p-2.5 shadow-[0_20px_60px_-30px_rgba(124,92,255,0.55)]">
            <QuickCommand autoFocus bare />
            <div className="flex flex-wrap gap-1.5 px-2 pb-1 pt-2">
              {['Portfolyo sitemi yap', 'PDF özetle', 'İngilizceye çevir', 'Blog yazısı yaz'].map(
                (item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[#242a36] px-2.5 py-1 text-[11px] text-[#6f7686]"
                  >
                    {item}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4 transition-colors hover:border-[#7c5cff]/40 hover:bg-[#0e1017]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#7c5cff]/25 bg-[#7c5cff]/10 text-[#a48bff]">
              <Icon name={tool.icon} className="h-[18px] w-[18px]" />
            </span>
            <p className="mt-3 text-[13.5px] font-semibold text-white">{tool.title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#6f7686]">{tool.text}</p>
          </Link>
        ))}
      </section>

      <section id="projeler" className="mt-10 scroll-mt-24">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-white">Son projeler</h2>
          <Link
            href="/dashboard#projects-section"
            className="text-[12px] text-[#8b909d] hover:text-white"
          >
            Tümünü gör
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-[104px] animate-pulse rounded-2xl border border-[#1b1f28] bg-[#0b0d13]"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#242a36] bg-[#0b0d13] px-5 py-10 text-center">
            <p className="text-[13.5px] text-[#c3c7d1]">Henüz projen yok.</p>
            <p className="mt-1 text-[12.5px] text-[#6f7686]">
              Yukarıdaki kutuya ne yapmak istediğini yaz, ilk projeni birlikte kuralım.
            </p>
            <Link
              href="/website-builder"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#7c5cff] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#8b6fff]"
            >
              <Icon name="plus" className="h-3.5 w-3.5" strokeWidth={2} />
              İlk projeyi oluştur
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href="/dashboard#projects-section"
                className="group flex items-center gap-3 rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-3 hover:border-[#7c5cff]/40"
              >
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#242a36] bg-gradient-to-br from-[#1a1230] to-[#0f1118] text-[15px] font-semibold text-[#a48bff]">
                  {(project.title || 'P').slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-white">
                    {project.title || 'Adsız proje'}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-[#6f7686]">
                    {when(project.updated_at)}
                  </span>
                </span>
                <Icon
                  name="arrowRight"
                  className="h-4 w-4 shrink-0 text-[#3f4552] group-hover:text-[#a48bff]"
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13.5px] font-semibold text-white">Daha fazlası yolda</p>
            <p className="mt-0.5 text-[12.5px] text-[#6f7686]">
              AI Arena, Kendi Asistanım ve AI Teams sırayla geliyor.
            </p>
          </div>
          <Link
            href="/studios"
            className="flex items-center gap-1.5 rounded-xl border border-[#242a36] px-3 py-2 text-[12px] text-[#c3c7d1] hover:border-[#7c5cff]/50 hover:text-white"
          >
            Neler geliyor?
            <Icon name="arrowRight" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
