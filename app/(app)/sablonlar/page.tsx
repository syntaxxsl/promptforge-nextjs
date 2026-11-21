'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Icon from '../../components/Icon'

/**
 * Template Library: hazır istem şablonları.
 * Şablonlar kopyalanıp ilgili araçta kullanılır; hiçbiri sunucudan gelmez.
 */

type Template = {
  title: string
  category: string
  text: string
  tool: { label: string; href: string }
}

const TEMPLATES: Template[] = [
  {
    title: 'Tek sayfalık tanıtım sitesi',
    category: 'Site',
    text: 'Şu işletme için tek sayfalık, mobil uyumlu bir site yap: [işletme adı], [şehir], [hizmetler]. Üstte kısa bir başlık ve iletişim düğmesi, altında hizmetler ve hakkında bölümü olsun. Sade ve okunaklı olsun.',
    tool: { label: 'Website Builder', href: '/website-builder' },
  },
  {
    title: 'Portfolyo sayfası',
    category: 'Site',
    text: '[Meslek] olarak çalışıyorum. Projelerimi ve iletişim bilgilerimi gösteren tek sayfalık koyu temalı bir portfolyo yap. Proje kartlarında başlık ve tek cümle açıklama olsun.',
    tool: { label: 'Website Builder', href: '/website-builder' },
  },
  {
    title: 'Açılış sayfası metni',
    category: 'Yazı',
    text: '[Ürün] için açılış sayfası metni yaz: başlık, alt başlık, üç fayda, itiraz cevabı ve tek bir eylem çağrısı. Abartılı iddia ve uydurma rakam kullanma.',
    tool: { label: 'AI Writer', href: '/writer' },
  },
  {
    title: 'Soğuk e-posta',
    category: 'Yazı',
    text: '[Şirket] için [hizmet] öneren kısa bir e-posta yaz. İlk cümlede neden yazdığımı söyle, tek bir somut fayda ver, sonunda tek soruluk bir kapanış yap. 120 kelimeyi geçmesin.',
    tool: { label: 'AI Writer', href: '/writer' },
  },
  {
    title: 'Hata mesajını çöz',
    category: 'Kod',
    text: 'Şu hata mesajını ve kodu incele. Nedenini tek paragrafta açıkla, sonra düzeltilmiş kodu ver.\n\nHata:\n[yapıştır]\n\nKod:\n[yapıştır]',
    tool: { label: 'AI Debugger', href: '/debugger' },
  },
  {
    title: 'SQL sorgusu yaz',
    category: 'Kod',
    text: 'Şu tablolara göre SQL yaz: [tablo ve kolonlar]. İstenen: [ne istiyorsun]. Sorgunun altına tek cümlelik açıklama ekle.',
    tool: { label: 'SQL Asistanı', href: '/sql' },
  },
  {
    title: 'Veritabanı şeması',
    category: 'Kod',
    text: '[Uygulama] için tablo şeması tasarla. Her tablonun kolonları, tipleri, ilişkileri ve SQL CREATE TABLE çıktısı olsun.',
    tool: { label: 'Database Designer', href: '/db-designer' },
  },
  {
    title: 'Haftalık içerik takvimi',
    category: 'Sosyal',
    text: '[Marka] için 1 haftalık Instagram planı çıkar: 5 gönderi, her biri için amaç, kanca cümlesi, açıklama ve görsel fikri. Satış dili değil, fayda odaklı olsun.',
    tool: { label: 'Sosyal Medya', href: '/sosyal' },
  },
  {
    title: 'SEO başlık ve açıklama',
    category: 'Sosyal',
    text: '[Sayfa konusu] için 5 başlık ve 3 meta açıklama yaz. Başlıklar 60, açıklamalar 155 karakteri geçmesin. Anahtar kelime: [kelime].',
    tool: { label: 'SEO Studio', href: '/seo-studio' },
  },
  {
    title: 'CV metni',
    category: 'Kariyer',
    text: 'Deneyimlerim: [yaz]. Hedefim: [iş]. Bunları tek sayfalık CV metnine çevir. Uydurma bilgi ekleme.',
    tool: { label: 'CV Oluşturucu', href: '/cv' },
  },
  {
    title: 'Mülakat hazırlığı',
    category: 'Kariyer',
    text: '[Pozisyon] mülakatı için 10 soru ve her biri için güçlü ama abartısız bir cevap iskeleti hazırla. Deneyimlerim: [yaz].',
    tool: { label: 'AI Chat', href: '/sohbet' },
  },
  {
    title: 'Araştırma planı',
    category: 'Araştırma',
    text: '[Konu] hakkında karar vermeden önce hangi soruları yanıtlamam gerek? Araştırma soruları, bakılacak kaynak türleri ve doğrulama kontrol listesi çıkar. Link uydurma.',
    tool: { label: 'Research AI', href: '/research' },
  },
  {
    title: 'Uzun metni özetle',
    category: 'Araştırma',
    text: 'Şu metni 6 maddeye indir, sonunda tek cümlelik ana mesaj yaz. Metinde olmayan bilgi ekleme:\n\n[yapıştır]',
    tool: { label: 'Belge Analizi', href: '/belge' },
  },
  {
    title: 'Sunum iskeleti',
    category: 'Sunum',
    text: '[Konu] için 7 slaytlık sunum planı çıkar. Her slaytta başlık, en fazla 3 madde ve konuşmacı notu olsun.',
    tool: { label: 'Sunum', href: '/sunum' },
  },
]

const CATEGORIES = ['Tümü', ...Array.from(new Set(TEMPLATES.map((item) => item.category)))]

export default function TemplatesPage() {
  const [category, setCategory] = useState('Tümü')
  const [copied, setCopied] = useState('')
  const [error, setError] = useState('')

  const list = useMemo(
    () => (category === 'Tümü' ? TEMPLATES : TEMPLATES.filter((item) => item.category === category)),
    [category]
  )

  const copy = async (template: Template) => {
    try {
      await navigator.clipboard.writeText(template.text)
      setCopied(template.title)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('Panoya kopyalanamadı; metni seçip kopyalayabilirsin.')
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-[1150px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[300px] pf-hero-glow" />

      <header className="pf-enter mb-5 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="folder" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Şablonlar</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Hazır istemler: kopyala, köşeli parantezleri doldur, ilgili araçta kullan.
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`rounded-full border px-3 py-1 text-[11.5px] transition ${
              category === item
                ? 'border-[#7c5cff]/60 bg-[#7c5cff]/12 text-white'
                : 'border-[#242a36] text-[#a7acb8] hover:text-white'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12.5px] text-[#fca5a5]">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((template) => (
          <article
            key={template.title}
            className="flex min-w-0 flex-col rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-semibold text-white">{template.title}</p>
              <span className="shrink-0 rounded px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-[#6f7686] ring-1 ring-[#242a36]">
                {template.category}
              </span>
            </div>

            <p className="mt-2 line-clamp-4 text-[12px] leading-relaxed text-[#878d9b]">
              {template.text}
            </p>

            <div className="mt-3 flex items-center gap-2 border-t border-[#1b1f28] pt-2.5">
              <button
                type="button"
                onClick={() => copy(template)}
                className="flex items-center gap-1.5 rounded-lg border border-[#242a36] px-2 py-1 text-[11px] text-[#a7acb8] hover:text-white"
              >
                <Icon name="copy" className="h-3 w-3" />
                {copied === template.title ? 'Kopyalandı' : 'Kopyala'}
              </button>
              <Link
                href={template.tool.href}
                className="ml-auto flex items-center gap-1 text-[11px] text-[#a48bff] hover:text-white"
              >
                {template.tool.label}
                <Icon name="arrowRight" className="h-3 w-3" />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-6 rounded-xl border border-[#1b1f28] bg-[#0b0d13] px-4 py-3 text-[12px] leading-relaxed text-[#6f7686]">
        Şablonlar bir başlangıç noktası. Köşeli parantezleri kendi bilginle doldur; modelin
        uydurmaması için gerçek olmayan bilgi ekleme.
      </p>
    </div>
  )
}
