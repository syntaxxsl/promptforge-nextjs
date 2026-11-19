
'use client'

import { useState } from 'react'

export default function SEOPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [keywords, setKeywords] = useState('')
  const [heading, setHeading] = useState('')
  const [imageAlt, setImageAlt] = useState('')

  const checks = [
    {
      name: 'SEO başlığı',
      passed: title.trim().length >= 30 && title.trim().length <= 60,
      detail: `${title.length}/60 karakter (önerilen: 30-60)`
    },
    {
      name: 'Meta açıklaması',
      passed: description.trim().length >= 120 && description.trim().length <= 160,
      detail: `${description.length}/160 karakter (önerilen: 120-160)`
    },
    {
      name: 'Sayfa URL adresi',
      passed: /^https?:\/\/.+\..+/.test(url.trim()),
      detail: url.trim() ? 'URL girildi' : 'URL girilmedi'
    },
    {
      name: 'Anahtar kelimeler',
      passed: keywords.split(',').filter(x => x.trim()).length >= 3,
      detail: `${keywords.split(',').filter(x => x.trim()).length} anahtar kelime`
    },
    {
      name: 'H1 başlığı',
      passed: heading.trim().length > 0,
      detail: heading.trim() ? 'H1 başlığı girildi' : 'H1 başlığı eksik'
    },
    {
      name: 'Görsel ALT metni',
      passed: imageAlt.trim().length > 0,
      detail: imageAlt.trim() ? 'ALT metni girildi' : 'ALT metni eksik'
    }
  ]

  const score = Math.round(
    (checks.filter(x => x.passed).length / checks.length) * 100
  )

  const copyReport = () => {
    const report = [
      'PROMPTFORGE SEO RAPORU',
      `SEO Puanı: ${score}/100`,
      '',
      ...checks.map(x => `${x.passed ? '✓' : '✗'} ${x.name}: ${x.detail}`)
    ].join('\n')

    navigator.clipboard.writeText(report)
      .then(() => alert('SEO raporu kopyalandı.'))
      .catch(() => alert('Rapor kopyalanamadı.'))
  }

  const inputClass =
    'w-full bg-[#09090f] border border-gray-700 rounded-xl p-3 text-white outline-none focus:border-violet-500'

  return (
    <main className="min-h-screen bg-[#09090f] text-white p-5 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <p className="text-violet-400 text-sm font-bold mb-2">
          PROMPTFORGE TOOLS
        </p>

        <h1 className="text-3xl sm:text-4xl font-bold">
          SEO Analyzer
        </h1>

        <p className="text-gray-400 mt-2 mb-8">
          Sayfanın temel SEO kriterlerini kontrol et.
        </p>

        <div className="grid md:grid-cols-2 gap-5">
          <section className="bg-[#15151f] border border-gray-800 rounded-2xl p-5">
            <h2 className="font-bold text-lg mb-5">Sayfa Bilgileri</h2>

            <label className="text-sm text-gray-400">SEO Başlığı</label>
            <input
              className={inputClass + ' mt-2 mb-2'}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Örn: Modern Web Tasarım Rehberi"
            />

            <label className="text-sm text-gray-400">Meta Açıklaması</label>
            <textarea
              className={inputClass + ' mt-2 mb-4'}
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Sayfanı kısaca açıkla..."
            />

            <label className="text-sm text-gray-400">Sayfa URL</label>
            <input
              className={inputClass + ' mt-2 mb-4'}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com"
            />

            <label className="text-sm text-gray-400">Anahtar Kelimeler</label>
            <input
              className={inputClass + ' mt-2 mb-4'}
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
              placeholder="web tasarım, html, css"
            />

            <label className="text-sm text-gray-400">H1 Başlığı</label>
            <input
              className={inputClass + ' mt-2 mb-4'}
              value={heading}
              onChange={e => setHeading(e.target.value)}
              placeholder="Ana sayfa başlığı"
            />

            <label className="text-sm text-gray-400">Görsel ALT Metni</label>
            <input
              className={inputClass + ' mt-2'}
              value={imageAlt}
              onChange={e => setImageAlt(e.target.value)}
              placeholder="Görselin açıklaması"
            />
          </section>

          <section className="bg-[#15151f] border border-gray-800 rounded-2xl p-5">
            <h2 className="font-bold text-lg mb-5">SEO Raporu</h2>

            <div className="flex flex-col items-center py-5">
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center border-8 border-violet-500"
              >
                <span className="text-4xl font-bold">{score}</span>
              </div>
              <p className="text-gray-400 text-sm mt-3">
                Temel SEO kontrol puanı
              </p>
            </div>

            <div className="space-y-4 mt-4">
              {checks.map((check, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-3 border-b border-gray-800 pb-3"
                >
                  <div>
                    <p className="font-medium text-sm">{check.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {check.detail}
                    </p>
                  </div>

                  <span className={
                    check.passed ? 'text-green-400' : 'text-red-400'
                  }>
                    {check.passed ? '✓' : '✗'}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={copyReport}
              className="w-full mt-6 bg-violet-600 hover:bg-violet-500 rounded-xl p-3 font-semibold"
            >
              Raporu Kopyala
            </button>
          </section>
        </div>

        <p className="text-xs text-gray-500 mt-6 text-center">
          Bu araç temel SEO kontrolleri yapar; gerçek Google sıralamasını ölçmez.
        </p>
      </div>
    </main>
  )
}
