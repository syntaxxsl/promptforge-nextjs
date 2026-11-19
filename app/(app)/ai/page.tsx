'use client'

import Link from 'next/link'
import Icon, { type IconName } from '../../components/Icon'

type Tool = {
  icon: IconName
  title: string
  description: string
  href: string
  tag: string
}

const tools: Tool[] = [
  {
    icon: 'sparkles',
    title: 'Kod Sihirbazı',
    description:
      'Ne istediğini yaz, çalışan bir sayfa olarak geri gelsin. Hazır başlangıç noktası arayanlar için en hızlı yol.',
    href: '/dashboard',
    tag: 'Üretim',
  },
  {
    icon: 'vision',
    title: 'Vision-to-Code',
    description:
      'Elinde bir tasarım görseli mi var? Yükle, HTML ve CSS olarak çıkar. Sıfırdan yazmaya gerek yok.',
    href: '/vision',
    tag: 'Üretim',
  },
  {
    icon: 'bug',
    title: 'Hata Dedektörü',
    description:
      'Kodun neden çalışmadığını anlatır, düzeltilmiş hâlini gösterir. Tarayıcıda saatlerce aramaya son.',
    href: '/critic',
    tag: 'Düzeltme',
  },
  {
    icon: 'sliders',
    title: 'Araçlar',
    description:
      'Renk paleti, font eşleştirici, kod biçimlendirici ve şablonlar. Küçük işler için tek sayfa.',
    href: '/tools',
    tag: 'Yardımcı',
  },
]

export default function AiToolsPage() {
  return (
    <div className="mx-auto max-w-[1080px] px-5 py-8 sm:px-8 sm:py-10">
      <header className="mb-8">
        <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#5f6573]">
          <span className="h-px w-3 bg-[#7c5cff]/60" />
          AI Araçları
        </p>
        <h1 className="mt-3 text-[26px] font-semibold tracking-tight text-white sm:text-[30px]">
          Nereden başlamak istiyorsun?
        </h1>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-[#8b909d]">
          Dördü de aynı yere çıkıyor: çalışan bir proje. Hangisi işine yakınsa
          ondan başla, sonra editörde devam et.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.title}
            href={tool.href}
            className="group rounded-xl border border-[#1b1f28] bg-[#0b0d12] p-5 transition-colors hover:border-[#2c3240] hover:bg-[#0d1017]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#242a36] bg-[#11141b] text-[#a48bff]">
                <Icon name={tool.icon} className="h-[17px] w-[17px]" />
              </span>
              <span className="rounded-md border border-[#242a36] px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.12em] text-[#6f7686]">
                {tool.tag}
              </span>
            </div>

            <h2 className="mt-4 text-[14.5px] font-semibold text-[#e7e9ee]">
              {tool.title}
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#8b909d]">
              {tool.description}
            </p>

            <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#a48bff] opacity-0 transition-opacity group-hover:opacity-100">
              Aç
              <Icon name="arrowRight" className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-[#1b1f28] bg-[#0b0d12] px-5 py-4 text-[12.5px] text-[#8b909d]">
        <span className="text-[#e7e9ee]">İpucu:</span>
        Ürettiğin her şey otomatik olarak Projelerim&apos;e düşer, oradan devam
        edebilirsin.
        <Link href="/dashboard" className="text-[#a48bff] hover:underline">
          Projelere git
        </Link>
      </div>
    </div>
  )
}
