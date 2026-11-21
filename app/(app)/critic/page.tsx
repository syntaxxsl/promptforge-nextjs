'use client'

import { useState } from 'react'
import Icon from '../../components/Icon'
import { askAI } from '../../../lib/ai-client'
import { splitDocument } from '../../../lib/project-files'

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
  // Tek alan: kullanıcı kodu bir bütün olarak yapıştırır.
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CriticResult | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const analyze = async () => {
    if (!code.trim()) {
      setError('Analiz için kodunu yapıştırmalısın.')
      return
    }

    // Stil ve script etiketleri belgeden ayrılıp modele ayrı ayrı verilir.
    const { html, css, js } = splitDocument(code)

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
      const raw = await askAI({ prompt })

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
      return 'border-[#f87171]/30 bg-[#f87171]/10 text-[#fca5a5]'
    }

    if (priority === 'Orta') {
      return 'border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fcd34d]'
    }

    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
  }

  const tabs = [
    ['overview', 'Genel Bakış'],
    ['strengths', 'Güçlü Yönler'],
    ['problems', 'Sorunlar'],
    ['recommendations', 'Öneriler']
  ]

  return (
    <div className="relative mx-auto w-full max-w-[1400px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] pf-hero-glow" />

      <header className="pf-enter mb-6 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="pulse" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Code Studio</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Kodunu yapay zekâya incelet: tasarım puanı, sorunlar ve çözüm önerileri.
          </p>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4 sm:p-5">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <label htmlFor="critic-code" className="text-[12px] font-medium text-[#9aa0ae]">
              Kodun
            </label>
            <span className="text-[11px] text-[#5b616f]">HTML · CSS · JS birlikte</span>
          </div>

          <textarea
            id="critic-code"
            value={code}
            onChange={e => setCode(e.target.value)}
            rows={18}
            maxLength={40000}
            placeholder="HTML, CSS ve script kodunu bir arada buraya yapıştır..."
            className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3.5 font-mono text-[12.5px] leading-relaxed text-[#d7dae2] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
          />

          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] text-[#5b616f]">Stil ve script etiketleri otomatik ayrılır.</span>
            <span className="text-[11px] text-[#5b616f]">{code.length}/40000</span>
          </div>

          <button
            type="button"
            onClick={analyze}
            disabled={loading || !code.trim()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name={loading ? 'pulse' : 'sparkles'} className="h-4 w-4" />
            {loading ? 'İnceleniyor…' : 'Analizi başlat'}
          </button>

          {error && (
            <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12.5px] text-[#fca5a5]">
              {error}
            </p>
          )}

          <p className="mt-3 text-[11.5px] leading-relaxed text-[#5b616f]">
            Kodun analiz için AI servisine gönderilir; projelerinde saklanmaz.
          </p>
        </section>

        <section className="min-w-0 rounded-2xl border border-[#1b1f28] bg-[#0b0d13]">
          <div className="flex flex-wrap items-center gap-2 border-b border-[#1b1f28] px-4 py-3">
            <p className="text-[12px] font-medium text-[#9aa0ae]">Analiz raporu</p>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              {tabs.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  disabled={!result}
                  className={`rounded-lg px-2.5 py-1 text-[11.5px] transition disabled:opacity-35 ${
                    activeTab === key && result
                      ? 'bg-white/[0.08] text-white'
                      : 'text-[#8b909d] hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            {!result && !loading && (
              <div className="grid min-h-[420px] place-items-center px-4 text-center">
                <div className="max-w-[340px]">
                  <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl border border-[#242a36] bg-[#0f1219] text-[#6f7686]">
                    <Icon name="overview" className="h-5 w-5" />
                  </span>
                  <p className="text-[13.5px] font-medium text-white">Henüz analiz yok</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[#6f7686]">
                    Soldaki kutuya kodunu yapıştır; puan ve öneriler burada çıkacak.
                  </p>
                </div>
              </div>
            )}

            {loading && (
              <div className="grid min-h-[420px] place-items-center px-4 text-center">
                <div>
                  <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#7c5cff]/15 text-[#a48bff]">
                    <Icon name="pulse" className="h-6 w-6 animate-pulse" />
                  </div>
                  <p className="text-[13.5px] font-medium text-white">Kodun inceleniyor…</p>
                  <p className="mt-1 text-[12px] text-[#6f7686]">
                    Tasarım, mobil uyumluluk ve kod kalitesi değerlendiriliyor.
                  </p>
                </div>
              </div>
            )}

            {result && (
              <>
                <div className="rounded-xl border border-[#7c5cff]/25 bg-gradient-to-br from-[#7c5cff]/12 to-[#c084fc]/8 p-4">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11.5px] text-[#9aa0ae]">Genel tasarım puanı</p>
                      <div className="mt-1 flex items-end gap-1.5">
                        <span className="text-[34px] font-semibold leading-none text-white">
                          {result.score}
                        </span>
                        <span className="mb-1 text-[12px] text-[#6f7686]">/ 100</span>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#242a36] px-2.5 py-1 text-[10.5px] uppercase tracking-wide text-[#9aa0ae]">
                      tasarım raporu
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#7c5cff] to-[#c084fc]"
                      style={{ width: `${result.score}%` }}
                    />
                  </div>
                </div>

                <div className="pf-scroll mt-4 max-h-[520px] space-y-2.5 overflow-y-auto pr-1">
                  {activeTab === 'overview' && (
                    <>
                      <div className="rounded-xl border border-[#1b1f28] bg-white/[0.02] p-3.5">
                        <p className="mb-1.5 text-[12px] font-medium text-[#9aa0ae]">
                          Genel değerlendirme
                        </p>
                        <p className="text-[13px] leading-relaxed text-[#c3c7d1]">{result.summary}</p>
                      </div>

                      {result.categories.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-[#1b1f28] bg-white/[0.02] p-3.5"
                        >
                          <div className="mb-1.5 flex justify-between gap-3 text-[12.5px]">
                            <span className="text-[#e7e9ee]">{item.name}</span>
                            <span className="font-semibold text-[#a48bff]">{item.score}/100</span>
                          </div>
                          <div className="mb-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#7c5cff] to-[#c084fc]"
                              style={{ width: `${item.score}%` }}
                            />
                          </div>
                          <p className="text-[12px] leading-relaxed text-[#6f7686]">{item.comment}</p>
                        </div>
                      ))}
                    </>
                  )}

                  {activeTab === 'strengths' &&
                    (result.strengths.length ? (
                      result.strengths.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5"
                        >
                          <span className="mt-0.5 text-emerald-400">✓</span>
                          <p className="text-[13px] leading-relaxed text-[#c3c7d1]">{item}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-[#6f7686]">Belirgin bir güçlü yön belirtilmedi.</p>
                    ))}

                  {activeTab === 'problems' &&
                    (result.problems.length ? (
                      result.problems.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-xl border border-[#1b1f28] bg-white/[0.02] p-3.5"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="text-[13px] font-medium text-white">{item.title}</h3>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[10.5px] ${priorityStyle(
                                item.priority
                              )}`}
                            >
                              {item.priority}
                            </span>
                          </div>
                          <p className="text-[12.5px] leading-relaxed text-[#9aa0ae]">
                            {item.description}
                          </p>
                          {item.solution && (
                            <div className="mt-2.5 rounded-lg border border-[#7c5cff]/20 bg-[#7c5cff]/8 p-2.5">
                              <p className="mb-0.5 text-[10.5px] font-medium uppercase tracking-wide text-[#a48bff]">
                                Çözüm
                              </p>
                              <p className="text-[12.5px] leading-relaxed text-[#c3c7d1]">
                                {item.solution}
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-[#6f7686]">AI belirgin bir sorun bulamadı.</p>
                    ))}

                  {activeTab === 'recommendations' &&
                    (result.recommendations.length ? (
                      result.recommendations.map((item, index) => (
                        <div
                          key={index}
                          className="flex gap-2.5 rounded-xl border border-[#7c5cff]/20 bg-[#7c5cff]/10 p-3.5"
                        >
                          <Icon name="sparkles" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a48bff]" />
                          <p className="text-[13px] leading-relaxed text-[#c3c7d1]">{item}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-[12.5px] text-[#6f7686]">Ek öneri gelmedi.</p>
                    ))}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null)
                      setActiveTab('overview')
                    }}
                    className="flex-1 rounded-xl border border-[#242a36] px-3 py-2 text-[12.5px] text-[#a7acb8] hover:text-white"
                  >
                    Yeni analiz
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const text = [
                        `Puan: ${result.score}/100`,
                        result.summary,
                        '',
                        'Güçlü yönler:',
                        ...result.strengths.map(item => `- ${item}`),
                        '',
                        'Sorunlar:',
                        ...result.problems.map(
                          item => `- [${item.priority}] ${item.title}: ${item.description} → ${item.solution}`
                        ),
                        '',
                        'Öneriler:',
                        ...result.recommendations.map(item => `- ${item}`)
                      ].join('\n')
                      const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
                      const url = URL.createObjectURL(blob)
                      const link = document.createElement('a')
                      link.href = url
                      link.download = 'promptforge-tasarim-raporu.md'
                      link.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[#242a36] px-3 py-2 text-[12.5px] text-[#a7acb8] hover:text-white"
                  >
                    <Icon name="download" className="h-3.5 w-3.5" />
                    Raporu indir
                  </button>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
