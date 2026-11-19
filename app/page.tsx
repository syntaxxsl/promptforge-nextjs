import Link from 'next/link'

export const metadata = {
  title: 'PromptForge — Hayal Et, Kodla',
  description:
    'Yapay zeka destekli web geliştirme platformu. Fikrini yaz, profesyonel web sitene dönüştür. Kodlama bilgisi gerekmez.',
}

const features = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 2.2 5.1L19 10.5l-4.8 2.4L12 18l-2.2-5.1L5 10.5l4.8-2.4L12 3Z" />
      </svg>
    ),
    accent: 'from-[#7c3aed] to-[#4f46e5]',
    title: 'Kod Sihirbazı',
    description: 'Doğal dil ile web sitesi oluşturun.',
    href: '/dashboard',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <circle cx="8.5" cy="9.5" r="1.6" />
        <path d="m4 17 4.5-4.5 3.5 3.5 3-3L20 18" />
      </svg>
    ),
    accent: 'from-[#2563eb] to-[#0ea5e9]',
    title: 'Vision-to-Code',
    description: 'Görselden kod üretin.',
    href: '/vision',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8.5v7a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 15.5v-7a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8.5Z" />
        <path d="m3.3 7.3 8.7 5 8.7-5M12 21.5v-9.2" />
      </svg>
    ),
    accent: 'from-[#7c3aed] to-[#a855f7]',
    title: 'Önizleme Modu',
    description: 'Projelerinizi anında görün.',
    href: '/dashboard',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />
      </svg>
    ),
    accent: 'from-[#4f46e5] to-[#2563eb]',
    title: 'Hızlı Düzenleyici',
    description: 'Kodlarınızı anında düzenleyin.',
    href: '/dashboard',
  },
]

const stats = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#60a5fa]" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
        <circle cx="9" cy="7" r="3.2" />
        <path d="M22 20v-1.5a4 4 0 0 0-3-3.85M16.5 4.2a3.2 3.2 0 0 1 0 5.9" />
      </svg>
    ),
    value: '50.000+',
    label: 'Aktif Kullanıcı',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#a855f7]" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8.5v7a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 15.5v-7a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8.5Z" />
        <path d="m3.3 7.3 8.7 5 8.7-5M12 21.5v-9.2" />
      </svg>
    ),
    value: '1M+',
    label: 'Oluşturulan Proje',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-[#8b5cf6]" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />
      </svg>
    ),
    value: '%99.9',
    label: 'Uptime Oranı',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-[#8b5cf6]">
        <path d="m12 2.6 2.9 6 6.6.9-4.8 4.7 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9 2.9-6Z" />
      </svg>
    ),
    value: '4.9/5',
    label: 'Kullanıcı Memnuniyeti',
  },
]

export default function LandingPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05060f] text-white">
      {/* Arka plan ışıkları ve dalga formları */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-48 h-[560px] w-[560px] rounded-full bg-[#7c3aed]/25 blur-[150px]" />
        <div className="absolute -right-24 top-10 h-[420px] w-[420px] rounded-full bg-[#2563eb]/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-[380px] w-[620px] rounded-full bg-[#4f46e5]/10 blur-[150px]" />
        <div className="absolute -bottom-40 -right-32 h-[520px] w-[520px] rotate-12 rounded-[45%] border border-[#3b82f6]/20 bg-gradient-to-tr from-transparent via-[#4f46e5]/10 to-transparent blur-2xl" />
        <div className="absolute -left-24 bottom-24 h-[380px] w-[380px] -rotate-12 rounded-[45%] border border-[#7c3aed]/20 blur-2xl" />
      </div>

      {/* ÜST MENÜ */}
      <header className="relative z-20 px-4 pt-6 sm:px-6">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#080a14]/80 px-4 py-3 shadow-[0_10px_50px_-20px_rgba(124,58,237,0.6)] backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#a855f7] to-[#4f46e5] text-lg font-black shadow-[0_0_20px_rgba(124,58,237,0.7)]">
              P
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Prompt<span className="bg-gradient-to-r from-[#a855f7] to-[#3b82f6] bg-clip-text text-transparent">Forge</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-3.5 py-2 text-sm font-semibold text-white ring-1 ring-inset ring-white/10"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5" />
              </svg>
              Ana Sayfa
            </Link>
            <a href="#ozellikler" className="rounded-xl px-3.5 py-2 text-sm font-medium text-gray-400 transition hover:text-white">
              Özellikler
            </a>
            <Link href="/tools" className="rounded-xl px-3.5 py-2 text-sm font-medium text-gray-400 transition hover:text-white">
              Araçlar
            </Link>
            <Link href="/explore" className="rounded-xl px-3.5 py-2 text-sm font-medium text-gray-400 transition hover:text-white">
              Keşfet
            </Link>
            <Link href="/changelog" className="rounded-xl px-3.5 py-2 text-sm font-medium text-gray-400 transition hover:text-white">
              Blog
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Tema"
              className="grid h-9 w-9 place-items-center rounded-xl text-gray-300 transition hover:bg-white/5 hover:text-white"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4.5 w-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
              </svg>
            </button>
            <Link
              href="/auth"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8b5cf6] to-[#6366f1] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(139,92,246,0.9)] transition hover:brightness-110"
            >
              Başla
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-[1180px] items-center gap-16 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.02fr_1fr] lg:pb-24 lg:pt-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-medium text-gray-300">
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-[#a855f7]" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z" />
            </svg>
            Geleceğin Web Geliştirme Platformu
          </span>

          <h1 className="mt-6 text-[2.75rem] font-black leading-[1.04] tracking-tight sm:text-6xl xl:text-[4.25rem]">
            PromptForge ile
            <br />
            Hayal Et,{' '}
            <span className="bg-gradient-to-r from-[#a855f7] via-[#7c7cf6] to-[#3b82f6] bg-clip-text text-transparent">
              Koda.
            </span>
          </h1>

          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-gray-400">
            Yapay zeka destekli güçlü araçlarımızla fikirlerinizi profesyonel web
            sitelerine dönüştürün. Kodlama bilginiz olmasa bile, sadece hayal
            gücünüz yeter.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/auth"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#7c3aed] via-[#6366f1] to-[#3b82f6] px-6 py-3.5 text-sm font-semibold shadow-[0_12px_40px_-12px_rgba(124,58,237,1)] transition hover:brightness-110"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 2.5c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8Z" />
              </svg>
              Hemen Başla
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M13 6l6 6-6 6" />
              </svg>
            </Link>

            <a
              href="#ozellikler"
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-medium text-gray-200 transition hover:bg-white/[0.07]"
            >
              <span className="grid h-5 w-5 place-items-center rounded-full border border-white/25">
                <svg viewBox="0 0 24 24" fill="currentColor" className="ml-px h-2.5 w-2.5">
                  <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                </svg>
              </span>
              Nasıl Çalışır?
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2.5">
                {[
                  'from-[#f472b6] to-[#a855f7]',
                  'from-[#60a5fa] to-[#4f46e5]',
                  'from-[#fbbf24] to-[#f97316]',
                  'from-[#34d399] to-[#0ea5e9]',
                ].map((gradient, index) => (
                  <span
                    key={gradient}
                    className={`grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br ${gradient} text-[10px] font-bold text-white ring-2 ring-[#05060f]`}
                  >
                    {['EY', 'MK', 'SD', 'AY'][index]}
                  </span>
                ))}
              </div>
              <div className="text-sm">
                <p className="font-bold">50.000+</p>
                <p className="text-xs text-gray-500">Aktif Kullanıcı</p>
              </div>
            </div>

            <span className="hidden h-9 w-px bg-white/10 sm:block" />

            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#8b5cf6]">
                <path d="m12 2.6 2.9 6 6.6.9-4.8 4.7 1.2 6.6-5.9-3.2-5.9 3.2 1.2-6.6L2.5 9.5l6.6-.9 2.9-6Z" />
              </svg>
              <div className="text-sm">
                <p className="font-bold">4.9/5</p>
                <p className="text-xs text-gray-500">Kullanıcı Puanı</p>
              </div>
            </div>
          </div>
        </div>

        {/* KOD EDİTÖRÜ GÖRSELİ */}
        <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
          <div aria-hidden className="absolute left-1/2 top-1/2 h-[115%] w-[118%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-[#7c3aed]/40 blur-[2px]" />
          <div aria-hidden className="absolute inset-0 -z-10 rounded-[50%] bg-[#6d28d9]/25 blur-[90px]" />

          <div className="relative rounded-2xl border border-white/10 bg-[#080a13]/95 shadow-[0_40px_120px_-40px_rgba(109,40,217,0.9)] backdrop-blur-sm">
            <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="ml-2 flex items-center gap-1">
                <span className="rounded-md bg-[#131a2e] px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/10">
                  HTML
                </span>
                <span className="px-3 py-1 text-[11px] font-medium text-gray-500">CSS</span>
                <span className="px-3 py-1 text-[11px] font-medium text-gray-500">JS</span>
              </div>
            </div>

            <div className="overflow-x-auto px-4 py-4 font-mono text-[12.5px] leading-[1.85]">
              {[
                <>
                  <span className="text-[#64748b]">&lt;!</span>
                  <span className="text-[#c084fc]">DOCTYPE</span> <span className="text-[#93c5fd]">html</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  <span className="text-[#64748b]">&lt;</span><span className="text-[#c084fc]">html</span>{' '}
                  <span className="text-[#60a5fa]">lang</span>
                  <span className="text-[#64748b]">=</span>
                  <span className="text-[#4ade80]">&quot;tr&quot;</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  {'  '}
                  <span className="text-[#64748b]">&lt;</span><span className="text-[#c084fc]">head</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  {'    '}
                  <span className="text-[#64748b]">&lt;</span><span className="text-[#c084fc]">meta</span>{' '}
                  <span className="text-[#60a5fa]">charset</span>
                  <span className="text-[#64748b]">=</span>
                  <span className="text-[#4ade80]">&quot;UTF-8&quot;</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  {'    '}
                  <span className="text-[#64748b]">&lt;</span><span className="text-[#c084fc]">title</span>
                  <span className="text-[#64748b]">&gt;</span>
                  <span className="text-gray-200">PromptForge</span>
                  <span className="text-[#64748b]">&lt;/</span><span className="text-[#c084fc]">title</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  {'  '}
                  <span className="text-[#64748b]">&lt;/</span><span className="text-[#c084fc]">head</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  {'  '}
                  <span className="text-[#64748b]">&lt;</span><span className="text-[#c084fc]">body</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  {'    '}
                  <span className="text-[#64748b]">&lt;</span><span className="text-[#c084fc]">h1</span>
                  <span className="text-[#64748b]">&gt;</span>
                  <span className="text-gray-200">Hayal Et, Kodla!</span>
                  <span className="text-[#64748b]">&lt;/</span><span className="text-[#c084fc]">h1</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  {'  '}
                  <span className="text-[#64748b]">&lt;/</span><span className="text-[#c084fc]">body</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
                <>
                  <span className="text-[#64748b]">&lt;/</span><span className="text-[#c084fc]">html</span>
                  <span className="text-[#64748b]">&gt;</span>
                </>,
              ].map((line, index) => (
                <div key={index} className="flex gap-4 whitespace-pre">
                  <span className="w-4 select-none text-right text-[#3b4257]">{index + 1}</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Yüzen logo kutusu */}
          <div className="absolute right-1 -top-9 grid h-20 w-20 rotate-3 place-items-center rounded-3xl border border-white/15 bg-gradient-to-br from-[#1b1035] to-[#0a0a16] shadow-[0_20px_60px_-20px_rgba(168,85,247,0.9)] sm:-right-2 sm:h-24 sm:w-24">
            <span className="text-4xl font-black">
              <span className="bg-gradient-to-br from-[#c084fc] to-[#3b82f6] bg-clip-text text-transparent">P</span>
            </span>
          </div>

          {/* Yüzen AI kartı */}
          <div className="absolute -bottom-7 right-1 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0d18]/95 px-4 py-3 shadow-[0_20px_60px_-20px_rgba(59,130,246,0.7)] backdrop-blur sm:-right-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#1a1330] ring-1 ring-inset ring-[#7c3aed]/40">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[#a855f7]">
                <path d="M12 2.5c.5 4.6 3.4 7.5 8 8-4.6.5-7.5 3.4-8 8-.5-4.6-3.4-7.5-8-8 4.6-.5 7.5-3.4 8-8Z" />
              </svg>
            </span>
            <div className="text-[13px] leading-tight">
              <p className="text-gray-400">AI ile</p>
              <p className="font-semibold">Kod Üretimi</p>
            </div>
            <span className="ml-2 grid h-7 w-7 place-items-center rounded-full bg-[#2a1a4d] text-[#c4b5fd]">
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17 17 7M9 7h8v8" />
              </svg>
            </span>
          </div>
        </div>
      </section>

      {/* ÖZELLİKLER */}
      <section id="ozellikler" className="relative z-10 mx-auto max-w-[1180px] px-4 pb-16 pt-6 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
          <span className="whitespace-nowrap rounded-full border border-[#7c3aed]/40 bg-[#7c3aed]/10 px-4 py-1.5 text-[11px] font-semibold tracking-wide text-[#c4b5fd]">
            Tüm İhtiyaçlarınız İçin Tek Platform
          </span>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
        </div>

        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight sm:text-4xl">
          Güçlü Özellikler
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm text-gray-400">
          PromptForge ile geliştirme sürecinizi hızlandırın ve yaratıcılığınızı
          konuşturun.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.05] to-white/[0.01] p-5 transition hover:border-[#7c3aed]/40 hover:from-[#7c3aed]/10"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${feature.accent} text-white shadow-[0_10px_30px_-10px_rgba(124,58,237,0.9)]`}
                >
                  {feature.icon}
                </span>
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.05] text-gray-400 transition group-hover:bg-[#7c3aed]/20 group-hover:text-white">
                  <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h13M13 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
              <h3 className="mt-5 text-sm font-bold">{feature.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
                {feature.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* İSTATİSTİKLER */}
      <section className="relative z-10 mx-auto max-w-[1180px] px-4 pb-20 sm:px-6">
        <div className="grid gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-6 py-7 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/[0.08]">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-4 lg:justify-center lg:px-2">
              {stat.icon}
              <div>
                <p className="text-xl font-extrabold tracking-tight">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
