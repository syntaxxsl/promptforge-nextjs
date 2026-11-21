'use client'

import { useState } from 'react'
import Icon from '../../components/Icon'
import { askAI } from '../../../lib/ai-client'

/**
 * Workflow Builder: seçilen akıştaki adımları sırayla çalıştırır.
 * Her adımın çıktısı bir sonraki adıma bağlam olarak verilir.
 */

type Recipe = {
  id: string
  name: string
  text: string
  inputLabel: string
  placeholder: string
  stages: { title: string; system: string }[]
}

const RECIPES: Recipe[] = [
  {
    id: 'site',
    name: 'Fikirden siteye',
    text: 'Brief → sayfa metinleri → tek dosya HTML',
    inputLabel: 'Site fikri',
    placeholder: 'Örn: Bursa’da implant ve ortodonti yapan küçük bir diş kliniği için tek sayfalık site.',
    stages: [
      {
        title: 'Brief',
        system:
          'Sen bir web stratejistisin. Türkçe yaz. Kullanıcının fikrinden kısa bir brief çıkar: hedef kitle, sitenin amacı, bölümler (en fazla 5), her bölümde ne olacağı ve ton. Madde madde yaz, giriş cümlesi kurma.',
      },
      {
        title: 'Sayfa metinleri',
        system:
          'Sen bir metin yazarısın. Türkçe yaz. Verilen brief’e göre sitenin tüm metinlerini yaz: başlık, alt başlık, bölüm başlıkları, paragraflar, düğme yazıları. Uydurma rakam, ödül veya müşteri yorumu ekleme. Metinleri "Bölüm: ..." başlıklarıyla ver.',
      },
      {
        title: 'Tek dosya HTML',
        system:
          'Sen bir frontend geliştiricisisin. Verilen metinlerle tek dosyalık, mobil uyumlu, sade ve modern bir HTML sayfası yaz. CSS’i <style> içine koy. Harici kütüphane, görsel linki veya gizli anahtar kullanma. Sadece kod bloğu döndür.',
      },
    ],
  },
  {
    id: 'lansman',
    name: 'Üründen lansmana',
    text: 'Analiz → konumlandırma → lansman takvimi',
    inputLabel: 'Ürün veya hizmet',
    placeholder: 'Örn: Evde kahve demleyenler için abonelikle gelen taze çekirdek kahve kutusu.',
    stages: [
      {
        title: 'Analiz',
        system:
          'Sen bir ürün stratejistisin. Türkçe yaz. Ürünü hedef kitle, problem, alternatifler ve farklılaşma açısından kısa maddelerle analiz et. Veri uydurma; varsayımlarını "varsayım" diye işaretle.',
      },
      {
        title: 'Konumlandırma',
        system:
          'Türkçe yaz. Analize dayanarak tek cümlelik konumlandırma, üç mesaj ve bir slogan öner. Sonra itirazları ve cevaplarını listele.',
      },
      {
        title: 'Lansman takvimi',
        system:
          'Türkçe yaz. 4 haftalık lansman planı çıkar: hafta hafta yapılacak işler, kanal, içerik fikri ve ölçülecek tek bir metrik. Tablo yerine madde madde yaz.',
      },
    ],
  },
  {
    id: 'sunum',
    name: 'Metinden sunuma',
    text: 'Özet → slayt planı → konuşmacı notları',
    inputLabel: 'Metin veya konu',
    placeholder: 'Bir raporu, yazıyı ya da konuyu buraya yapıştır.',
    stages: [
      {
        title: 'Özet',
        system:
          'Türkçe yaz. Verilen metni 5-7 maddeye indir. Metinde olmayan bilgi ekleme. Sonunda "Ana mesaj" diye tek cümle yaz.',
      },
      {
        title: 'Slayt planı',
        system:
          'Türkçe yaz. Özetten 6-8 slaytlık bir plan çıkar. Her slayt için: başlık, en fazla 3 madde ve varsa görsel önerisi. Numaralı yaz.',
      },
      {
        title: 'Konuşmacı notları',
        system:
          'Türkçe yaz. Her slayt için 30-45 saniyede söylenecek konuşma metnini yaz. Doğal konuşma dili kullan, ezber metni gibi olmasın.',
      },
    ],
  },
  {
    id: 'icerik',
    name: 'İçeriği yeniden yaz',
    text: 'Özet → farklı ton → başlık ve paylaşım',
    inputLabel: 'Kaynak metin',
    placeholder: 'Yeniden yazmak istediğin metni yapıştır.',
    stages: [
      {
        title: 'Özet',
        system:
          'Türkçe yaz. Verilen metnin ana fikrini ve 3-5 kilit noktasını çıkar. Metinde olmayan bilgi ekleme.',
      },
      {
        title: 'Yeniden yazım',
        system:
          'Türkçe yaz. Özeti akıcı, sade bir metne dönüştür. Klişe girişlerden kaçın, kısa cümleler kullan, aynı anlamı koru.',
      },
      {
        title: 'Başlık ve paylaşım',
        system:
          'Türkçe yaz. Metin için 5 başlık öner ve bir sosyal medya paylaşım metni yaz (en fazla 3 cümle). Tıklama tuzağı kurma, abartma.',
      },
    ],
  },
]

type Run = { status: 'wait' | 'run' | 'done' | 'error'; output: string }

const emptyRun: Run = { status: 'wait', output: '' }

export default function WorkflowsPage() {
  const [recipeId, setRecipeId] = useState(RECIPES[0].id)
  const [input, setInput] = useState('')
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)

  const recipe = RECIPES.find((item) => item.id === recipeId) || RECIPES[0]

  const pick = (id: string) => {
    setRecipeId(id)
    setRuns([])
    setError('')
    setActive(0)
  }

  const patch = (index: number, changes: Partial<Run>) => {
    setRuns((previous) =>
      previous.map((run, position) => (position === index ? { ...run, ...changes } : run))
    )
  }

  const runAll = async () => {
    const clean = input.trim()

    if (!clean) {
      setError('Akışa bir metin ver.')
      return
    }

    setLoading(true)
    setError('')
    setActive(0)
    setRuns(recipe.stages.map(() => ({ ...emptyRun })))

    let previousOutput = ''

    try {
      for (let index = 0; index < recipe.stages.length; index += 1) {
        setActive(index)
        patch(index, { status: 'run' })

        const output = await askAI({
          messages: [
            { role: 'system', content: recipe.stages[index].system },
            {
              role: 'user',
              content:
                index === 0
                  ? clean
                  : `Kullanıcının ilk metni:\n${clean.slice(0, 2000)}\n\nÖnceki adımın çıktısı:\n${previousOutput.slice(0, 6000)}`,
            },
          ],
        })

        previousOutput = output
        patch(index, { status: 'done', output })
      }
    } catch (caught) {
      patch(active, {
        status: 'error',
        output: caught instanceof Error ? caught.message : 'Adım tamamlanamadı.',
      })
      setError(caught instanceof Error ? caught.message : 'Akış tamamlanamadı.')
    } finally {
      setLoading(false)
    }
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setError('Panoya kopyalanamadı; metni seçip kopyalayabilirsin.')
    }
  }

  const download = () => {
    const text = recipe.stages
      .map((stage, index) => `## ${index + 1}. ${stage.title}\n\n${runs[index]?.output || ''}`)
      .join('\n\n')

    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `promptforge-akis-${recipe.id}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  const started = runs.length > 0
  const htmlStage = recipe.id === 'site' ? runs[2]?.output : ''
  const htmlCode =
    htmlStage && /<html|<!DOCTYPE|<body/i.test(htmlStage)
      ? htmlStage.replace(/```[a-z]*/gi, '').replace(/```/g, '')
      : ''

  return (
    <div className="relative mx-auto w-full max-w-[1200px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] pf-hero-glow" />

      <header className="pf-enter mb-6 flex items-start gap-3.5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#7c5cff]/30 bg-[#7c5cff]/12 text-[#a48bff]">
          <Icon name="layers" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight text-white">Workflow Builder</h1>
          <p className="mt-0.5 text-[13px] text-[#878d9b]">
            Araçları zincirle: her adımın çıktısı bir sonrakine geçer.
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-[#1b1f28] bg-[#0b0d13] p-4 sm:p-5">
        <p className="mb-2 text-[12px] font-medium text-[#9aa0ae]">Hazır akış</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RECIPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => pick(item.id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${
                item.id === recipeId
                  ? 'border-[#7c5cff]/60 bg-[#7c5cff]/10'
                  : 'border-[#1b1f28] bg-[#080a0f] hover:border-[#242a36]'
              }`}
            >
              <p className="text-[13px] font-medium text-white">{item.name}</p>
              <p className="mt-0.5 text-[11.5px] text-[#6f7686]">{item.text}</p>
            </button>
          ))}
        </div>

        <label htmlFor="workflow-input" className="mb-2 mt-4 block text-[12px] font-medium text-[#9aa0ae]">
          {recipe.inputLabel}
        </label>
        <textarea
          id="workflow-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={5}
          maxLength={8000}
          placeholder={recipe.placeholder}
          className="pf-scroll w-full resize-y rounded-xl border border-[#1b1f28] bg-[#080a0f] p-3.5 text-[13.5px] leading-relaxed text-[#e7e9ee] outline-none placeholder:text-[#5b616f] focus:border-[#7c5cff]/60"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runAll}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#7c5cff] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#8b6fff] disabled:opacity-60"
          >
            <Icon name={loading ? 'pulse' : 'sparkles'} className="h-4 w-4" />
            {loading ? `Adım ${active + 1}/${recipe.stages.length} çalışıyor…` : 'Akışı çalıştır'}
          </button>

          {started && !loading && (
            <button
              type="button"
              onClick={download}
              className="flex items-center gap-1.5 rounded-xl border border-[#242a36] px-3 py-2 text-[12.5px] text-[#a7acb8] hover:text-white"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              Akışı indir
            </button>
          )}

          <p className="text-[11.5px] text-[#5f6573]">{recipe.stages.length} istek harcar.</p>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-[12.5px] text-[#fca5a5]">
            {error}
          </p>
        )}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {recipe.stages.map((stage, index) => {
          const state = runs[index] || emptyRun

          return (
            <section
              key={stage.title}
              className={`flex min-h-[220px] min-w-0 flex-col rounded-2xl border bg-[#0b0d13] ${
                state.status === 'error'
                  ? 'border-[#f87171]/30'
                  : state.status === 'done'
                  ? 'border-[#7c5cff]/25'
                  : state.status === 'run'
                  ? 'border-[#7c5cff]/60'
                  : 'border-[#1b1f28]'
              }`}
            >
              <div className="flex items-center gap-2 border-b border-[#1b1f28] px-3.5 py-2.5">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-md border text-[10.5px] font-semibold ${
                    state.status === 'done'
                      ? 'border-[#7c5cff]/40 bg-[#7c5cff]/15 text-[#c0afff]'
                      : 'border-[#242a36] bg-[#080a0f] text-[#7c8291]'
                  }`}
                >
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-white">
                  {stage.title}
                </p>
                <span className="shrink-0 text-[10.5px] text-[#6f7686]">
                  {state.status === 'run'
                    ? 'çalışıyor'
                    : state.status === 'done'
                    ? 'tamam'
                    : state.status === 'error'
                    ? 'hata'
                    : 'sırada'}
                </span>
              </div>

              <div className="pf-scroll min-h-0 flex-1 overflow-y-auto px-3.5 py-3">
                {state.status === 'run' && (
                  <div className="space-y-2">
                    {[90, 72, 82].map((width, position) => (
                      <div
                        key={position}
                        className="h-2.5 animate-pulse rounded bg-white/[0.05]"
                        style={{ width: `${width}%` }}
                      />
                    ))}
                  </div>
                )}

                {state.output && state.status !== 'run' && (
                  <p
                    className={`whitespace-pre-wrap text-[12.5px] leading-relaxed ${
                      state.status === 'error' ? 'text-[#fca5a5]' : 'text-[#c3c7d1]'
                    }`}
                  >
                    {state.output}
                  </p>
                )}

                {!state.output && state.status === 'wait' && (
                  <p className="text-[12px] text-[#5f6573]">
                    {index === 0 ? 'Akış başlayınca ilk adım burada.' : 'Önceki adım bitince burası dolar.'}
                  </p>
                )}
              </div>

              {state.output && (
                <div className="border-t border-[#1b1f28] px-3.5 py-2">
                  <button
                    type="button"
                    onClick={() => copy(state.output)}
                    className="flex items-center gap-1.5 text-[11.5px] text-[#7c8291] hover:text-white"
                  >
                    <Icon name="copy" className="h-3.5 w-3.5" />
                    Bu adımı kopyala
                  </button>
                </div>
              )}
            </section>
          )
        })}
      </div>

      {htmlCode && (
        <section className="mt-4 rounded-2xl border border-[#1b1f28] bg-[#0b0d13]">
          <div className="flex items-center justify-between border-b border-[#1b1f28] px-4 py-2.5">
            <p className="text-[12px] font-medium text-[#9aa0ae]">Site önizlemesi</p>
            <button
              type="button"
              onClick={() => copy(htmlCode)}
              className="flex items-center gap-1.5 text-[11.5px] text-[#7c8291] hover:text-white"
            >
              <Icon name="copy" className="h-3.5 w-3.5" />
              HTML’i kopyala
            </button>
          </div>
          <iframe
            title="Akış site önizlemesi"
            srcDoc={htmlCode}
            sandbox="allow-scripts"
            className="h-[min(60vh,620px)] w-full rounded-b-2xl bg-white"
          />
        </section>
      )}
    </div>
  )
}
