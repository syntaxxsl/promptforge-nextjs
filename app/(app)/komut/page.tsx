'use client'

import Link from 'next/link'
import Icon, { type IconName } from '../../components/Icon'
import QuickCommand from '../../components/QuickCommand'

const tools: { href: string; icon: IconName; title: string; text: string; words: string }[] = [
  {
    href: '/website-builder',
    icon: 'code',
    title: 'Website Builder',
    text: 'Tek cümleyle site üret, önizle, kaydet.',
    words: 'site, web, portfolyo, html',
  },
  {
    href: '/sohbet',
    icon: 'message',
    title: 'AI Chat',
    text: 'Uzun uzun konuş, birlikte düşün.',
    words: 'soru, sohbet, yardım',
  },
  {
    href: '/critic',
    icon: 'bug',
    title: 'Code Studio',
    text: 'Kodunu incele, hatasını bul, düzelt.',
    words: 'kod, hata, javascript',
  },
  {
    href: '/writer',
    icon: 'pen',
    title: 'AI Writer',
    text: 'Blog, e-posta, CV, sosyal medya metni.',
    words: 'yazı, blog, mail, cv',
  },
  {
    href: '/belge',
    icon: 'folder',
    title: 'Belge Analizi',
    text: 'Uzun metni özetle, içinde soru sor.',
    words: 'pdf, belge, özet, rapor',
  },
  {
    href: '/dil',
    icon: 'compass',
    title: 'Dil Araçları',
    text: 'Çeviri, özet ve yazım düzeltme.',
    words: 'çeviri, dilbilgisi',
  },
  {
    href: '/sunum',
    icon: 'layers',
    title: 'Sunum',
    text: 'Konundan slayt slayt taslak çıkar.',
    words: 'slayt, sunum',
  },
  {
    href: '/zihin-haritasi',
    icon: 'map',
    title: 'Zihin Haritası',
    text: 'Fikrini dallara ayır, görselleştir.',
    words: 'zihin, harita, plan',
  },
  {
    href: '/test',
    icon: 'pulse',
    title: 'Test Üretici',
    text: 'Metinden sorular ve cevap anahtarı.',
    words: 'test, quiz, sınav',
  },
  {
    href: '/marka',
    icon: 'sparkles',
    title: 'Marka Stüdyosu',
    text: 'İsim, slogan, marka sesi ve renkler.',
    words: 'marka, isim, slogan, logo',
  },
  {
    href: '/sosyal',
    icon: 'message',
    title: 'Sosyal Medya',
    text: 'Haftalık gönderi metinleri.',
    words: 'instagram, linkedin, gönderi',
  },
  {
    href: '/seo',
    icon: 'compass',
    title: 'SEO Studio',
    text: 'Başlık, açıklama, anahtar kelime.',
    words: 'seo, google, anahtar kelime',
  },
  {
    href: '/api',
    icon: 'terminal',
    title: 'API Studio',
    text: 'Fetch, cURL ve Python istek kodu.',
    words: 'api, endpoint, istek',
  },
  {
    href: '/sql',
    icon: 'terminal',
    title: 'SQL Asistanı',
    text: 'Doğal dilden sorguya.',
    words: 'sql, sorgu, veritabanı',
  },
  {
    href: '/prompt-muhendisi',
    icon: 'sparkles',
    title: 'Prompt Mühendisi',
    text: 'Dağınık isteği net bir isteme çevirir.',
    words: 'prompt, istem',
  },
  {
    href: '/chatbot',
    icon: 'message',
    title: 'Chatbot Builder',
    text: 'Karşılama metni ve hazır cevaplar.',
    words: 'chatbot, bot, otomatik cevap',
  },
  {
    href: '/matematik',
    icon: 'pulse',
    title: 'Matematik',
    text: 'Adım adım çözüm.',
    words: 'matematik, denklem, yüzde',
  },
  {
    href: '/hikaye',
    icon: 'pen',
    title: 'Hikâye Stüdyosu',
    text: 'Kısa hikâye, masal, senaryo.',
    words: 'hikâye, masal, senaryo',
  },
]

export default function CommandPage() {
  return (
    <div className="relative mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[380px] pf-hero-glow" />
      <div className="pf-enter text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#7c5cff]/30 bg-[#7c5cff]/10 px-3 py-1 text-[11px] font-medium text-[#c0afff]">
          <Icon name="sparkles" className="h-3.5 w-3.5" />
          Command Center
        </span>
        <h1 className="mt-4 bg-gradient-to-b from-white via-white to-[#b9a6ff] bg-clip-text text-[26px] font-semibold tracking-tight text-transparent sm:text-[38px]">
          Ne yapmak istersin?
        </h1>
        <p className="mx-auto mt-2 max-w-[560px] text-[13.5px] leading-relaxed text-[#878d9b]">
          Yazdığın şeye göre seni doğru araca yönlendiriyorum. Menülerde aramana gerek yok.
        </p>
      </div>

      <div className="pf-enter relative mx-auto mt-7 max-w-[720px]">
        <div className="pointer-events-none absolute -inset-x-8 -top-8 h-40 rounded-full bg-[#7c5cff]/15 blur-3xl" />
        <div className="pf-surface relative rounded-[22px] p-2.5 shadow-[0_24px_70px_-32px_rgba(124,92,255,0.6)]">
          <QuickCommand autoFocus bare />
        </div>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4 transition-colors hover:border-[#7c5cff]/40 hover:bg-[#0e1017]"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-[#7c5cff]/25 bg-[#7c5cff]/10 text-[#a48bff]">
                <Icon name={tool.icon} className="h-[18px] w-[18px]" />
              </span>
              <Icon
                name="arrowRight"
                className="mt-2 h-4 w-4 text-[#2f3441] group-hover:text-[#a48bff]"
              />
            </div>
            <p className="mt-3 text-[13.5px] font-semibold text-white">{tool.title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[#6f7686]">{tool.text}</p>
            <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#4e5462]">
              {tool.words}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}
