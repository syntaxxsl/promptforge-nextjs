
'use client'

import { useMemo, useState } from 'react'

const updates = [
  {
    version: '2.5.0',
    date: '19 Kasım 2026',
    category: 'Yeni Özellik',
    title: 'Destek Merkezi',
    description: 'Kullanıcılar artık destek talebi oluşturabilir ve taleplerini takip edebilir.',
    items: [
      'Yeni destek talebi oluşturma sistemi',
      'Destek taleplerini listeleme',
      'Talep durumlarını görüntüleme'
    ]
  },
  {
    version: '2.4.0',
    date: '18 Kasım 2026',
    category: 'Yeni Özellik',
    title: 'SEO Analyzer',
    description: 'Web sayfalarının temel SEO kriterlerini kontrol eden yeni araç.',
    items: [
      'SEO başlığı kontrolü',
      'Meta açıklaması analizi',
      'SEO raporu oluşturma'
    ]
  },
  {
    version: '2.3.0',
    date: '17 Kasım 2026',
    category: 'Yeni Özellik',
    title: 'Export Studio',
    description: 'Projeleri farklı dosya formatlarında dışa aktarma.',
    items: [
      'HTML, CSS ve JS indirme',
      'ZIP paket oluşturma'
    ]
  },
  {
    version: '2.2.0',
    date: '16 Kasım 2026',
    category: 'Yeni Özellik',
    title: 'Code Sandbox',
    description: 'HTML, CSS ve JavaScript kodlarını izole bir önizleme alanında test etme.',
    items: [
      'Canlı kod önizlemesi',
      'Ayrı HTML, CSS ve JS alanları'
    ]
  },
  {
    version: '2.1.0',
    date: '15 Kasım 2026',
    category: 'Geliştirme',
    title: 'Kod Araçları',
    description: 'Kod geliştirme sürecini kolaylaştıran araçlar genişletildi.',
    items: [
      'Code Diff',
      'Snippet Library',
      'Responsive Preview'
    ]
  },
  {
    version: '2.0.0',
    date: '14 Kasım 2026',
    category: 'Büyük Güncelleme',
    title: 'PromptForge 2.0',
    description: 'Platformun araçları ve proje yönetimi deneyimi geliştirildi.',
    items: [
      'Yeni araç sayfaları',
      'Galeri geliştirmeleri',
      'Proje yönetimi iyileştirmeleri'
    ]
  }
]

const categories = [
  'Tümü',
  'Yeni Özellik',
  'Geliştirme',
  'Büyük Güncelleme',
  'Düzeltme'
]

export default function ChangelogPage() {
  const [category, setCategory] = useState('Tümü')
  const [search, setSearch] = useState('')

  const filteredUpdates = useMemo(() => {
    return updates.filter(update => {
      const categoryMatch =
        category === 'Tümü' || update.category === category

      const searchText = search.toLowerCase().trim()

      const searchMatch =
        update.title.toLowerCase().includes(searchText) ||
        update.description.toLowerCase().includes(searchText) ||
        update.version.toLowerCase().includes(searchText)

      return categoryMatch && searchMatch
    })
  }, [category, search])

  return (
    <main className="min-h-screen bg-[#09090f] text-white px-5 py-10 sm:py-14">
      <div className="max-w-4xl mx-auto">

        <div className="mb-10">
          <p className="text-violet-400 font-bold text-sm tracking-widest">
            PROMPTFORGE UPDATES
          </p>

          <h1 className="text-4xl sm:text-5xl font-bold mt-3">
            Güncelleme Geçmişi
          </h1>

          <p className="text-gray-400 mt-3 max-w-2xl">
            PromptForge'da yapılan yenilikleri, geliştirmeleri ve
            düzeltmeleri buradan takip edebilirsin.
          </p>
        </div>

        <div className="bg-[#15151f] border border-gray-800 rounded-2xl p-5 mb-7">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <p className="text-gray-500 text-sm">Mevcut sürüm</p>
              <p className="text-3xl font-bold mt-1">v2.5.0</p>
            </div>

            <div className="sm:text-right">
              <p className="text-gray-500 text-sm">Toplam güncelleme</p>
              <p className="text-3xl font-bold mt-1">
                {updates.length}
              </p>
            </div>
          </div>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Güncelleme ara..."
          className="w-full bg-[#15151f] border border-gray-800 rounded-xl p-4 mb-5 outline-none focus:border-violet-500"
        />

        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map(item => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`px-4 py-2 rounded-xl text-sm transition ${
                category === item
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#15151f] border border-gray-800 text-gray-400 hover:border-violet-500'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="space-y-5">
          {filteredUpdates.map(update => (
            <article
              key={update.version}
              className="bg-[#15151f] border border-gray-800 rounded-2xl p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <span className="bg-violet-500/15 text-violet-400 px-3 py-1 rounded-lg text-sm font-bold">
                    v{update.version}
                  </span>

                  <span className="text-gray-500 text-sm">
                    {update.date}
                  </span>
                </div>

                <span className="text-xs bg-gray-800 text-gray-300 px-3 py-1 rounded-full">
                  {update.category}
                </span>
              </div>

              <h2 className="text-xl font-bold">
                {update.title}
              </h2>

              <p className="text-gray-400 text-sm leading-6 mt-2">
                {update.description}
              </p>

              <div className="mt-5 space-y-3">
                {update.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 text-sm text-gray-300"
                  >
                    <span className="text-violet-400">✓</span>
                    {item}
                  </div>
                ))}
              </div>
            </article>
          ))}

          {filteredUpdates.length === 0 && (
            <div className="bg-[#15151f] border border-gray-800 rounded-2xl p-10 text-center">
              <p className="font-semibold">Güncelleme bulunamadı.</p>
              <p className="text-gray-500 text-sm mt-2">
                Başka bir arama veya kategori dene.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-10">
          PromptForge Changelog
        </p>

      </div>
    </main>
  )
}
