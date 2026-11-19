
'use client'

import { useState } from 'react'
import Link from 'next/link'

declare global {
  interface Window {
    puter?: any
  }
}

type CriticResult = {
  score: number
  summary: string
  strengths: string[]
  problems: {
    title: string
    description: string
    priority: string
    solution: string
  }[]
  categories: {
    name: string
    score: number
    comment: string
  }[]
  recommendations: string[]
}

const initialResult: CriticResult = {
  score: 0,
  summary: '',
  strengths: [],
  problems: [],
  categories: [],
  recommendations: []
}

export default function CriticPage() {
  const [html, setHtml] = useState('')
  const [css, setCss] = useState('')
  const [js, setJs] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CriticResult | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const analyze = async () => {
    if (!html.trim() && !css.trim() && !js.trim()) {
      setError('Analiz için en az bir kod alanını doldurmalısın.')
      return
    }

    if (!window.puter?.ai?.chat) {
      setError('Puter.js yüklenmedi. Sayfayı yenileyip tekrar dene.')
      return
    }

    setLoading(true)
    setError('')
    setResult(null)

    const prompt = `
Sen profesyonel bir UI/UX tasarım uzmanı ve frontend kod denetçisisin.

Aşağıdaki HTML, CSS ve JavaScript kodlarını incele.
Tasarım kalitesini, kullanıcı deneyimini ve kod yapısını değerlendir.

HTML:
${html.slice(0, 15000)}

CSS:
${css.slice(0, 15000)}

JavaScript:
${js.slice(0, 10000)}

Şu konuları değerlendir:
- Görsel hiyerarşi ve düzen
- Renk uyumu ve okunabilirlik
- Mobil ve responsive tasarım
- Kullanıcı deneyimi ve gezinme kolaylığı
- Erişilebilirlik
- HTML ve CSS yapısının kalitesi
- JavaScript etkileşimleri
- Performans açısından dikkat edilmesi gerekenler

Kodda olmayan özellikleri varmış gibi değerlendirme.
Sadece gerçekten gördüğün sorunları belirt.
Kodun çalıştırıldığını veya gerçek cihazlarda test edildiğini iddia etme.

SADECE geçerli JSON döndür. Markdown veya açıklama ekleme.

JSON şeması:
{
  "score": 0,
  "summary": "Genel değerlendirme",
  "strengths": ["Güçlü yön 1"],
  "problems": [
    {
      "title": "Sorun başlığı",
      "description": "Sorunun açıklaması",
      "priority": "Yüksek",
      "solution": "Çözüm önerisi"
    }
  ],
  "categories": [
    {
      "name": "Görsel Tasarım",
      "score": 0,
      "comment": "Kısa değerlendirme"
    },
    {
      "name": "Mobil Uyumluluk",
      "score": 0,
      "comment": "Kısa değerlendirme"
    },
    {
      "name": "Kullanıcı Deneyimi",
      "score": 0,
      "comment": "Kısa değerlendirme"
    },
    {
      "name": "Kod Kalitesi",
      "score": 0,
      "comment": "Kısa değerlendirme"
    },
    {
      "name": "Erişilebilirlik",
      "score": 0,
      "comment": "Kısa değerlendirme"
    }
  ],
  "recommendations": ["Öneri 1", "Öneri 2"]
}

Puanlar 0 ile 100 arasında tam sayı olmalı.
En fazla 8 sorun, 8 güçlü yön ve 8 öneri yaz.
Öncelik değerleri yalnızca Yüksek, Orta veya Düşük olsun.
`

    try {
      const response = await window.puter.ai.chat(
        prompt,
        { model: 'gpt-4o-mini' }
      )

      const raw =
        response?.message?.content ||
        response?.text ||
        ''

      if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error('AI yanıtı alınamadı.')
      }

      const cleaned = raw
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()

      const start = cleaned.indexOf('{')
      const end = cleaned.lastIndexOf('}')

      if (start === -1 || end === -1) {
        throw new Error('AI geçerli bir analiz formatı döndürmedi.')
      }

      const parsed = JSON.parse(cleaned.slice(start, end + 1))

      const safeResult: CriticResult = {
        score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
        summary: String(parsed.summary || 'Değerlendirme tamamlandı.'),
        strengths: Array.isArray(parsed.strengths)
          ? parsed.strengths.slice(0, 8).map(String)
          : [],
        problems: Array.isArray(parsed.problems)
          ? parsed.problems.slice(0, 8).map((item: any) => ({
              title: String(item.title || 'Belirtilmemiş sorun'),
              description: String(item.description || ''),
              priority: ['Yüksek', 'Orta', 'Düşük'].includes(item.priority)
                ? item.priority
                : 'Orta',
              solution: String(item.solution || '')
            }))
          : [],
        categories: Array.isArray(parsed.categories)
          ? parsed.categories.slice(0, 8).map((item: any) => ({
              name: String(item.name || ''),
              score: Math.max(0, Math.min(100, Number(item.score) || 0)),
              comment: String(item.comment || '')
            }))
          : [],
        recommendations: Array.isArray(parsed.recommendations)
          ? parsed.recommendations.slice(0, 8).map(String)
          : []
      }

      setResult(safeResult)
      setActiveTab('overview')
    } catch (err: any) {
      setError(err?.message || 'Analiz sırasında bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const priorityStyle = (priority: string) => {
    if (priority === 'Yüksek') {
      return 'border-red-500/20 bg-red-500/10 text-red-300'
    }

    if (priority === 'Orta') {
      return 'border-yellow-500/20 bg-yellow-500/10 text-yellow-300'
    }

    return 'border-green-500/20 bg-green-500/10 text-green-300'
  }

  const tabs = [
    ['overview', 'Genel Bakış'],
    ['strengths', 'Güçlü Yönler'],
    ['problems', 'Sorunlar'],
    ['recommendations', 'Öneriler']
  ]

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">

        <header className="mb-10 flex items-center justify-between rounded-2xl border border-white/10 bg-[#101010] px-5 py-4">
          <Link href="/" className="text-lg font-bold">
            <span className="bg-gradient-to-r from-purple-500 to-blue-400 bg-clip-text text-transparent">
              PromptForge
            </span>
          </Link>

          <Link
            href="/"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            ← Ana Sayfa
          </Link>
        </header>

        <section className="mb-10 text-center">
          <div className="mb-4 inline-flex rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-xs text-purple-300">
            ✦ AI DESIGN INTELLIGENCE
          </div>

          <h1 className="mb-4 text-3xl font-bold sm:text-5xl">
            Tasarımını <span className="bg-gradient-to-r from-purple-500 to-blue-400 bg-clip-text text-transparent">Analiz Et.</span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
            Kodlarını yapay zekâya incelet. Tasarım hatalarını,
            güçlü yönlerini ve geliştirme fırsatlarını keşfet.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">

          <section className="rounded-2xl border border-white/10 bg-[#101010] p-5 sm:p-7">
            <div className="mb-6">
              <h2 className="font-semibold">01. Kodlarını Ekle</h2>
              <p className="mt-2 text-sm text-gray-500">
                Analiz edilmesini istediğin kodları ilgili alanlara yapıştır.
              </p>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                HTML
              </label>
              <textarea
                value={html}
                onChange={e => setHtml(e.target.value)}
                rows={8}
                maxLength={15000}
                placeholder="HTML kodunu buraya yapıştır..."
                className="w-full resize-y rounded-xl border border-white/10 bg-[#080808] p-4 font-mono text-xs leading-6 text-green-300 outline-none transition focus:border-purple-500"
              />
              <p className="mt-1 text-right text-xs text-gray-600">
                {html.length}/15000
              </p>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                CSS
              </label>
              <textarea
                value={css}
                onChange={e => setCss(e.target.value)}
                rows={8}
                maxLength={15000}
                placeholder="CSS kodunu buraya yapıştır..."
                className="w-full resize-y rounded-xl border border-white/10 bg-[#080808] p-4 font-mono text-xs leading-6 text-blue-300 outline-none transition focus:border-purple-500"
              />
              <p className="mt-1 text-right text-xs text-gray-600">
                {css.length}/15000
              </p>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                JavaScript
              </label>
              <textarea
                value={js}
                onChange={e => setJs(e.target.value)}
                rows={7}
                maxLength={10000}
                placeholder="JavaScript kodunu buraya yapıştır..."
                className="w-full resize-y rounded-xl border border-white/10 bg-[#080808] p-4 font-mono text-xs leading-6 text-yellow-300 outline-none transition focus:border-purple-500"
              />
              <p className="mt-1 text-right text-xs text-gray-600">
                {js.length}/10000
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={analyze}
              disabled={loading || (!html.trim() && !css.trim() && !js.trim())}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4 font-semibold transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? '✦ Kodların İnceleniyor...' : '✦ AI ile Tasarımı Analiz Et'}
            </button>

            <p className="mt-3 text-center text-xs text-gray-600">
              Kodların analiz için AI servisine gönderilir.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-[#101010] p-5 sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">02. Analiz Raporu</h2>
                <p className="mt-1 text-xs text-gray-500">
                  AI tarafından oluşturulan değerlendirme
                </p>
              </div>
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                DESIGN REPORT
              </span>
            </div>

            {!result && !loading && (
              <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                <div className="mb-5 text-6xl opacity-40">✧</div>
                <h3 className="font-medium text-gray-300">
                  Henüz analiz yapılmadı
                </h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-gray-500">
                  Kodlarını ekleyip analiz başlattığında rapor burada görünecek.
                </p>
              </div>
            )}

            {loading && (
              <div className="flex min-h-[500px] flex-col items-center justify-center text-center">
                <div className="mb-5 h-12 w-12 animate-spin rounded-full border-2 border-purple-500/20 border-t-purple-500" />
                <h3 className="font-medium">AI kodlarını inceliyor...</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Tasarım, mobil uyumluluk ve kod kalitesi değerlendiriliyor.
                </p>
              </div>
            )}

            {result && (
              <>
                <div className="mb-6 rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 to-blue-500/10 p-5">
                  <p className="text-sm text-gray-400">Genel Tasarım Puanı</p>
                  <div className="mt-2 flex items-end gap-2">
                    <span className="text-5xl font-bold">
                      {result.score}
                    </span>
                    <span className="mb-2 text-gray-500">/ 100</span>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-700"
                      style={{ width: `${result.score}%` }}
                    />
                  </div>
                </div>

                <div className="mb-5 flex flex-wrap gap-2">
                  {tabs.map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      className={`rounded-lg px-3 py-2 text-xs transition ${
                        activeTab === key
                          ? 'bg-purple-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="max-h-[650px] space-y-4 overflow-y-auto pr-1">

                  {activeTab === 'overview' && (
                    <>
                      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                        <h3 className="mb-2 text-sm font-semibold">
                          Genel Değerlendirme
                        </h3>
                        <p className="text-sm leading-6 text-gray-400">
                          {result.summary}
                        </p>
                      </div>

                      <h3 className="text-sm font-semibold">
                        Kategori Puanları
                      </h3>

                      {result.categories.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="mb-2 flex justify-between gap-3 text-sm">
                            <span>{item.name}</span>
                            <span className="font-semibold text-purple-300">
                              {item.score}/100
                            </span>
                          </div>
                          <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                          <p className="text-xs leading-5 text-gray-500">
                            {item.comment}
                          </p>
                        </div>
                      ))}
                    </>
                  )}

                  {activeTab === 'strengths' && (
                    result.strengths.length ? (
                      result.strengths.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-4"
                        >
                          <span className="text-green-400">✓</span>
                          <p className="text-sm leading-6 text-gray-300">
                            {item}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        Belirtilen güçlü yön bulunamadı.
                      </p>
                    )
                  )}

                  {activeTab === 'problems' && (
                    result.problems.length ? (
                      result.problems.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold">
                              {item.title}
                            </h3>
                            <span className={`rounded-full border px-2 py-1 text-xs ${priorityStyle(item.priority)}`}>
                              {item.priority}
                            </span>
                          </div>
                          <p className="mb-3 text-sm leading-6 text-gray-400">
                            {item.description}
                          </p>
                          <div className="rounded-lg bg-blue-500/5 p-3">
                            <p className="mb-1 text-xs font-semibold text-blue-300">
                              Çözüm Önerisi
                            </p>
                            <p className="text-sm leading-6 text-gray-400">
                              {item.solution}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        AI belirgin bir sorun tespit etmedi.
                      </p>
                    )
                  )}

                  {activeTab === 'recommendations' && (
                    result.recommendations.length ? (
                      result.recommendations.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
                        >
                          <span className="text-blue-400">✦</span>
                          <p className="text-sm leading-6 text-gray-300">
                            {item}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">
                        Ek öneri bulunamadı.
                      </p>
                    )
                  )}

                </div>

                <button
                  onClick={() => {
                    setResult(null)
                    setActiveTab('overview')
                  }}
                  className="mt-5 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm transition hover:bg-white/10"
                >
                  Yeni Analiz Başlat
                </button>
              </>
            )}
          </section>
        </div>

        <footer className="mt-10 border-t border-white/10 py-6 text-center text-xs text-gray-600">
          PromptForge · AI Design Critic
        </footer>
      </div>
    </main>
  )
}
