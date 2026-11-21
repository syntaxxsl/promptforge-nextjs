'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon, { type IconName } from './components/Icon'
import { pick } from './components/QuickCommand'

const quick = [
  'Portfolyo sitem için sade bir sayfa yap',
  'PDF özetle',
  'İngilizceye çevir',
  'Blog yazısı yaz',
]

type Card = { icon: IconName; title: string; text: string; href: string }

const tools: Card[] = [
  { icon: 'message', title: 'AI Chat', text: 'Takıldığın her şeyi sor; birlikte çöz.', href: '/sohbet' },
  { icon: 'code', title: 'Website Builder', text: 'Yaz, site hazır olsun. Önizle, kaydet.', href: '/website-builder' },
  { icon: 'map', title: 'Zihin Haritası', text: 'Bir konuyu dallandır, planını çıkar.', href: '/zihin-haritasi' },
  { icon: 'pen', title: 'AI Writer', text: 'Metin, başlık, e-posta, açıklama yaz.', href: '/writer' },
  { icon: 'layers', title: 'Sunum', text: 'Slayt akışını ve içeriğini hazırla.', href: '/sunum' },
  { icon: 'vision', title: 'Görselden Kod', text: 'Ekran görüntüsünü HTML’e çevir.', href: '/vision' },
]

const fresh: Card[] = [
  { icon: 'pulse', title: 'AI Arena', text: 'Aynı isteği iki modele gönder, cevapları yan yana oku.', href: '/arena' },
  { icon: 'user', title: 'Asistanım', text: 'Kendi asistanını tanımla: adı, tonu, kuralları senin.', href: '/asistanim' },
  { icon: 'users', title: 'AI Teams', text: 'Planlayıcı, yazar ve kontrolcü sırayla çalışsın.', href: '/teams' },
]

const steps = [
  ['01', 'Ne istediğini yaz', 'Tek satır yeter. “Kafem için menü sayfası” gibi.'],
  ['02', 'Araç kendisi seçilir', 'Komut kutusu isteğini doğru araca yönlendirir.'],
  ['03', 'Sonucu al, düzenle, kaydet', 'Çıktıyı kopyala, indir ya da projeye kaydet.'],
]

export default function LandingPage() {
  const router = useRouter()
  const [command, setCommand] = useState('')

  // Komut kutusu, paneldeki kutunun aynısı: isteği en yakın araca yönlendirir.
  const start = (text?: string) => {
    const value = (text ?? command).trim()
    if (!value) return
    window.sessionStorage.setItem('pf-draft', value)
    router.push(pick(value).href)
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#08090d] text-[#e7e9ee]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] pf-hero-glow" />

      <header className="relative z-20 mx-auto flex w-full max-w-[1180px] items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#7c5cff] text-[13px] font-bold text-white">
            P
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-white">PromptForge</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <Link href="/komut" className="rounded-lg px-3 py-1.5 text-[13px] text-[#9aa0ae] hover:text-white">
            Araçlar
          </Link>
          <a href="#ozellikler" className="rounded-lg px-3 py-1.5 text-[13px] text-[#9aa0ae] hover:text-white">
            Özellikler
          </a>
          <a href="#nasil" className="rounded-lg px-3 py-1.5 text-[13px] text-[#9aa0ae] hover:text-white">
            Nasıl çalışır
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/auth"
            className="rounded-lg border border-[#242a36] px-3 py-1.5 text-[12.5px] text-[#c7cad3] hover:text-white"
          >
            Giriş yap
          </Link>
          <Link
            href="/auth"
            className="rounded-lg bg-[#7c5cff] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#8b6fff]"
          >
            Ücretsiz başla
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto w-full max-w-[880px] px-4 pb-14 pt-10 text-center sm:px-6 sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#242a36] bg-white/[0.03] px-3 py-1 text-[11.5px] text-[#9aa0ae]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7c5cff]" />
          Yeni arayüz · AI Arena, Asistanım ve AI Teams yayında
        </span>

        <h1 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-tight text-white sm:text-[52px]">
          Yaz, gerisini
          <br className="sm:hidden" /> <span className="text-[#a48bff]">PromptForge</span> halletsin.
        </h1>

        <p className="mx-auto mt-4 max-w-[520px] text-[14px] leading-relaxed text-[#878d9b] sm:text-[15px]">
          Site, metin, kod, özet, çeviri… Ne yapmak istediğini yaz; doğru araca yönlensin.
          Kodlama bilmene gerek yok.
        </p>

        <div className="mx-auto mt-8 max-w-[720px] rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-3 text-left shadow-[0_30px_80px_-50px_rgba(124,92,255,0.8)]">
          <div className="flex items-center gap-2">
            <Icon name="sparkles" className="ml-1 h-4 w-4 shrink-0 text-[#a48bff]" />
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') start()
              }}
              placeholder="Ne yapmak istiyorsun? Örn: kafem için menü sayfası yap"
              className="min-w-0 flex-1 bg-transparent py-2 text-[13.5px] text-[#e7e9ee] outline-none placeholder:text-[#5b616f]"
            />
            <button
              type="button"
              onClick={() => start()}
              aria-label="Başla"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#7c5cff] text-white hover:bg-[#8b6fff]"
            >
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#1b1f28] pt-2.5">
            {quick.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => start(item)}
                className="rounded-full border border-[#242a36] px-2.5 py-1 text-[11.5px] text-[#a7acb8] hover:border-[#7c5cff]/50 hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[11.5px] text-[#5b616f]">
          Ücretsiz hesap; çıktılarını projeye kaydedip sonra devam edebilirsin.
        </p>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-4 pb-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fresh.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-[#7c5cff]/25 bg-gradient-to-b from-[#7c5cff]/10 to-transparent p-4 transition hover:border-[#7c5cff]/50"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 place-items-center rounded-lg border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <p className="text-[13.5px] font-semibold text-white">{item.title}</p>
                <span className="ml-auto rounded-full border border-[#7c5cff]/40 px-2 py-0.5 text-[10px] text-[#c0afff]">
                  yeni
                </span>
              </div>
              <p className="mt-2.5 text-[12.5px] leading-relaxed text-[#878d9b]">{item.text}</p>
            </Link>
          ))}
        </div>
      </section>

      <section id="ozellikler" className="relative z-10 mx-auto w-full max-w-[1180px] px-4 py-12 sm:px-6">
        <h2 className="text-[22px] font-semibold tracking-tight text-white sm:text-[26px]">
          Panelde seni ne bekliyor
        </h2>
        <p className="mt-1.5 max-w-[520px] text-[13px] leading-relaxed text-[#878d9b]">
          Hepsi tek yerde: yazı, kod, görselden kod, zihin haritası ve daha fazlası.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="group flex items-start gap-3 rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4 transition hover:border-[#242a36] hover:bg-[#0e1017]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#242a36] bg-[#0f1219] text-[#a48bff]">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-medium text-white">{item.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#6f7686]">{item.text}</p>
              </div>
              <Icon
                name="arrowRight"
                className="ml-auto h-3.5 w-3.5 shrink-0 translate-y-1 text-[#3a4050] transition group-hover:translate-x-0.5 group-hover:text-[#a48bff]"
              />
            </Link>
          ))}
        </div>

        <Link
          href="/komut"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border border-[#1b1f28] bg-[#0b0d13] px-4 py-3 text-[12.5px] text-[#a7acb8] hover:border-[#242a36] hover:text-white"
        >
          Tüm araçları gör
          <Icon name="chevronRight" className="h-3.5 w-3.5" />
        </Link>
      </section>

      <section id="nasil" className="relative z-10 mx-auto w-full max-w-[1180px] px-4 pb-12 sm:px-6">
        <div className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold text-white">Nasıl çalışır?</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {steps.map(([number, title, text]) => (
              <div key={number} className="border-t border-[#1b1f28] pt-3 md:border-t-0 md:border-l md:pl-4 md:pt-0">
                <span className="text-[11px] font-medium text-[#7c5cff]">{number}</span>
                <p className="mt-1 text-[13px] font-medium text-white">{title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[#6f7686]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-[1180px] px-4 pb-16 sm:px-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#7c5cff]/25 bg-gradient-to-br from-[#7c5cff]/12 to-transparent px-6 py-9 text-center">
          <h2 className="text-[20px] font-semibold tracking-tight text-white sm:text-[24px]">
            Bir cümleyle başla
          </h2>
          <p className="max-w-[440px] text-[13px] leading-relaxed text-[#9aa0ae]">
            Ücretsiz hesapla aç, kendi asistanını kur, ilk siteni ya da metnini üret.
          </p>
          <Link
            href="/auth"
            className="mt-2 flex items-center gap-2 rounded-xl bg-[#7c5cff] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#8b6fff]"
          >
            Ücretsiz başla
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#1b1f28]">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[11.5px] text-[#5b616f] sm:px-6">
          <p>© {new Date().getFullYear()} PromptForge</p>
          <div className="flex items-center gap-4">
            <Link href="/tools" className="hover:text-[#a7acb8]">
              Araçlar
            </Link>
            <Link href="/auth" className="hover:text-[#a7acb8]">
              Giriş
            </Link>
            <Link href="/support" className="hover:text-[#a7acb8]">
              Destek
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
